import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { hanHighlightStyle, hanHighlightStyleDark } from '@/editor/hanHighlightStyle';
import { useTranslation } from 'react-i18next';
import { storage } from '@/services/storage';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

// Editor Plugins & Formatter Utilities
import { livePreviewPlugin, clearLivePreviewCaches } from '@/editor/LivePreviewPlugin';
import { previewAutocomplete, rawAutocomplete } from '@/editor/WikilinkCompletion';
import { smartPastePlugin } from '@/editor/pastePlugin';
import { buildSlashCommands } from '@/editor/slashCommands';
import { applyTextFormat } from '@/editor/formatters';
import { prepareSafeDocumentInsertion } from '@/utils/markdownSanitizer';

// Custom Hooks
import { useNoteContent } from '@/hooks/useNoteContent';
import { useEditorFloatingUI } from '@/hooks/useEditorFloatingUI';
import { useDiagramManager } from '@/hooks/useDiagramManager';
import { useTaskDecisionModals } from '@/hooks/useTaskDecisionModals';

// Sub-Components & Menus
import { EditorHeader } from '@/components/EditorHeader';
import { EditorFooter } from '@/components/EditorFooter';
import { FloatingBlockMenu } from '@/components/FloatingBlockMenu';
import { SelectionBubbleMenu, type FormatType } from '@/components/SelectionBubbleMenu';
import { SlashCommandMenu } from '@/components/SlashCommandMenu';
import { EmojiPickerPopover } from '@/components/ui/EmojiPickerPopover';
import { InlineAiComposer } from '@/components/ai/InlineAiComposer';

// Modals
import { TaskEditModal } from '@/components/TaskEditModal';
import { DecisionEditModal } from '@/components/DecisionEditModal';
import { DiagramEditorModal } from '@/components/DiagramEditorModal';
import { ExcalidrawEditorModal } from '@/components/ExcalidrawEditorModal';
import { MermaidEditorModal, type MermaidSavePayload } from '@/components/MermaidEditorModal';
import { CodeEditorModal, type CodeSavePayload } from '@/components/CodeEditorModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { MediaFullscreenModal, type FullscreenMediaData } from '@/components/ui/MediaFullscreenModal';

