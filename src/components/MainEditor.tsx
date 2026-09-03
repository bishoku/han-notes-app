/**
 * MainEditor.tsx — Primary Note Editor Coordinator.
 * Manages active note state, tag updates, and switches
 * between LivePreviewEditor (WYSIWYG) and RawSourceEditor (Plain-text code editor).
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
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
import { PdfSplitViewer } from '@/components/pdf/PdfSplitViewer';
import { formatPdfQuote } from '@/utils/pdfQuoteFormatter';

export const MainEditor: React.FC = () => {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const fontSize = useUiStore((s) => s.fontSize);
  const editorMode = useUiStore((s) => s.editorMode);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const pdfSplitReader = useUiStore((s) => s.pdfSplitReader);
  const closePdfSplitReader = useUiStore((s) => s.closePdfSplitReader);

  const editorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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

  // Close PDF split reader when user switches to a different note
  const prevNoteIdRef = useRef(currentNoteId);
  useEffect(() => {
    if (prevNoteIdRef.current && prevNoteIdRef.current !== currentNoteId) {
      closePdfSplitReader();
    }
    prevNoteIdRef.current = currentNoteId;
  }, [currentNoteId, closePdfSplitReader]);

  // Stable insertText helper for quotes, diagrams & asset hooks
  const insertText = useCallback(
    (text: string, explicitPos?: number) => {
      if (editorRef.current) {
        const view = editorRef.current;
        const targetPos = typeof explicitPos === 'number' && explicitPos >= 0 && explicitPos <= view.state.doc.length
          ? explicitPos
          : view.state.selection?.main?.head ?? view.state.doc.length;

        let textToInsert = text;
        if (targetPos > 0) {
          const prevChar = view.state.doc.sliceString(targetPos - 1, targetPos);
          if (prevChar !== '\n' && !textToInsert.startsWith('\n')) {
            textToInsert = '\n' + textToInsert;
          }
        }
        if (targetPos < view.state.doc.length) {
          const nextChar = view.state.doc.sliceString(targetPos, targetPos + 1);
          if (nextChar !== '\n' && !textToInsert.endsWith('\n')) {
            textToInsert = textToInsert + '\n';
          }
        }

        view.dispatch({
          changes: { from: targetPos, insert: textToInsert },
          selection: { anchor: targetPos + textToInsert.length },
          scrollIntoView: true,
        });
        view.focus();
        handleUpdate(view.state.doc.toString());
      } else {
        const newContent = (localContent ? localContent + '\n' : '') + text;
        handleUpdate(newContent);
      }
    },
    [handleUpdate, localContent]
  );

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
  const imageInsertPosRef = useRef<number | null>(null);
  const handleOpenImagePicker = useCallback((targetPos?: number) => {
    if (typeof targetPos === 'number') {
      imageInsertPosRef.current = targetPos;
    } else if (editorRef.current) {
      imageInsertPosRef.current = editorRef.current.state.selection.main.head;
    } else {
      imageInsertPosRef.current = null;
    }
    fileInputRef.current?.click();
  }, [editorRef]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentNoteId || !editorRef.current) return;

    try {
      const buffer = await file.arrayBuffer();
      const relativePath = await storage.saveImageBytes(currentNoteId, file.name, new Uint8Array(buffer));
      const markdownImage = `![${file.name}](${relativePath})\n`;
      insertText(markdownImage, imageInsertPosRef.current ?? undefined);
    } catch (err) {
      console.error('Failed to save image attachment:', err);
    } finally {
      imageInsertPosRef.current = null;
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // PDF Upload Handler
  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      eventBus.emit('modal:pdf-import', { file, buffer });
    } catch (err) {
      console.error('Failed to read PDF file:', err);
    } finally {
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  }, [isDraggingOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const buffer = await file.arrayBuffer();
      eventBus.emit('modal:pdf-import', { file, buffer });
      return;
    }

    if (file.type.startsWith('image/')) {
      if (!currentNoteId) return;
      try {
        const buffer = await file.arrayBuffer();
        const relativePath = await storage.saveImageBytes(currentNoteId, file.name, new Uint8Array(buffer));
        const markdownImage = `![${file.name}](${relativePath})\n`;
        insertText(markdownImage);
      } catch (err) {
        console.error('Failed to save dropped image:', err);
      }
    }
  }, [currentNoteId, insertText]);

  // Window event listener for manual PDF file picker trigger
  useEffect(() => {
    const handleTriggerPicker = () => {
      pdfInputRef.current?.click();
    };
    window.addEventListener('open-pdf-import-picker', handleTriggerPicker);
    return () => {
      window.removeEventListener('open-pdf-import-picker', handleTriggerPicker);
    };
  }, []);

  if (!currentNoteId) {
    return (
      <main
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="h-full flex flex-col bg-mac-mainLight dark:bg-mac-mainDark flex-1 items-center justify-center text-gray-500 relative select-none"
      >
        <input
          type="file"
          ref={pdfInputRef}
          accept=".pdf,application/pdf"
          onChange={handlePdfSelect}
          className="hidden"
        />

        {isDraggingOver && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-purple-500/10 backdrop-blur-xs border-2 border-dashed border-purple-500 rounded-2xl m-3 pointer-events-none animate-in fade-in duration-100">
            <div className="flex flex-col items-center gap-2 bg-white dark:bg-zinc-900 px-6 py-4 rounded-xl shadow-xl border border-purple-500/30 text-center">
              <span className="text-3xl">📄</span>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                PDF Dokümanını Buraya Bırakın
              </p>
              <p className="text-xs text-gray-500">
                Akıllı İçe Aktarma Sihirbazı otomatik olarak açılacaktır
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          <p>{t('selectNotePrompt')}</p>
          <button
            onClick={() => pdfInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 hover:border-purple-500/50 bg-white dark:bg-zinc-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors shadow-xs cursor-pointer"
          >
            <span>📄</span>
            <span>PDF İçe Aktar</span>
          </button>
        </div>

        <EditorModalCoordinator
          editorRef={editorRef}
          currentNoteId={null}
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
  }

  return (
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="h-full flex flex-col bg-mac-mainLight dark:bg-mac-mainDark transition-all duration-200 ease-mac-ease flex-1 min-h-0 overflow-hidden relative print:h-auto print:overflow-visible print:block"
    >
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Hidden File Input for PDF Import */}
      <input
        type="file"
        ref={pdfInputRef}
        accept=".pdf,application/pdf"
        onChange={handlePdfSelect}
        className="hidden"
      />

      {/* Visual Drag Over Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-purple-500/10 backdrop-blur-xs border-2 border-dashed border-purple-500 rounded-2xl m-3 pointer-events-none animate-in fade-in duration-100">
          <div className="flex flex-col items-center gap-2 bg-white dark:bg-zinc-900 px-6 py-4 rounded-xl shadow-xl border border-purple-500/30 text-center">
            <span className="text-3xl">📄</span>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
              PDF veya Görseli Buraya Bırakın
            </p>
            <p className="text-xs text-gray-500">
              Akıllı İçe Aktarma Sihirbazı otomatik olarak açılacaktır
            </p>
          </div>
        </div>
      )}

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

      {/* Workspace Area: Optional PDF Split Viewer + Note Editor */}
      <div className="flex-1 flex min-h-0 min-w-0 w-full overflow-hidden relative">
        {pdfSplitReader.isOpen && (
          <PdfSplitViewer
            pdfPath={pdfSplitReader.pdfPath}
            pdfName={pdfSplitReader.pdfName}
            initialPage={pdfSplitReader.initialPage}
            jumpKey={pdfSplitReader.jumpKey}
            onClose={closePdfSplitReader}
            onInsertQuote={(quoteText, pageNum) => {
              const quoteMarkdown = formatPdfQuote(quoteText, pageNum, pdfSplitReader.pdfPath);
              insertText(quoteMarkdown);
            }}
          />
        )}

        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative">
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
              onOpenImagePicker={handleOpenImagePicker}
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
        </div>
      </div>

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
