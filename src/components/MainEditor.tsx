import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { invoke } from '@tauri-apps/api/core';
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
import { TaskEditModal } from '@/components/TaskEditModal';
import type { TaskEditData } from '@/components/TaskEditModal';
import { DecisionEditModal } from '@/components/DecisionEditModal';
import type { DecisionEditData } from '@/components/DecisionEditModal';
import { useTranslation } from 'react-i18next';
import { SlashCommandMenu } from '@/components/SlashCommandMenu';
import { cn } from '@/lib/utils';



export const MainEditor: React.FC = () => {
  const { rightPanelOpen, toggleRightPanel, theme } = useUiStore();
  const { currentNoteId, currentNoteContent, updateNote, selectNote, notes, vaultTags, updateNoteTags } = useNoteStore();
  const { updateTaskMetadata } = useTaskStore();
  const { updateDecisionMetadata } = useDecisionStore();
  const { t } = useTranslation();
  
  const [localContent, setLocalContent] = useState('');
  const [showTagPopover, setShowTagPopover] = useState(false);

  const currentNote = notes.find((n: NoteInfo) => n.id === currentNoteId);
  const currentTags = currentNote?.tags || [];

  // Task & Decision Edit Modal state
  const [taskModalData, setTaskModalData] = useState<TaskEditData | null>(null);
  const [decisionModalData, setDecisionModalData] = useState<DecisionEditData | null>(null);

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
    slashMenuState, setSlashMenuState,
    slashStateRef,
    handleEditorUpdate,
  } = useEditorFloatingUI(wrapperRef);

  useEffect(() => {
    setLocalContent(currentNoteContent);
  }, [currentNoteId, currentNoteContent]);

  const handleUpdate = (val: string) => {
    setLocalContent(val);
    updateNote(val);
  };

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
      const bytes = Array.from(new Uint8Array(arrayBuffer));
      const relPath = await invoke<string>('save_image_bytes', {
        relativeNoteId: currentNoteId,
        fileName: file.name,
        bytes,
      });

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

  const slashCommands = useMemo(
    () => buildSlashCommands(executeSlashCommand, openImagePicker, t),
    [executeSlashCommand, openImagePicker, t]
  );

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
          className={cn(
            "py-12 relative transition-all duration-200 w-full mx-auto px-8 md:px-12",
            rightPanelOpen ? "max-w-3xl" : "max-w-5xl"
          )}
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
          />

          <CodeMirror
            value={localContent}
            onChange={handleUpdate}
            onCreateEditor={(view) => {
              editorRef.current = view;
            }}
            onUpdate={handleEditorUpdate}
            theme={theme === 'dark' ? 'dark' : 'light'}
            extensions={[
              EditorView.lineWrapping,
              markdown({ base: markdownLanguage, codeLanguages: languages }),
              syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
              livePreviewPlugin,
              wikilinkAutocomplete,
            ]}
            className="text-lg text-gray-800 dark:text-gray-200 cm-theme-han"
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
