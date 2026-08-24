/**
 * MainEditor.tsx — Primary Note Editor Coordinator.
 * Manages active note state, tag updates, and switches
 * between LivePreviewEditor (WYSIWYG) and RawSourceEditor (Plain-text code editor).
 */
import React, { useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { storage } from '@/services/storage';
import { useUiStore } from '@/store/uiStore';
import { eventBus } from '@/lib/eventBus';

// Custom Hooks
import { useNoteContent } from '@/hooks/useNoteContent';
import { useDiagramManager } from '@/hooks/useDiagramManager';
import { useTaskDecisionModals } from '@/hooks/useTaskDecisionModals';

// Core Editor Engines & Header
import { LivePreviewEditor } from '@/components/editor/LivePreviewEditor';
import { RawSourceEditor } from '@/components/editor/RawSourceEditor';
import { EditorHeader } from '@/components/EditorHeader';
import { EditorModalCoordinator } from '@/components/editor/EditorModalCoordinator';

export const MainEditor: React.FC = () => {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const fontSize = useUiStore((s) => s.fontSize);
  const editorMode = useUiStore((s) => s.editorMode);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);

  const editorRef = useRef<any>(null);
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

  // Stable insertText helper for diagram & asset hooks
  const insertText = useCallback((text: string) => {
    if (editorRef.current) {
      const view = editorRef.current;
      const targetPos = view.state.selection?.main?.head || view.state.doc.length;
      view.dispatch({
        changes: { from: targetPos, insert: text },
        selection: { anchor: targetPos + text.length },
      });
      view.focus();
    }
  }, []);

  // 2. Diagrams & Sketches Hook (YADA & Excalidraw)
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
  } = useDiagramManager(currentNoteId, insertText, editorRef);

  // 3. Task & Decision Modals Hook
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

  // 4. Inline AI State
  const [inlineAiState, setInlineAiState] = useState<{
    isOpen: boolean;
    top: number;
    lineFrom?: number;
  }>({ isOpen: false, top: 0 });

  // Image Upload Handler
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentNoteId || !editorRef.current) return;

    try {
      const buffer = await file.arrayBuffer();
      const relativePath = await storage.saveImageBytes(currentNoteId, file.name, new Uint8Array(buffer));
      const markdownImage = `![${file.name}](${relativePath})\n`;
      insertText(markdownImage);
    } catch (err) {
      console.error('Failed to save image attachment:', err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!currentNoteId) {
    return (
      <main className="h-full flex flex-col bg-mac-mainLight dark:bg-mac-mainDark flex-1 items-center justify-center text-gray-500">
        {t('selectNotePrompt')}
      </main>
    );
  }

  return (
    <main className="h-full flex flex-col bg-mac-mainLight dark:bg-mac-mainDark transition-all duration-200 ease-mac-ease flex-1 min-h-0 overflow-hidden">
      {/* Hidden File Input for Image Upload */}
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
        onUpdateTags={(newTags) => {
          if (currentNoteId) updateNoteTags(currentNoteId, newTags);
        }}
      />

      {/* Primary Editor Engine Switcher */}
      {editorMode === 'preview' ? (
        <LivePreviewEditor
          value={localContent}
          onChange={handleUpdate}
          editorRef={editorRef}
          theme={theme}
          fontSize={fontSize}
          currentNoteId={currentNoteId}
          otherNotes={otherNotes}
          onOpenDiagramEditor={openDiagramEditor}
          onOpenExcalidrawEditor={openExcalidrawEditor}
          onOpenImagePicker={() => fileInputRef.current?.click()}
          onOpenTaskModal={handleOpenTaskModal}
          onOpenDecisionModal={handleOpenDecisionModal}
          onOpenMermaidModal={() => eventBus.emit('modal:edit-mermaid', { code: '' })}
          onOpenCodeModal={(lang) =>
            eventBus.emit('modal:edit-code-block', { code: '', lang: lang || 'typescript' })
          }
          onOpenInlineAi={(top, lineFrom) => setInlineAiState({ isOpen: true, top, lineFrom })}
        />
      ) : (
        <RawSourceEditor
          value={localContent}
          onChange={handleUpdate}
          editorRef={editorRef}
          theme={theme}
          fontSize={fontSize}
        />
      )}

      {/* Centralized Modals Coordinator */}
      <EditorModalCoordinator
        editorRef={editorRef}
        currentNoteId={currentNoteId}
        otherNotes={otherNotes}
        diagramModalOpen={diagramModalOpen}
        setDiagramModalOpen={setDiagramModalOpen}
        diagramInitialMetadata={diagramInitialMetadata}
        handleSaveDiagram={handleSaveDiagram}
        excalidrawModalOpen={excalidrawModalOpen}
        setExcalidrawModalOpen={setExcalidrawModalOpen}
        sketchInitialData={sketchInitialData}
        handleSaveSketch={handleSaveSketch}
        taskModalData={taskModalData}
        setTaskModalData={setTaskModalData}
        handleSaveTaskModal={handleSaveTaskModal}
        decisionModalData={decisionModalData}
        setDecisionModalData={setDecisionModalData}
        handleSaveDecisionModal={handleSaveDecisionModal}
        inlineAiState={inlineAiState}
        setInlineAiState={setInlineAiState}
      />
    </main>
  );
};
