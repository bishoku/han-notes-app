/**
 * MainEditor.tsx — Primary Note Editor Coordinator.
 * Manages active note state, tag updates, modal dialogs, and switches
 * between LivePreviewEditor (WYSIWYG) and RawSourceEditor (Plain-text code editor).
 */
import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { storage } from '@/services/storage';
import { useUiStore } from '@/store/uiStore';
import { clearLivePreviewCaches } from '@/editor/LivePreviewPlugin';
import { prepareSafeDocumentInsertion } from '@/utils/markdownSanitizer';

// Custom Hooks
import { useNoteContent } from '@/hooks/useNoteContent';
import { useDiagramManager } from '@/hooks/useDiagramManager';
import { useTaskDecisionModals } from '@/hooks/useTaskDecisionModals';

// Core Editor Engines
import { LivePreviewEditor } from '@/components/editor/LivePreviewEditor';
import { RawSourceEditor } from '@/components/editor/RawSourceEditor';

// Sub-Components & Header
import { EditorHeader } from '@/components/EditorHeader';

// Modals
import { TaskEditModal } from '@/components/TaskEditModal';
import { DecisionEditModal } from '@/components/DecisionEditModal';
import { DiagramEditorModal } from '@/components/DiagramEditorModal';
import { ExcalidrawEditorModal } from '@/components/ExcalidrawEditorModal';
import { MermaidEditorModal, type MermaidSavePayload } from '@/components/MermaidEditorModal';
import { CodeEditorModal, type CodeSavePayload } from '@/components/CodeEditorModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { MediaFullscreenModal, type FullscreenMediaData } from '@/components/ui/MediaFullscreenModal';
import { LinkPreviewPopover, type LinkPreviewData } from '@/components/ui/LinkPreviewPopover';
import { WebLinkFullscreenModal, type WebLinkFullscreenData } from '@/components/ui/WebLinkFullscreenModal';
import { InlineAiComposer } from '@/components/ai/InlineAiComposer';