export const MainEditor: React.FC = () => {
  const { t } = useTranslation();
  // Individual Zustand selectors — only re-render when the specific field changes
  const theme = useUiStore(s => s.theme);
  const fontSize = useUiStore(s => s.fontSize);
  const editorMode = useUiStore(s => s.editorMode);
  const setEditorMode = useUiStore(s => s.setEditorMode);
  const rightPanelOpen = useUiStore(s => s.rightPanelOpen);
  const toggleRightPanel = useUiStore(s => s.toggleRightPanel);

  const editorRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Note Content & Persistence Hook
  const {
    currentNoteId,
    otherNotes,
    localContent,
    handleUpdate,
    currentTags,
    vaultTags,
    showTagPopover,
    setShowTagPopover,
    updateNoteTags,
  } = useNoteContent();

  // 2. Floating UI Hook (Block actions, task/decision hover, selection bubble, slash command state)
  const {
    menuPos,
    showOptions,
    setShowOptions,
    showNotePicker,
    setShowNotePicker,
    taskEditBtn,
    decisionEditBtn,
    selectionBubble,
    slashMenuState,
    setSlashMenuState,
    slashStateRef,
    handleEditorUpdate,
  } = useEditorFloatingUI(wrapperRef, editorMode);

  // Stable ref for menuPos — avoids recreating insertText on every cursor movement
  const menuPosRef = useRef(menuPos);
  menuPosRef.current = menuPos;

  // Helper to insert text at current menu or cursor position
  const insertText = useCallback((text: string) => {
    if (editorRef.current) {
      const view = editorRef.current;
      const targetPos = menuPosRef.current.lineFrom !== undefined ? menuPosRef.current.lineFrom : view.state.selection.main.head;
      view.dispatch({
        changes: { from: targetPos, insert: text },
        selection: { anchor: targetPos + text.length },
      });
      view.focus();
      setShowOptions(false);
      setShowNotePicker(false);
    }
  }, [setShowOptions, setShowNotePicker]);

  // Scroll-to-heading: listen for clicks on outline items in RightPanel
  useEffect(() => {
    const handler = (e: CustomEvent<{ line: number }>) => {
      const view = editorRef.current;
      if (!view) return;
      const lineNum = e.detail.line + 1; // outline uses 0-indexed, CodeMirror doc uses 1-indexed
      const doc = view.state.doc;
      if (lineNum < 1 || lineNum > doc.lines) return;
      const line = doc.line(lineNum);
      // Move cursor to the heading line and scroll it into view
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 80 }),
      });
      view.focus();
    };
    window.addEventListener('scroll-to-heading', handler as EventListener);
    return () => window.removeEventListener('scroll-to-heading', handler as EventListener);
  }, []);

  // 3. Diagrams & Sketches Hook (YADA & Excalidraw)
  const {
    diagramModalOpen,
    setDiagramModalOpen,
    diagramInitialMetadata,
    openDiagramEditor,
    handleSaveDiagram,
    excalidrawModalOpen,
    setExcalidrawModalOpen,
    sketchInitialData,
    openExcalidrawEditor,
    handleSaveSketch,
  } = useDiagramManager(currentNoteId, insertText);

  // 4. Task & Decision Modals Hook
  const {
    taskModalData,
    setTaskModalData,
    decisionModalData,
    setDecisionModalData,
    handleOpenTaskModal,
    handleSaveTaskModal,
    handleOpenDecisionModal,
    handleSaveDecisionModal,
  } = useTaskDecisionModals(currentNoteId);

  // 5. Fullscreen Media, Delete Modals & Mermaid State
  const [fullscreenMedia, setFullscreenMedia] = useState<FullscreenMediaData | null>(null);
  const [confirmDeleteData, setConfirmDeleteData] = useState<{
    from: number;
    to: number;
    isDiagram: boolean;
    relPath: string;
  } | null>(null);

  const [mermaidModalData, setMermaidModalData] = useState<{
    isOpen: boolean;
    initialCode?: string;
    width?: number | null;
    from?: number;
    to?: number;
  }>({ isOpen: false });

  const [confirmDeleteMermaidData, setConfirmDeleteMermaidData] = useState<{
    from: number;
    to: number;
  } | null>(null);

  const [codeModalData, setCodeModalData] = useState<{
    isOpen: boolean;
    initialCode?: string;
    initialLang?: string;
    from?: number;
    to?: number;
  }>({ isOpen: false });

  const [confirmDeleteCodeBlockData, setConfirmDeleteCodeBlockData] = useState<{
    from: number;
    to: number;
  } | null>(null);

  useEffect(() => {
    const handleFullscreenRequest = (e: CustomEvent<FullscreenMediaData>) => {
      setFullscreenMedia(e.detail);
    };
    const handleDeleteRequest = (e: CustomEvent<{ from: number; to: number; isDiagram: boolean; relPath: string }>) => {
      setConfirmDeleteData(e.detail);
    };
    const handleEditMermaid = (e: CustomEvent<{ code: string; width?: number | null; from: number; to: number }>) => {
      setMermaidModalData({
        isOpen: true,
        initialCode: e.detail.code,
        width: e.detail.width,
        from: e.detail.from,
        to: e.detail.to,
      });
    };
    const handleDeleteMermaidRequest = (e: CustomEvent<{ from: number; to: number }>) => {
      setConfirmDeleteMermaidData(e.detail);
    };
    const handleEditCodeBlock = (e: CustomEvent<{ code: string; lang: string; from: number; to: number }>) => {
      setCodeModalData({
        isOpen: true,
        initialCode: e.detail.code,
        initialLang: e.detail.lang,
        from: e.detail.from,
        to: e.detail.to,
      });
    };
    const handleDeleteCodeBlockRequest = (e: CustomEvent<{ from: number; to: number }>) => {
      setConfirmDeleteCodeBlockData(e.detail);
    };

    window.addEventListener('open-image-fullscreen', handleFullscreenRequest as EventListener);
    window.addEventListener('request-delete-image', handleDeleteRequest as EventListener);
    window.addEventListener('edit-mermaid', handleEditMermaid as EventListener);
    window.addEventListener('request-delete-mermaid', handleDeleteMermaidRequest as EventListener);
    window.addEventListener('edit-code-block', handleEditCodeBlock as EventListener);
    window.addEventListener('request-delete-code-block', handleDeleteCodeBlockRequest as EventListener);

    return () => {
      window.removeEventListener('open-image-fullscreen', handleFullscreenRequest as EventListener);
      window.removeEventListener('request-delete-image', handleDeleteRequest as EventListener);
      window.removeEventListener('edit-mermaid', handleEditMermaid as EventListener);
      window.removeEventListener('request-delete-mermaid', handleDeleteMermaidRequest as EventListener);
      window.removeEventListener('edit-code-block', handleEditCodeBlock as EventListener);
      window.removeEventListener('request-delete-code-block', handleDeleteCodeBlockRequest as EventListener);
    };
  }, []);

  const handleConfirmDeleteImage = useCallback(() => {
    if (!confirmDeleteData || !editorRef.current) return;
    const { from, to } = confirmDeleteData;
    editorRef.current.dispatch({
      changes: { from, to, insert: '' },
    });
    setConfirmDeleteData(null);
  }, [confirmDeleteData]);

  const handleConfirmDeleteMermaid = useCallback(() => {
    if (!confirmDeleteMermaidData || !editorRef.current) return;
    const { from, to } = confirmDeleteMermaidData;
    const doc = editorRef.current.state.doc;
    let delFrom = from;
    let delTo = to;
    if (delTo < doc.length) {
      delTo += 1;
    } else if (delFrom > 0) {
      delFrom -= 1;
    }
    clearLivePreviewCaches();
    editorRef.current.dispatch({
      changes: { from: delFrom, to: delTo, insert: '' },
    });
    setConfirmDeleteMermaidData(null);
  }, [confirmDeleteMermaidData]);

  const handleConfirmDeleteCodeBlock = useCallback(() => {
    if (!confirmDeleteCodeBlockData || !editorRef.current) return;
    const { from, to } = confirmDeleteCodeBlockData;
    const doc = editorRef.current.state.doc;
    let delFrom = from;
    let delTo = to;
    if (delTo < doc.length) {
      delTo += 1;
    } else if (delFrom > 0) {
      delFrom -= 1;
    }
    clearLivePreviewCaches();
    editorRef.current.dispatch({
      changes: { from: delFrom, to: delTo, insert: '' },
    });
    setConfirmDeleteCodeBlockData(null);
  }, [confirmDeleteCodeBlockData]);

  const handleSaveMermaid = useCallback((payload: MermaidSavePayload) => {
    if (!editorRef.current) return;
    const view = editorRef.current;
    const widthParam = payload.width ? `|${payload.width}` : '';
    const formatted = `\`\`\`mermaid${widthParam}\n${payload.code.trim()}\n\`\`\``;
    clearLivePreviewCaches();
    if (payload.from !== undefined && payload.to !== undefined) {
      view.dispatch({
        changes: { from: payload.from, to: payload.to, insert: formatted },
        selection: { anchor: payload.from + formatted.length },
      });
    } else {
      insertText(`\n${formatted}\n`);
    }
    view.focus();
  }, [insertText]);

  const handleSaveCodeBlock = useCallback((payload: CodeSavePayload) => {
    if (!editorRef.current) return;
    const view = editorRef.current;
    const lang = payload.lang ? payload.lang.trim() : '';
    const formatted = `\`\`\`${lang}\n${payload.code}\n\`\`\``;
    clearLivePreviewCaches();
    if (payload.from !== undefined && payload.to !== undefined) {
      view.dispatch({
        changes: { from: payload.from, to: payload.to, insert: formatted },
        selection: { anchor: payload.from + formatted.length },
      });
    } else {
      insertText(`\n${formatted}\n`);
    }
    view.focus();
  }, [insertText]);

  // 6. Image Upload Handler
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentNoteId) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const relPath = await storage.saveImageBytes(currentNoteId, file.name, bytes);
      insertText(`![${file.name}|400](${relPath})\n`);
    } catch (err) {
      console.error("Failed to upload image:", err);
    } finally {
      if (e.target) e.target.value = '';
    }
  }, [currentNoteId, insertText]);

  // 7. Slash Commands Execution & Menu
  const executeSlashCommand = useCallback((insertStr: string, opts?: { cursorOffset?: number; openTagModal?: boolean }) => {
    const state = slashStateRef.current;
    if (editorRef.current && state.show) {
      const view = editorRef.current;
      const { slashFrom, slashTo } = state;
      const cursorPos = slashFrom + (opts?.cursorOffset ?? insertStr.length);

      view.dispatch({
        changes: { from: slashFrom, to: slashTo, insert: insertStr },
        selection: { anchor: cursorPos },
        scrollIntoView: true,
      });
      requestAnimationFrame(() => view.focus());
    }
    setSlashMenuState((prev) => ({ ...prev, show: false }));
    if (opts?.openTagModal) {
      setTimeout(() => setShowTagPopover(true), 50);
    }
  }, [slashStateRef, setSlashMenuState, setShowTagPopover]);

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [inlineAiState, setInlineAiState] = useState<{ isOpen: boolean; top: number; lineFrom: number }>({
    isOpen: false,
    top: 0,
    lineFrom: 0,
  });

  // Stable ref for otherNotes — prevents inlineAiContext from recomputing when note list changes while AI composer is closed
  const otherNotesRef = useRef(otherNotes);
  otherNotesRef.current = otherNotes;

  const inlineAiContext = useMemo(() => {
    if (!editorRef.current || !currentNoteId || !inlineAiState.isOpen) return undefined;
    const view = editorRef.current;
    const doc = view.state.doc;
    const lineFrom = inlineAiState.lineFrom;
    const beforeText = doc.sliceString(Math.max(0, lineFrom - 1500), lineFrom);
    const afterText = doc.sliceString(lineFrom, Math.min(doc.length, lineFrom + 1500));
    const foundNote = otherNotesRef.current.find((n) => n.id === currentNoteId);
    const noteTitle = foundNote?.title || currentNoteId.split('/').pop() || currentNoteId;

    return {
      noteId: currentNoteId,
      noteTitle,
      beforeText,
      afterText,
    };
  }, [currentNoteId, inlineAiState.isOpen, inlineAiState.lineFrom]);

  const handleInsertInlineAiMarkdown = useCallback((text: string) => {
    if (!editorRef.current) return;
    const view = editorRef.current;
    const doc = view.state.doc;
    const targetPos = inlineAiState.lineFrom;

    const { safeFrom, safeInsertText } = prepareSafeDocumentInsertion(
      doc.toString(),
      targetPos,
      text
    );

    if (safeInsertText) {
      clearLivePreviewCaches();
      view.dispatch({
        changes: { from: safeFrom, insert: safeInsertText },
        selection: { anchor: safeFrom + safeInsertText.length },
        scrollIntoView: true,
      });
      view.focus();
    }
    setInlineAiState((prev) => ({ ...prev, isOpen: false }));
  }, [inlineAiState.lineFrom]);

  const slashCommands = useMemo(
    () =>
      buildSlashCommands(
        executeSlashCommand,
        () => fileInputRef.current?.click(),
        openDiagramEditor,
        openExcalidrawEditor,
        () => setEmojiPickerOpen(true),
        () => setMermaidModalData({ isOpen: true }),
        (lang) => setCodeModalData({ isOpen: true, initialLang: lang || 'typescript', initialCode: '' }),
        t
      ),
    [executeSlashCommand, openDiagramEditor, openExcalidrawEditor, t]
  );

  // 8. Text Formatting Handler (delegates to pure formatter utility)
  const handleFormat = useCallback((type: FormatType, payload?: string) => {
    if (!editorRef.current) return;
    applyTextFormat(editorRef.current, selectionBubble, type, payload);
  }, [selectionBubble]);

  // 9. CodeMirror Extensions Memo
  const isDarkTheme = ['dark', 'dracula', 'synthwave'].includes(theme);
  const editorExtensions = useMemo(() => {
    const activeHighlightStyle = isDarkTheme ? hanHighlightStyleDark : hanHighlightStyle;
    const exts = [
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(activeHighlightStyle),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      smartPastePlugin,
    ];
    if (editorMode === 'preview') {
      exts.push(previewAutocomplete);
      exts.push(livePreviewPlugin);
    } else {
      exts.push(rawAutocomplete);
    }
    return exts;
  }, [editorMode, isDarkTheme]);

  if (!currentNoteId) {
    return (
      <main className="h-screen flex flex-col bg-mac-mainLight dark:bg-mac-mainDark flex-1 items-center justify-center text-gray-500">
        {t('selectNotePrompt')}
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-mac-mainLight dark:bg-mac-mainDark transition-all duration-200 ease-mac-ease flex-1">
      {/* Hidden File Input for Image & GIF Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Editor Header */}
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

      {/* CodeMirror Workspace Area */}
      <div className="flex-1 overflow-y-auto bg-mac-mainLight dark:bg-mac-mainDark relative overscroll-contain">
        <div
          ref={wrapperRef}
          className={cn(
            "py-12 relative pr-8 md:pr-12",
            editorMode === 'preview' ? "pl-14" : "pl-8 md:pl-12"
          )}
        >
          {editorMode === 'preview' && (
            <>
              <FloatingBlockMenu
                menuPos={menuPos}
                showOptions={showOptions}
                showNotePicker={showNotePicker}
                taskEditBtn={taskEditBtn}
                decisionEditBtn={decisionEditBtn}
                notes={otherNotes}
                onToggleOptions={() => { setShowOptions(!showOptions); setShowNotePicker(false); }}
                onToggleNotePicker={() => setShowNotePicker(!showNotePicker)}
                onInsertText={insertText}
                onOpenTaskModal={() => handleOpenTaskModal(taskEditBtn)}
                onOpenDecisionModal={() => handleOpenDecisionModal(decisionEditBtn)}
                onOpenImagePicker={() => fileInputRef.current?.click()}
                onOpenDiagramEditor={openDiagramEditor}
                onOpenExcalidrawEditor={openExcalidrawEditor}
                onOpenInlineAi={() => setInlineAiState({ isOpen: true, top: menuPos.top, lineFrom: menuPos.lineFrom })}
              />

              <SelectionBubbleMenu
                bubbleState={selectionBubble}
                onFormat={handleFormat}
              />
            </>
          )}

          <CodeMirror
            value={localContent}
            onChange={handleUpdate}
            onCreateEditor={(view) => { editorRef.current = view; }}
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

      {/* Mode Switcher Footer (Preview / Raw) */}
      <EditorFooter
        editorMode={editorMode}
        onSetEditorMode={setEditorMode}
      />

      {/* Task & Decision Edit Modals */}
      {taskModalData && (
        <TaskEditModal
          task={taskModalData}
          onSave={handleSaveTaskModal}
          onClose={() => setTaskModalData(null)}
        />
      )}
      {decisionModalData && (
        <DecisionEditModal
          decision={decisionModalData}
          onSave={handleSaveDecisionModal}
          onClose={() => setDecisionModalData(null)}
        />
      )}

      {/* YADA Diagram & Excalidraw Modals */}
      <DiagramEditorModal
        isOpen={diagramModalOpen}
        initialMetadata={diagramInitialMetadata}
        onClose={() => setDiagramModalOpen(false)}
        onSave={handleSaveDiagram}
      />
      <ExcalidrawEditorModal
        isOpen={excalidrawModalOpen}
        initialData={sketchInitialData}
        onClose={() => setExcalidrawModalOpen(false)}
        onSave={handleSaveSketch}
      />

      {/* Mermaid Editor Modal */}
      <MermaidEditorModal
        isOpen={mermaidModalData.isOpen}
        initialCode={mermaidModalData.initialCode}
        width={mermaidModalData.width}
        from={mermaidModalData.from}
        to={mermaidModalData.to}
        onClose={() => setMermaidModalData({ isOpen: false })}
        onSave={handleSaveMermaid}
      />

      {/* Code Block Editor Modal */}
      <CodeEditorModal
        isOpen={codeModalData.isOpen}
        initialCode={codeModalData.initialCode}
        initialLang={codeModalData.initialLang}
        from={codeModalData.from}
        to={codeModalData.to}
        onClose={() => setCodeModalData({ isOpen: false })}
        onSave={handleSaveCodeBlock}
      />

      {/* Confirm Delete & Fullscreen Media Modals */}
      <ConfirmModal
        isOpen={!!confirmDeleteData}
        title={t('confirmDeleteTitle')}
        message={confirmDeleteData?.isDiagram ? t('confirmDeleteDiagramMessage') : t('confirmDeleteImageMessage')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={handleConfirmDeleteImage}
        onClose={() => setConfirmDeleteData(null)}
      />
      <ConfirmModal
        isOpen={!!confirmDeleteMermaidData}
        title={t('confirmDeleteMermaidTitle', 'Diyagramı Sil')}
        message={t('confirmDeleteMermaidMessage', 'Bu Mermaid diyagramını nottan kaldırmak istediğinize emin misiniz?')}
        confirmLabel={t('delete', 'Sil')}
        cancelLabel={t('cancel', 'İptal')}
        onConfirm={handleConfirmDeleteMermaid}
        onClose={() => setConfirmDeleteMermaidData(null)}
      />
      <ConfirmModal
        isOpen={!!confirmDeleteCodeBlockData}
        title={t('confirmDeleteCodeTitle', 'Kod Bloğunu Sil')}
        message={t('confirmDeleteCodeMessage', 'Bu kod bloğunu nottan kaldırmak istediğinize emin misiniz?')}
        confirmLabel={t('delete', 'Sil')}
        cancelLabel={t('cancel', 'İptal')}
        onConfirm={handleConfirmDeleteCodeBlock}
        onClose={() => setConfirmDeleteCodeBlockData(null)}
      />
      <MediaFullscreenModal
        data={fullscreenMedia}
        onClose={() => setFullscreenMedia(null)}
      />

      {/* Floating Slash Command Menu (Preview mode only) */}
      {editorMode === 'preview' && slashMenuState.show && (
        <SlashCommandMenu
          query={slashMenuState.query}
          anchorRect={slashMenuState.anchorRect}
          commands={slashCommands}
          onClose={() => setSlashMenuState((prev) => ({ ...prev, show: false }))}
        />
      )}

      {/* Visual Emoji Picker Popover (Preview mode only) */}
      {editorMode === 'preview' && (
        <EmojiPickerPopover
          isOpen={emojiPickerOpen}
          onClose={() => setEmojiPickerOpen(false)}
          onSelectEmoji={(emoji) => insertText(emoji + ' ')}
        />
      )}

      {/* Inline AI Paragraph & Content Generator Modal */}
      <InlineAiComposer
        isOpen={inlineAiState.isOpen}
        onClose={() => setInlineAiState((prev) => ({ ...prev, isOpen: false }))}
        onInsertMarkdown={handleInsertInlineAiMarkdown}
        surroundingContext={inlineAiContext}
      />
    </main>
  );
};
