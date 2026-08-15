import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { storage } from '@/services/storage';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';
import type { NoteInfo } from '@/store/noteStore';
import { useTaskStore } from '@/store/taskStore';
import { useDecisionStore } from '@/store/decisionStore';
import { livePreviewPlugin } from '@/editor/LivePreviewPlugin';
import { wikilinkAutocomplete } from '@/editor/WikilinkCompletion';
import { buildSlashCommands } from '@/editor/slashCommands';
import { parseTaskLineText, parseDecisionLineText } from '@/utils/lineParser';
import { useEditorFloatingUI } from '@/hooks/useEditorFloatingUI';
import { EditorHeader } from '@/components/EditorHeader';
import { FloatingBlockMenu } from '@/components/FloatingBlockMenu';
import { SelectionBubbleMenu, type FormatType } from '@/components/SelectionBubbleMenu';
import { TaskEditModal } from '@/components/TaskEditModal';
import type { TaskEditData } from '@/components/TaskEditModal';
import { DecisionEditModal } from '@/components/DecisionEditModal';
import type { DecisionEditData } from '@/components/DecisionEditModal';
import { DiagramEditorModal, type DiagramPayload } from '@/components/DiagramEditorModal';
import { ExcalidrawEditorModal, type ExcalidrawSavePayload } from '@/components/ExcalidrawEditorModal';
import { extractPngMetadata, injectPngMetadata, YADA_METADATA_KEYWORD, EXCALIDRAW_METADATA_KEYWORD } from '@/utils/pngMetadata';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useTranslation } from 'react-i18next';
import { SlashCommandMenu } from '@/components/SlashCommandMenu';
import { Eye, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractTagsFromFrontmatter } from '@/utils/lineParser';