export const MainEditor: React.FC = () => {
  const { t } = useTranslation();
  const theme = useUiStore(s => s.theme);
  const fontSize = useUiStore(s => s.fontSize);
  const editorMode = useUiStore(s => s.editorMode);
  const rightPanelOpen = useUiStore(s => s.rightPanelOpen);
  const toggleRightPanel = useUiStore(s => s.toggleRightPanel);

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

  // Stable insertText helper for diagram hooks
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
  } = useDiagramManager(currentNoteId, insertText);

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

  // 4. Modals State: Fullscreen Media, Delete Modals, Mermaid & Code Modals
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

  // 5. Link Hover Preview & Fullscreen Web Modal State
  const [linkPreviewData, setLinkPreviewData] = useState<LinkPreviewData | null>(null);
  const [webLinkFullscreenData, setWebLinkFullscreenData] = useState<WebLinkFullscreenData | null>(null);
  const linkHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 6. Inline AI State
  const [inlineAiState, setInlineAiState] = useState<{
    isOpen: boolean;
    top: number;
    lineFrom?: number;
  }>({ isOpen: false, top: 0 });

  const otherNotesRef = useRef(otherNotes);
  otherNotesRef.current = otherNotes;

  const inlineAiContext = useMemo(() => {
    if (!editorRef.current || !currentNoteId || !inlineAiState.isOpen) return undefined;
    const view = editorRef.current;
    const doc = view.state.doc;
    const lineFrom = inlineAiState.lineFrom || 0;
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
    const targetPos = inlineAiState.lineFrom || 0;

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

  // Window Event Listeners for Editor Actions
  useEffect(() => {
    const handleFullscreenRequest = (e: CustomEvent<FullscreenMediaData>) => setFullscreenMedia(e.detail);
    const handleDeleteRequest = (e: CustomEvent<any>) => setConfirmDeleteData(e.detail);
    const handleEditMermaid = (e: CustomEvent<any>) => {
      setMermaidModalData({
        isOpen: true,
        initialCode: e.detail.code,
        width: e.detail.width,
        from: e.detail.from,
        to: e.detail.to,
      });
    };
    const handleDeleteMermaidRequest = (e: CustomEvent<any>) => setConfirmDeleteMermaidData(e.detail);
    const handleEditCodeBlock = (e: CustomEvent<any>) => {
      setCodeModalData({
        isOpen: true,
        initialCode: e.detail.code,
        initialLang: e.detail.lang,
        from: e.detail.from,
        to: e.detail.to,
      });
    };
    const handleDeleteCodeBlockRequest = (e: CustomEvent<any>) => setConfirmDeleteCodeBlockData(e.detail);
    const handleShowLinkPreview = (e: CustomEvent<LinkPreviewData>) => {
      if (linkHideTimerRef.current) {
        clearTimeout(linkHideTimerRef.current);
        linkHideTimerRef.current = null;
      }
      setLinkPreviewData(e.detail);
    };
    const handleHideLinkPreview = () => {
      if (linkHideTimerRef.current) clearTimeout(linkHideTimerRef.current);
      linkHideTimerRef.current = setTimeout(() => {
        setLinkPreviewData(null);
        linkHideTimerRef.current = null;
      }, 220);
    };
    const handleOpenWebFullscreen = (e: CustomEvent<WebLinkFullscreenData>) => {
      setWebLinkFullscreenData(e.detail);
      setLinkPreviewData(null);
    };

    window.addEventListener('open-image-fullscreen', handleFullscreenRequest as EventListener);
    window.addEventListener('request-delete-image', handleDeleteRequest as EventListener);
    window.addEventListener('edit-mermaid', handleEditMermaid as EventListener);
    window.addEventListener('request-delete-mermaid', handleDeleteMermaidRequest as EventListener);
    window.addEventListener('edit-code-block', handleEditCodeBlock as EventListener);
    window.addEventListener('request-delete-code-block', handleDeleteCodeBlockRequest as EventListener);
    window.addEventListener('show-link-preview', handleShowLinkPreview as EventListener);
    window.addEventListener('hide-link-preview', handleHideLinkPreview as EventListener);
    window.addEventListener('open-weblink-fullscreen', handleOpenWebFullscreen as EventListener);

    return () => {
      window.removeEventListener('open-image-fullscreen', handleFullscreenRequest as EventListener);
      window.removeEventListener('request-delete-image', handleDeleteRequest as EventListener);
      window.removeEventListener('edit-mermaid', handleEditMermaid as EventListener);
      window.removeEventListener('request-delete-mermaid', handleDeleteMermaidRequest as EventListener);
      window.removeEventListener('edit-code-block', handleEditCodeBlock as EventListener);
      window.removeEventListener('request-delete-code-block', handleDeleteCodeBlockRequest as EventListener);
      window.removeEventListener('show-link-preview', handleShowLinkPreview as EventListener);
      window.removeEventListener('hide-link-preview', handleHideLinkPreview as EventListener);
      window.removeEventListener('open-weblink-fullscreen', handleOpenWebFullscreen as EventListener);
      if (linkHideTimerRef.current) clearTimeout(linkHideTimerRef.current);
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
    const line = doc.lineAt(from);
    let endPos = to;
    if (doc.lines >= line.number && endPos < doc.length && doc.sliceString(endPos, endPos + 1) === '\n') {
      endPos += 1;
    }
    clearLivePreviewCaches();
    editorRef.current.dispatch({
      changes: { from: line.from, to: endPos, insert: '' },
    });
    setConfirmDeleteMermaidData(null);
  }, [confirmDeleteMermaidData]);

  const handleConfirmDeleteCodeBlock = useCallback(() => {
    if (!confirmDeleteCodeBlockData || !editorRef.current) return;
    const { from, to } = confirmDeleteCodeBlockData;
    const doc = editorRef.current.state.doc;
    const line = doc.lineAt(from);
    let endPos = to;
    if (doc.lines >= line.number && endPos < doc.length && doc.sliceString(endPos, endPos + 1) === '\n') {
      endPos += 1;
    }
    clearLivePreviewCaches();
    editorRef.current.dispatch({
      changes: { from: line.from, to: endPos, insert: '' },
    });
    setConfirmDeleteCodeBlockData(null);
  }, [confirmDeleteCodeBlockData]);

  const handleSaveMermaidModal = useCallback((payload: MermaidSavePayload) => {
    if (!editorRef.current) return;
    const view = editorRef.current;
    clearLivePreviewCaches();

    if (payload.from !== undefined && payload.to !== undefined) {
      let widthParam = payload.width ? `|width=${payload.width}` : '';
      let insertText = '```mermaid' + widthParam + '\n' + payload.code + '\n```';
      const doc = view.state.doc;
      const line = doc.lineAt(payload.from);
      let toPos = payload.to;
      if (toPos < doc.length && doc.sliceString(toPos, toPos + 1) === '\n') {
        toPos += 1;
        insertText += '\n';
      }
      view.dispatch({
        changes: { from: line.from, to: toPos, insert: insertText },
      });
    } else {
      let widthParam = payload.width ? `|width=${payload.width}` : '';
      let insertText = '\n```mermaid' + widthParam + '\n' + payload.code + '\n```\n';
      const head = view.state.selection.main.head;
      view.dispatch({
        changes: { from: head, insert: insertText },
        selection: { anchor: head + insertText.length },
      });
    }
    setMermaidModalData({ isOpen: false });
  }, []);

  const handleSaveCodeBlock = useCallback((payload: CodeSavePayload) => {
    if (!editorRef.current) return;
    const view = editorRef.current;
    clearLivePreviewCaches();

    if (payload.from !== undefined && payload.to !== undefined) {
      let insertText = '```' + (payload.lang || '') + '\n' + payload.code + '\n```';
      const doc = view.state.doc;
      const line = doc.lineAt(payload.from);
      let toPos = payload.to;
      if (toPos < doc.length && doc.sliceString(toPos, toPos + 1) === '\n') {
        toPos += 1;
        insertText += '\n';
      }
      view.dispatch({
        changes: { from: line.from, to: toPos, insert: insertText },
      });
    } else {
      let insertText = '\n```' + (payload.lang || '') + '\n' + payload.code + '\n```\n';
      const head = view.state.selection.main.head;
      view.dispatch({
        changes: { from: head, insert: insertText },
        selection: { anchor: head + insertText.length },
      });
    }
    setCodeModalData({ isOpen: false });
  }, []);

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
        onUpdateTags={(newTags) => { if (currentNoteId) updateNoteTags(currentNoteId, newTags); }}
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
          onOpenMermaidModal={() => setMermaidModalData({ isOpen: true })}
          onOpenCodeModal={(lang) => setCodeModalData({ isOpen: true, initialLang: lang || 'typescript', initialCode: '' })}
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

      {/* Shared Modals */}
      {taskModalData && (
        <TaskEditModal
          task={taskModalData}
          onClose={() => setTaskModalData(null)}
          onSave={handleSaveTaskModal}
        />
      )}
      {decisionModalData && (
        <DecisionEditModal
          decision={decisionModalData}
          onClose={() => setDecisionModalData(null)}
          onSave={handleSaveDecisionModal}
        />
      )}
      <DiagramEditorModal
        isOpen={diagramModalOpen}
        onClose={() => setDiagramModalOpen(false)}
        onSave={handleSaveDiagram}
        initialMetadata={diagramInitialMetadata}
      />
      <ExcalidrawEditorModal
        isOpen={excalidrawModalOpen}
        onClose={() => setExcalidrawModalOpen(false)}
        onSave={handleSaveSketch}
        initialData={sketchInitialData}
      />
      <MermaidEditorModal
        isOpen={mermaidModalData.isOpen}
        initialCode={mermaidModalData.initialCode}
        width={mermaidModalData.width}
        from={mermaidModalData.from}
        to={mermaidModalData.to}
        onClose={() => setMermaidModalData({ isOpen: false })}
        onSave={handleSaveMermaidModal}
      />
      <CodeEditorModal
        isOpen={codeModalData.isOpen}
        initialCode={codeModalData.initialCode}
        initialLang={codeModalData.initialLang}
        from={codeModalData.from}
        to={codeModalData.to}
        onClose={() => setCodeModalData({ isOpen: false })}
        onSave={handleSaveCodeBlock}
      />
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

      {/* Link Hover Preview Popover */}
      <LinkPreviewPopover
        data={linkPreviewData}
        onOpenFullscreen={(url, title) => setWebLinkFullscreenData({ url, title })}
        onMouseEnter={() => {
          if (linkHideTimerRef.current) {
            clearTimeout(linkHideTimerRef.current);
            linkHideTimerRef.current = null;
          }
        }}
        onMouseLeave={() => {
          if (linkHideTimerRef.current) clearTimeout(linkHideTimerRef.current);
          linkHideTimerRef.current = setTimeout(() => {
            setLinkPreviewData(null);
            linkHideTimerRef.current = null;
          }, 200);
        }}
        onClose={() => setLinkPreviewData(null)}
      />

      {/* Fullscreen Web Browser & Iframe Modal */}
      <WebLinkFullscreenModal
        data={webLinkFullscreenData}
        onClose={() => setWebLinkFullscreenData(null)}
      />

      {/* Inline AI Paragraph Generator Modal */}
      <InlineAiComposer
        isOpen={inlineAiState.isOpen}
        onClose={() => setInlineAiState((prev) => ({ ...prev, isOpen: false }))}
        onInsertMarkdown={handleInsertInlineAiMarkdown}
        surroundingContext={inlineAiContext}
      />
    </main>
  );
};
