import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { useTranslation } from 'react-i18next';
import { storage } from '@/services/storage';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

// Editor Plugins & Formatter Utilities
import { livePreviewPlugin } from '@/editor/LivePreviewPlugin';
import { editorAutocomplete } from '@/editor/WikilinkCompletion';
import { smartPastePlugin } from '@/editor/pastePlugin';
import { buildSlashCommands } from '@/editor/slashCommands';
import { applyTextFormat } from '@/editor/formatters';

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
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { MediaFullscreenModal, type FullscreenMediaData } from '@/components/ui/MediaFullscreenModal';

export const MainEditor: React.FC = () => {
  const { t } = useTranslation();
  const { theme, fontSize, editorMode, setEditorMode, rightPanelOpen, toggleRightPanel } = useUiStore();

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
  } = useEditorFloatingUI(wrapperRef);

  // Helper to insert text at current menu or cursor position
  const insertText = useCallback((text: string) => {
    if (editorRef.current) {
      const view = editorRef.current;
      const targetPos = menuPos.lineFrom !== undefined ? menuPos.lineFrom : view.state.selection.main.head;
      view.dispatch({
        changes: { from: targetPos, insert: text },
        selection: { anchor: targetPos + text.length },
      });
      view.focus();
      setShowOptions(false);
      setShowNotePicker(false);
    }
  }, [menuPos.lineFrom, setShowOptions, setShowNotePicker]);

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

  // 5. Fullscreen Media & Delete Modals State
  const [fullscreenMedia, setFullscreenMedia] = useState<FullscreenMediaData | null>(null);
  const [confirmDeleteData, setConfirmDeleteData] = useState<{
    from: number;
    to: number;
    isDiagram: boolean;
    relPath: string;
  } | null>(null);

  useEffect(() => {
    const handleFullscreenRequest = (e: CustomEvent<FullscreenMediaData>) => {
      setFullscreenMedia(e.detail);
    };
    const handleDeleteRequest = (e: CustomEvent<{ from: number; to: number; isDiagram: boolean; relPath: string }>) => {
      setConfirmDeleteData(e.detail);
    };

    window.addEventListener('open-image-fullscreen', handleFullscreenRequest as EventListener);
    window.addEventListener('request-delete-image', handleDeleteRequest as EventListener);

    return () => {
      window.removeEventListener('open-image-fullscreen', handleFullscreenRequest as EventListener);
      window.removeEventListener('request-delete-image', handleDeleteRequest as EventListener);
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

  const inlineAiContext = useMemo(() => {
    if (!editorRef.current || !currentNoteId || !inlineAiState.isOpen) return undefined;
    const view = editorRef.current;
    const doc = view.state.doc;
    const lineFrom = inlineAiState.lineFrom;
    const beforeText = doc.sliceString(Math.max(0, lineFrom - 1500), lineFrom);
    const afterText = doc.sliceString(lineFrom, Math.min(doc.length, lineFrom + 1500));
    const foundNote = otherNotes.find((n) => n.id === currentNoteId);
    const noteTitle = foundNote?.title || currentNoteId.split('/').pop() || currentNoteId;

    return {
      noteId: currentNoteId,
      noteTitle,
      beforeText,
      afterText,
    };
  }, [currentNoteId, inlineAiState.isOpen, inlineAiState.lineFrom, otherNotes]);

  const handleInsertInlineAiMarkdown = useCallback((text: string) => {
    if (!editorRef.current) return;
    const view = editorRef.current;
    const targetPos = inlineAiState.lineFrom;
    const formattedText = text.trim() + '\n\n';
    view.dispatch({
      changes: { from: targetPos, insert: formattedText },
      selection: { anchor: targetPos + formattedText.length },
      scrollIntoView: true,
    });
    view.focus();
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
  const editorExtensions = useMemo(() => {
    const exts = [
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      editorAutocomplete,
      smartPastePlugin,
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
      <div className="flex-1 overflow-y-auto bg-mac-mainLight dark:bg-mac-mainDark relative scroll-smooth overscroll-contain">
        <div ref={wrapperRef} className="py-12 relative pl-14 pr-8 md:pr-12">
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
      <MediaFullscreenModal
        data={fullscreenMedia}
        onClose={() => setFullscreenMedia(null)}
      />

      {/* Floating Slash Command Menu */}
      {slashMenuState.show && (
        <SlashCommandMenu
          query={slashMenuState.query}
          anchorRect={slashMenuState.anchorRect}
          commands={slashCommands}
          onClose={() => setSlashMenuState((prev) => ({ ...prev, show: false }))}
        />
      )}

      {/* Visual Emoji Picker Popover */}
      <EmojiPickerPopover
        isOpen={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        onSelectEmoji={(emoji) => insertText(emoji + ' ')}
      />

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