export const MainEditor: React.FC = () => {
  const { rightPanelOpen, toggleRightPanel, theme, fontSize, editorMode, setEditorMode } = useUiStore();
  const { currentNoteId, currentNoteContent, updateNote, selectNote, notes, vaultTags, updateNoteTags } = useNoteStore();
  const { updateTaskMetadata } = useTaskStore();
  const { updateDecisionMetadata } = useDecisionStore();
  const { t } = useTranslation();
  
  const [localContent, setLocalContent] = useState('');
  const [showTagPopover, setShowTagPopover] = useState(false);

  // Debounce timer refs — prevent disk writes and heavy parsing on every keystroke
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagParseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanId = currentNoteId ? currentNoteId.replace(/\.md$/, '') : '';
  const currentNote = notes.find((n: NoteInfo) => 
    n.id === currentNoteId || 
    n.id === cleanId || 
    n.id.endsWith(`/${cleanId}`) ||
    (currentNoteId && n.path.endsWith(currentNoteId))
  );

  const noteStoreTags = currentNote?.tags || [];
  // Debounced frontmatter tag extraction — parse only after typing pauses
  const [debouncedFrontmatterTags, setDebouncedFrontmatterTags] = useState<string[]>([]);
  useEffect(() => {
    if (tagParseTimerRef.current) clearTimeout(tagParseTimerRef.current);
    tagParseTimerRef.current = setTimeout(() => {
      setDebouncedFrontmatterTags(extractTagsFromFrontmatter(localContent));
    }, 400);
    return () => { if (tagParseTimerRef.current) clearTimeout(tagParseTimerRef.current); };
  }, [localContent]);
  const currentTags = useMemo(() => {
    return Array.from(new Set([...noteStoreTags, ...debouncedFrontmatterTags]));
  }, [noteStoreTags, debouncedFrontmatterTags]);

  // Task & Decision Edit Modal state
  const [taskModalData, setTaskModalData] = useState<TaskEditData | null>(null);
  const [decisionModalData, setDecisionModalData] = useState<DecisionEditData | null>(null);
  // Diagram Modal state (YADA)
  const [diagramModalOpen, setDiagramModalOpen] = useState(false);
  const [diagramInitialMetadata, setDiagramInitialMetadata] = useState<{ logicalData?: any; visualData?: any } | null>(null);
  const [, setEditingDiagramId] = useState<string | null>(null);
  const editingDiagramIdRef = useRef<string | null>(null);

  // Excalidraw Modal state
  const [excalidrawModalOpen, setExcalidrawModalOpen] = useState(false);
  const [sketchInitialData, setSketchInitialData] = useState<any | null>(null);
  const [, setEditingSketchId] = useState<string | null>(null);
  const editingSketchIdRef = useRef<string | null>(null);

  // Delete Confirmation Modal state
  const [confirmDeleteData, setConfirmDeleteData] = useState<{
    from: number;
    to: number;
    isDiagram: boolean;
    relPath: string;
  } | null>(null);

  const editorRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Floating UI (block menu, task/decision buttons, slash command menu)
  const {
    menuPos,
    showOptions, setShowOptions,
    showNotePicker, setShowNotePicker,
    taskEditBtn,
    decisionEditBtn,
    selectionBubble,
    slashMenuState, setSlashMenuState,
    slashStateRef,
    handleEditorUpdate,
  } = useEditorFloatingUI(wrapperRef);

  useEffect(() => {
    setLocalContent(currentNoteContent);
  }, [currentNoteId, currentNoteContent]);

  const handleUpdate = useCallback((val: string) => {
    // Immediate: update local state for responsive typing
    setLocalContent(val);

    // Debounced: write to disk after 500ms of inactivity
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateNote(val);
    }, 500);
  }, [updateNote]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (tagParseTimerRef.current) clearTimeout(tagParseTimerRef.current);
    };
  }, []);

  // Flush pending save when switching notes
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [currentNoteId]);

  const insertText = (text: string) => {
    if (editorRef.current) {
      const view = editorRef.current;
      view.dispatch({
        changes: { from: menuPos.lineFrom, insert: text },
        selection: { anchor: menuPos.lineFrom + text.length }
      });
      view.focus();
      setShowOptions(false);
      setShowNotePicker(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentNoteId) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const relPath = await storage.saveImageBytes(
        currentNoteId,
        file.name,
        bytes,
      );

      const markdownImage = `![${file.name}|400](${relPath})\n`;
      insertText(markdownImage);
    } catch (err) {
      console.error("Failed to upload image:", err);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleOpenTaskModal = () => {
    if (!taskEditBtn.show || !currentNoteId) return;
    const parsed = parseTaskLineText(taskEditBtn.lineText);
    if (parsed) {
      setTaskModalData({
        noteId: currentNoteId,
        lineNumber: taskEditBtn.lineNumber,
        content: parsed.content,
        completed: parsed.completed,
        description: parsed.description,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        priority: parsed.priority,
        assignee: parsed.assignee,
        assignees: parsed.assignees,
        progress: parsed.progress,
        tags: parsed.tags,
      });
    }
  };

  const handleSaveTaskModal = async (updated: TaskEditData) => {
    await updateTaskMetadata(
      updated.noteId,
      updated.lineNumber,
      updated.content,
      updated.completed,
      {
        description: updated.description,
        startDate: updated.startDate,
        endDate: updated.endDate,
        priority: updated.priority,
        assignees: updated.assignees,
        progress: updated.progress,
        tags: updated.tags,
      }
    );
    if (currentNoteId) {
      await selectNote(currentNoteId);
    }
  };

  const handleOpenDecisionModal = () => {
    if (!decisionEditBtn.show || !currentNoteId) return;
    const parsed = parseDecisionLineText(decisionEditBtn.lineText);
    if (parsed) {
      setDecisionModalData({
        noteId: currentNoteId,
        lineNumber: decisionEditBtn.lineNumber,
        content: parsed.content,
        description: parsed.description,
        date: parsed.date,
        status: parsed.status,
        participants: parsed.participants,
        approvedBy: parsed.approvedBy,
        tags: parsed.tags,
      });
    }
  };

  const handleSaveDecisionModal = async (updated: DecisionEditData) => {
    await updateDecisionMetadata(
      updated.noteId,
      updated.lineNumber,
      updated.content,
      {
        description: updated.description,
        date: updated.date,
        status: updated.status,
        participants: updated.participants,
        approvedBy: updated.approvedBy,
        tags: updated.tags,
      }
    );
    if (currentNoteId) {
      await selectNote(currentNoteId);
    }
  };

  /**
   * Execute a slash command: replace /command text with snippet,
   * place cursor at cursorOffset from insert start (defaults to end of text).
   */
  const executeSlashCommand = useCallback((insertText: string, opts?: { cursorOffset?: number; openTagModal?: boolean }) => {
    const state = slashStateRef.current;
    if (editorRef.current && state.show) {
      const view = editorRef.current;
      const { slashFrom, slashTo } = state;
      const cursorPos = slashFrom + (opts?.cursorOffset ?? insertText.length);

      view.dispatch({
        changes: { from: slashFrom, to: slashTo, insert: insertText },
        selection: { anchor: cursorPos },
        scrollIntoView: true,
      });
      requestAnimationFrame(() => view.focus());
    }
    setSlashMenuState((prev) => ({ ...prev, show: false }));
    if (opts?.openTagModal) {
      setTimeout(() => setShowTagPopover(true), 50);
    }
  }, []);

  const openImagePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const openDiagramEditor = useCallback(async (diagramId?: string, explicitRelPath?: string) => {
    if (diagramId && currentNoteId) {
      try {
        const cleanId = diagramId.replace(/^diagram-/, '');
        const fileNamePng = `diagram-${cleanId}.png`;
        const parentDir = currentNoteId.includes('/')
          ? currentNoteId.split('/').slice(0, -1).join('/')
          : '';
        const targetPath = explicitRelPath || (parentDir ? `${parentDir}/.attachments/${fileNamePng}` : `.attachments/${fileNamePng}`);

        const dataUrl = await storage.getImageDataUrl(targetPath);
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const meta = extractPngMetadata(bytes.buffer, YADA_METADATA_KEYWORD);
        setDiagramInitialMetadata(meta);
        setEditingDiagramId(cleanId);
        editingDiagramIdRef.current = cleanId;
      } catch (err) {
        console.error('Failed to extract diagram metadata from PNG', err);
        setDiagramInitialMetadata(null);
        setEditingDiagramId(null);
        editingDiagramIdRef.current = null;
      }
    } else {
      setDiagramInitialMetadata(null);
      setEditingDiagramId(null);
      editingDiagramIdRef.current = null;
    }
    setDiagramModalOpen(true);
  }, [currentNoteId]);

  const openExcalidrawEditor = useCallback(async (sketchId?: string, explicitRelPath?: string) => {
    if (sketchId && currentNoteId) {
      try {
        const cleanId = sketchId.replace(/^sketch-/, '');
        const fileNamePng = `sketch-${cleanId}.png`;
        const parentDir = currentNoteId.includes('/')
          ? currentNoteId.split('/').slice(0, -1).join('/')
          : '';
        const targetPath = explicitRelPath || (parentDir ? `${parentDir}/.attachments/${fileNamePng}` : `.attachments/${fileNamePng}`);

        const dataUrl = await storage.getImageDataUrl(targetPath);
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const meta = extractPngMetadata(bytes.buffer, EXCALIDRAW_METADATA_KEYWORD);
        setSketchInitialData(meta);
        setEditingSketchId(cleanId);
        editingSketchIdRef.current = cleanId;
      } catch (err) {
        console.error('Failed to load sketch PNG metadata', err);
        setSketchInitialData(null);
        setEditingSketchId(null);
        editingSketchIdRef.current = null;
      }
    } else {
      setSketchInitialData(null);
      setEditingSketchId(null);
      editingSketchIdRef.current = null;
    }
    setExcalidrawModalOpen(true);
  }, [currentNoteId]);

  useEffect(() => {
    const handleEditDiagram = (e: CustomEvent<string | { id: string; relPath?: string }>) => {
      const detail = e.detail;
      const id = typeof detail === 'string' ? detail : detail.id;
      const relPath = typeof detail === 'object' ? detail.relPath : undefined;
      if (id.startsWith('sketch-')) {
        openExcalidrawEditor(id, relPath);
      } else {
        openDiagramEditor(id, relPath);
      }
    };
    window.addEventListener('edit-diagram', handleEditDiagram as EventListener);
    return () => window.removeEventListener('edit-diagram', handleEditDiagram as EventListener);
  }, [openDiagramEditor, openExcalidrawEditor]);

  useEffect(() => {
    const handleDeleteRequest = (e: CustomEvent<{ from: number; to: number; isDiagram: boolean; relPath: string }>) => {
      setConfirmDeleteData(e.detail);
    };
    window.addEventListener('request-delete-image', handleDeleteRequest as EventListener);
    return () => window.removeEventListener('request-delete-image', handleDeleteRequest as EventListener);
  }, []);

  const handleConfirmDeleteImage = () => {
    if (!confirmDeleteData || !editorRef.current) return;
    const { from, to } = confirmDeleteData;
    editorRef.current.dispatch({
      changes: { from, to, insert: '' },
    });
    setConfirmDeleteData(null);
  };

  const handleSaveDiagram = async (payload: DiagramPayload) => {
    if (!currentNoteId) return;

    try {
      const isEditing = !!editingDiagramIdRef.current;
      const diagramId = editingDiagramIdRef.current || crypto.randomUUID();
      
      // Update ref immediately to prevent race conditions on rapid auto-saves
      if (!editingDiagramIdRef.current) {
        editingDiagramIdRef.current = diagramId;
        setEditingDiagramId(diagramId);
      }

      const fileNamePng = `diagram-${diagramId}.png`;

      if (payload.previewDataUri) {
        // Save self-contained PNG containing YADA_DIAGRAM chunk
        const base64Data = payload.previewDataUri.replace(/^data:image\/\w+;base64,/, '');
        const binaryStr = atob(base64Data);
        const rawBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          rawBytes[i] = binaryStr.charCodeAt(i);
        }

        const projectPayload = {
          logicalData: payload.logicalJson ? (typeof payload.logicalJson === 'string' ? JSON.parse(payload.logicalJson) : payload.logicalJson) : {},
          visualData: payload.visualJson ? (typeof payload.visualJson === 'string' ? JSON.parse(payload.visualJson) : payload.visualJson) : {},
        };

        // Guarantee PNG metadata injection on the HAN side
        const enrichedBytes = injectPngMetadata(rawBytes.buffer, YADA_METADATA_KEYWORD, projectPayload);
        const relPathPng = await storage.saveImageBytes(currentNoteId, fileNamePng, enrichedBytes as any);
        
        if (!isEditing) {
          insertText(`\n![${fileNamePng}](${relPathPng})\n`);
        }
      }
      
      // Dispatch custom event to instantly update image widget in CodeMirror view
      window.dispatchEvent(
        new CustomEvent('refresh-diagram-image', {
          detail: { diagramId, dataUrl: payload.previewDataUri },
        })
      );
    } catch (err) {
      console.error('Failed to save diagram', err);
    } finally {
      setEditingDiagramId(null);
    }
  };

  const handleSaveSketch = async (payload: ExcalidrawSavePayload) => {
    if (!currentNoteId) return;

    try {
      const isEditing = !!editingSketchIdRef.current;
      const sketchId = editingSketchIdRef.current || crypto.randomUUID();

      if (!editingSketchIdRef.current) {
        editingSketchIdRef.current = sketchId;
        setEditingSketchId(sketchId);
      }

      const fileNamePng = `sketch-${sketchId}.png`;

      // Save self-contained PNG Blob (embedded Excalidraw scene)
      const arrayBuffer = await payload.pngBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const relPathPng = await storage.saveImageBytes(currentNoteId, fileNamePng, bytes);

      if (!isEditing) {
        insertText(`\n![${fileNamePng}](${relPathPng})\n`);
      }

      window.dispatchEvent(
        new CustomEvent('refresh-diagram-image', {
          detail: { diagramId: `sketch-${sketchId}` },
        })
      );
    } catch (err) {
      console.error('Failed to save Excalidraw sketch:', err);
    } finally {
      setEditingSketchId(null);
    }
  };

  const handleFormat = useCallback((type: FormatType, payload?: string) => {
    if (!editorRef.current) return;
    const view = editorRef.current;
    const { from, to } = selectionBubble;
    if (from === to) return;

    const doc = view.state.doc;
    const selectedText = doc.sliceString(from, to);

    let replacement = '';

    switch (type) {
      case 'bold': {
        if (selectedText.startsWith('**') && selectedText.endsWith('**') && selectedText.length >= 4) {
          replacement = selectedText.slice(2, -2);
        } else {
          replacement = `**${selectedText}**`;
        }
        break;
      }
      case 'italic': {
        if (selectedText.startsWith('*') && selectedText.endsWith('*') && !selectedText.startsWith('**') && selectedText.length >= 2) {
          replacement = selectedText.slice(1, -1);
        } else {
          replacement = `*${selectedText}*`;
        }
        break;
      }
      case 'strikethrough': {
        if (selectedText.startsWith('~~') && selectedText.endsWith('~~') && selectedText.length >= 4) {
          replacement = selectedText.slice(2, -2);
        } else {
          replacement = `~~${selectedText}~~`;
        }
        break;
      }
      case 'highlight': {
        if (selectedText.startsWith('==') && selectedText.endsWith('==') && selectedText.length >= 4) {
          replacement = selectedText.slice(2, -2);
        } else {
          replacement = `==${selectedText}==`;
        }
        break;
      }
      case 'code': {
        if (selectedText.startsWith('`') && selectedText.endsWith('`') && selectedText.length >= 2) {
          replacement = selectedText.slice(1, -1);
        } else {
          replacement = `\`${selectedText}\``;
        }
        break;
      }
      case 'color': {
        if (!payload) {
          const spanMatch = selectedText.match(/^<span[^>]*style="color:\s*[^"]*"[^>]*>([\s\S]*?)<\/span>$/i);
          if (spanMatch) {
            replacement = spanMatch[1];
          } else {
            replacement = selectedText;
          }
        } else {
          replacement = `<span style="color: ${payload}">${selectedText}</span>`;
        }
        break;
      }
      case 'heading': {
        const line = doc.lineAt(from);
        const level = parseInt(payload || '1', 10);
        const cleanLineText = line.text.replace(/^(#{1,6}\s+|>\s*)/, '');
        const newPrefix = level > 0 ? '#'.repeat(level) + ' ' : '';
        const newLineText = newPrefix + cleanLineText;

        view.dispatch({
          changes: { from: line.from, to: line.to, insert: newLineText },
          selection: { anchor: line.from + newLineText.length },
        });
        view.focus();
        return;
      }
      case 'quote': {
        const line = doc.lineAt(from);
        if (line.text.startsWith('> ')) {
          const newLineText = line.text.slice(2);
          view.dispatch({
            changes: { from: line.from, to: line.to, insert: newLineText },
            selection: { anchor: line.from + newLineText.length },
          });
        } else {
          const newLineText = `> ${line.text}`;
          view.dispatch({
            changes: { from: line.from, to: line.to, insert: newLineText },
            selection: { anchor: line.from + newLineText.length },
          });
        }
        view.focus();
        return;
      }
      case 'callout': {
        const line = doc.lineAt(from);
        const typeTag = payload || 'NOTE';
        const cleanLineText = line.text.replace(/^>\s*\[\![A-Z]+\]\s*|^>\s*|^#{1,6}\s*/i, '');
        const newLineText = `> [!${typeTag}] ${cleanLineText || selectedText}\n> `;

        view.dispatch({
          changes: { from: line.from, to: line.to, insert: newLineText },
          selection: { anchor: line.from + newLineText.length },
        });
        view.focus();
        return;
      }
      case 'link': {
        const url = payload || 'https://';
        replacement = `[${selectedText}](${url})`;
        break;
      }
      case 'wikilink': {
        if (selectedText.startsWith('[[') && selectedText.endsWith(']]')) {
          replacement = selectedText.slice(2, -2);
        } else {
          replacement = `[[${selectedText}]]`;
        }
        break;
      }
      default:
        return;
    }

    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: { anchor: from, head: from + replacement.length },
    });
    view.focus();
  }, [selectionBubble]);

  const slashCommands = useMemo(
    () => buildSlashCommands(executeSlashCommand, openImagePicker, openDiagramEditor, openExcalidrawEditor, t),
    [executeSlashCommand, openImagePicker, openDiagramEditor, openExcalidrawEditor, t]
  );

  const editorExtensions = useMemo(() => {
    const exts = [
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      wikilinkAutocomplete,
    ];
    if (editorMode === 'preview') {
      exts.push(livePreviewPlugin);
    }
    return exts;
  }, [editorMode]);

  if (!currentNoteId) {
    return (
      <main className="h-screen flex flex-col bg-mac-mainLight dark:bg-mac-mainDark flex-1 items-center justify-center text-gray-500">
        {t('selectNotePrompt')}
      </main>
    );
  }

  return (
    <main className={cn(
      "h-screen flex flex-col bg-mac-mainLight dark:bg-mac-mainDark transition-all duration-200 ease-mac-ease",
      "flex-1"
    )}>
      {/* Hidden File Input for Image & GIF Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleImageSelect} 
        className="hidden" 
      />

      <EditorHeader
        currentNoteId={currentNoteId}
        localContent={localContent}
        currentTags={currentTags}
        vaultTags={vaultTags}
        rightPanelOpen={rightPanelOpen}
        showTagPopover={showTagPopover}
        onToggleRightPanel={toggleRightPanel}
        onToggleTagPopover={() => setShowTagPopover(!showTagPopover)}
        onCloseTagPopover={() => setShowTagPopover(false)}
        onUpdateTags={(newTags) => { if (currentNoteId) updateNoteTags(currentNoteId, newTags); }}
      />

      {/* CodeMirror Area */}
      <div className="flex-1 overflow-y-auto bg-mac-mainLight dark:bg-mac-mainDark relative">
        <div 
          ref={wrapperRef} 
          className="py-12 relative pl-14 pr-8 md:pr-12"
        >
          <FloatingBlockMenu
            menuPos={menuPos}
            showOptions={showOptions}
            showNotePicker={showNotePicker}
            taskEditBtn={taskEditBtn}
            decisionEditBtn={decisionEditBtn}
            notes={notes}
            onToggleOptions={() => { setShowOptions(!showOptions); setShowNotePicker(false); }}
            onToggleNotePicker={() => setShowNotePicker(!showNotePicker)}
            onInsertText={insertText}
            onOpenTaskModal={handleOpenTaskModal}
            onOpenDecisionModal={handleOpenDecisionModal}
            onOpenImagePicker={() => fileInputRef.current?.click()}
            onOpenDiagramEditor={openDiagramEditor}
            onOpenExcalidrawEditor={openExcalidrawEditor}
          />

          <SelectionBubbleMenu
            bubbleState={selectionBubble}
            onFormat={handleFormat}
          />

          <CodeMirror
            value={localContent}
            onChange={handleUpdate}
            onCreateEditor={(view) => {
              editorRef.current = view;
            }}
            onUpdate={handleEditorUpdate}
            theme={theme === 'dark' ? 'dark' : 'light'}
            extensions={editorExtensions}
            className={cn(
              "text-gray-800 dark:text-gray-200 cm-theme-han",
              fontSize === 'sm' && "cm-fontsize-sm",
              fontSize === 'md' && "cm-fontsize-md",
              fontSize === 'lg' && "cm-fontsize-lg"
            )}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              dropCursor: false,
              allowMultipleSelections: false,
              indentOnInput: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
          />
        </div>
      </div>

      {/* Editor Mode Switcher Footer (Preview / Raw) */}
      <div className="py-2.5 flex items-center justify-center border-t border-gray-200/60 dark:border-zinc-800/80 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md shrink-0 select-none">
        <div className="flex items-center gap-1 p-1 bg-gray-200/60 dark:bg-zinc-800/80 rounded-xl border border-gray-200/50 dark:border-zinc-700/50 shadow-inner">
          <button
            onClick={() => setEditorMode('preview')}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer",
              editorMode === 'preview'
                ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-xs"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            <Eye size={13} className={editorMode === 'preview' ? "text-mac-accent" : ""} />
            {t('modePreview')}
          </button>
          <button
            onClick={() => setEditorMode('raw')}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer",
              editorMode === 'raw'
                ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-xs"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            <FileCode size={13} className={editorMode === 'raw' ? "text-mac-accent" : ""} />
            {t('modeRaw')}
          </button>
        </div>
      </div>

      {/* Task Edit Settings Modal */}
      {taskModalData && (
        <TaskEditModal
          task={taskModalData}
          onSave={handleSaveTaskModal}
          onClose={() => setTaskModalData(null)}
        />
      )}

      {/* Decision Edit Settings Modal */}
      {decisionModalData && (
        <DecisionEditModal
          decision={decisionModalData}
          onSave={handleSaveDecisionModal}
          onClose={() => setDecisionModalData(null)}
        />
      )}

      {/* Diagram Editor Modal (YADA) */}
      <DiagramEditorModal
        isOpen={diagramModalOpen}
        initialMetadata={diagramInitialMetadata}
        onClose={() => setDiagramModalOpen(false)}
        onSave={handleSaveDiagram}
      />

      {/* Excalidraw Editor Modal */}
      <ExcalidrawEditorModal
        isOpen={excalidrawModalOpen}
        initialData={sketchInitialData}
        onClose={() => setExcalidrawModalOpen(false)}
        onSave={handleSaveSketch}
      />

      {/* Delete Image / Diagram Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteData}
        title={t('confirmDeleteTitle')}
        message={
          confirmDeleteData?.isDiagram
            ? t('confirmDeleteDiagramMessage')
            : t('confirmDeleteImageMessage')
        }
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={handleConfirmDeleteImage}
        onClose={() => setConfirmDeleteData(null)}
      />

      {/* Floating Slash Command Menu (fixed to viewport) */}
      {slashMenuState.show && (
        <SlashCommandMenu
          query={slashMenuState.query}
          anchorRect={slashMenuState.anchorRect}
          commands={slashCommands}
          onClose={() => setSlashMenuState((prev) => ({ ...prev, show: false }))}
        />
      )}
    </main>
  );
};
