/**
 * EditorModalCoordinator.tsx — Centralized Modal & Popover Coordinator for Note Editor.
 * Decouples modal state, event subscriptions, and delete confirmation flows from MainEditor.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { eventBus } from '@/lib/eventBus';
import { clearLivePreviewCaches } from '@/editor/LivePreviewPlugin';
import { prepareSafeDocumentInsertion } from '@/utils/markdownSanitizer';
import type { NoteInfo } from '@/store/noteStore';

// Modals
import { TaskEditModal, type TaskEditData } from '@/components/TaskEditModal';
import { DecisionEditModal, type DecisionEditData } from '@/components/DecisionEditModal';
import { DiagramEditorModal } from '@/components/DiagramEditorModal';
import { ExcalidrawEditorModal } from '@/components/ExcalidrawEditorModal';
import { MermaidEditorModal, type MermaidSavePayload } from '@/components/MermaidEditorModal';
import { CodeEditorModal, type CodeSavePayload } from '@/components/CodeEditorModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { MediaFullscreenModal, type FullscreenMediaData } from '@/components/ui/MediaFullscreenModal';
import { LinkPreviewPopover, type LinkPreviewData } from '@/components/ui/LinkPreviewPopover';
import { WebLinkFullscreenModal, type WebLinkFullscreenData } from '@/components/ui/WebLinkFullscreenModal';
import { InlineAiComposer } from '@/components/ai/InlineAiComposer';
import { PdfImportModal } from '@/components/pdf/PdfImportModal';

interface EditorModalCoordinatorProps {
  editorRef: React.RefObject<any>;
  currentNoteId: string | null;
  otherNotes: NoteInfo[];
  // Diagram Manager Props
  diagramModalOpen: boolean;
  setDiagramModalOpen: (open: boolean) => void;
  diagramInitialMetadata?: any;
  handleSaveDiagram: (meta: any) => void;
  excalidrawModalOpen: boolean;
  setExcalidrawModalOpen: (open: boolean) => void;
  sketchInitialData?: any;
  handleSaveSketch: (data: any) => void;
  // Task & Decision Props
  taskModalData: TaskEditData | null;
  setTaskModalData: (data: TaskEditData | null) => void;
  handleSaveTaskModal: (task: TaskEditData) => Promise<void>;
  decisionModalData: DecisionEditData | null;
  setDecisionModalData: (data: DecisionEditData | null) => void;
  handleSaveDecisionModal: (dec: DecisionEditData) => Promise<void>;
  // Inline AI
  inlineAiState: { isOpen: boolean; top: number; lineFrom?: number };
  setInlineAiState: React.Dispatch<React.SetStateAction<{ isOpen: boolean; top: number; lineFrom?: number }>>;
}

export const EditorModalCoordinator: React.FC<EditorModalCoordinatorProps> = ({
  editorRef,
  currentNoteId,
  otherNotes,
  diagramModalOpen,
  setDiagramModalOpen,
  diagramInitialMetadata,
  handleSaveDiagram,
  excalidrawModalOpen,
  setExcalidrawModalOpen,
  sketchInitialData,
  handleSaveSketch,
  taskModalData,
  setTaskModalData,
  handleSaveTaskModal,
  decisionModalData,
  setDecisionModalData,
  handleSaveDecisionModal,
  inlineAiState,
  setInlineAiState,
}) => {
  const { t } = useTranslation();

  // Fullscreen Media & Web Modals
  const [fullscreenMedia, setFullscreenMedia] = useState<FullscreenMediaData | null>(null);
  const [webLinkFullscreenData, setWebLinkFullscreenData] = useState<WebLinkFullscreenData | null>(null);
  const [linkPreviewData, setLinkPreviewData] = useState<LinkPreviewData | null>(null);
  const linkHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mermaid Modal & Confirm Delete
  const [mermaidModalData, setMermaidModalData] = useState<{
    isOpen: boolean;
    initialCode?: string;
    code?: string;
    width?: number | null;
    from?: number;
    to?: number;
  }>({ isOpen: false });

  // Code Block Modal & Confirm Delete
  const [codeModalData, setCodeModalData] = useState<{
    isOpen: boolean;
    initialCode?: string;
    initialLang?: string;
    from?: number;
    to?: number;
  }>({ isOpen: false });

  // Delete Confirmations
  const [confirmDeleteImage, setConfirmDeleteImage] = useState<{
    from: number;
    to: number;
    isDiagram: boolean;
    relPath: string;
  } | null>(null);
  const [confirmDeleteMermaid, setConfirmDeleteMermaid] = useState<{ from: number; to: number } | null>(null);
  const [confirmDeleteCodeBlock, setConfirmDeleteCodeBlock] = useState<{ from: number; to: number } | null>(null);
  const [pdfImportData, setPdfImportData] = useState<{ file: File; buffer: ArrayBuffer } | null>(null);

  // Context for Inline AI Composer
  const inlineAiContext = useMemo(() => {
    if (!editorRef.current || !currentNoteId || !inlineAiState.isOpen) return undefined;
    const view = editorRef.current;
    const doc = view.state.doc;
    const lineFrom = inlineAiState.lineFrom || 0;
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
  }, [currentNoteId, inlineAiState.isOpen, inlineAiState.lineFrom, otherNotes, editorRef]);

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
  }, [editorRef, inlineAiState.lineFrom, setInlineAiState]);

  // Event bus and window event listeners
  useEffect(() => {
    const unbindMedia = eventBus.on('modal:open-media-fullscreen', (payload) => setFullscreenMedia(payload));
    const unbindDeleteImg = eventBus.on('modal:request-delete-image', (payload) => setConfirmDeleteImage(payload));
    const unbindMermaid = eventBus.on('modal:edit-mermaid', (payload) =>
      setMermaidModalData({
        isOpen: true,
        initialCode: payload.code,
        code: payload.code,
        width: payload.width,
        from: payload.from,
        to: payload.to,
      })
    );
    const unbindDeleteMermaid = eventBus.on('modal:request-delete-mermaid', (payload) => setConfirmDeleteMermaid(payload));
    const unbindCode = eventBus.on('modal:edit-code-block', (payload) => setCodeModalData({ isOpen: true, ...payload }));
    const unbindDeleteCode = eventBus.on('modal:request-delete-code-block', (payload) => setConfirmDeleteCodeBlock(payload));
    const unbindShowLink = eventBus.on('preview:show-link', (payload) => {
      if (linkHideTimerRef.current) {
        clearTimeout(linkHideTimerRef.current);
        linkHideTimerRef.current = null;
      }
      setLinkPreviewData(payload);
    });
    const unbindHideLink = eventBus.on('preview:hide-link', () => {
      if (linkHideTimerRef.current) clearTimeout(linkHideTimerRef.current);
      linkHideTimerRef.current = setTimeout(() => {
        setLinkPreviewData(null);
        linkHideTimerRef.current = null;
      }, 220);
    });
    const unbindWebFullscreen = eventBus.on('modal:open-weblink-fullscreen', (payload) => {
      setWebLinkFullscreenData(payload);
      setLinkPreviewData(null);
    });
    const unbindPdfImport = eventBus.on('modal:pdf-import', (payload) => {
      setPdfImportData(payload);
    });

    // Window events for backward compatibility
    const handleFullscreenWin = (e: CustomEvent) => setFullscreenMedia(e.detail);
    const handleDeleteWin = (e: CustomEvent) => setConfirmDeleteImage(e.detail);
    const handleMermaidWin = (e: CustomEvent) =>
      setMermaidModalData({
        isOpen: true,
        initialCode: e.detail.code ?? e.detail.initialCode,
        code: e.detail.code ?? e.detail.initialCode,
        width: e.detail.width,
        from: e.detail.from,
        to: e.detail.to,
      });
    const handleDeleteMermaidWin = (e: CustomEvent) => setConfirmDeleteMermaid(e.detail);
    const handleCodeWin = (e: CustomEvent) => setCodeModalData({ isOpen: true, initialCode: e.detail.code, initialLang: e.detail.lang, from: e.detail.from, to: e.detail.to });
    const handleDeleteCodeWin = (e: CustomEvent) => setConfirmDeleteCodeBlock(e.detail);
    const handleShowLinkWin = (e: CustomEvent) => {
      if (linkHideTimerRef.current) clearTimeout(linkHideTimerRef.current);
      setLinkPreviewData(e.detail);
    };
    const handleHideLinkWin = () => {
      if (linkHideTimerRef.current) clearTimeout(linkHideTimerRef.current);
      linkHideTimerRef.current = setTimeout(() => setLinkPreviewData(null), 220);
    };
    const handleWebFullscreenWin = (e: CustomEvent) => {
      setWebLinkFullscreenData(e.detail);
      setLinkPreviewData(null);
    };

    window.addEventListener('open-image-fullscreen' as any, handleFullscreenWin);
    window.addEventListener('request-delete-image' as any, handleDeleteWin);
    window.addEventListener('edit-mermaid' as any, handleMermaidWin);
    window.addEventListener('request-delete-mermaid' as any, handleDeleteMermaidWin);
    window.addEventListener('edit-code-block' as any, handleCodeWin);
    window.addEventListener('request-delete-code-block' as any, handleDeleteCodeWin);
    window.addEventListener('show-link-preview' as any, handleShowLinkWin);
    window.addEventListener('hide-link-preview' as any, handleHideLinkWin);
    window.addEventListener('open-weblink-fullscreen' as any, handleWebFullscreenWin);

    return () => {
      unbindMedia();
      unbindDeleteImg();
      unbindMermaid();
      unbindDeleteMermaid();
      unbindCode();
      unbindDeleteCode();
      unbindShowLink();
      unbindHideLink();
      unbindWebFullscreen();
      unbindPdfImport();

      window.removeEventListener('open-image-fullscreen' as any, handleFullscreenWin);
      window.removeEventListener('request-delete-image' as any, handleDeleteWin);
      window.removeEventListener('edit-mermaid' as any, handleMermaidWin);
      window.removeEventListener('request-delete-mermaid' as any, handleDeleteMermaidWin);
      window.removeEventListener('edit-code-block' as any, handleCodeWin);
      window.removeEventListener('request-delete-code-block' as any, handleDeleteCodeWin);
      window.removeEventListener('show-link-preview' as any, handleShowLinkWin);
      window.removeEventListener('hide-link-preview' as any, handleHideLinkWin);
      window.removeEventListener('open-weblink-fullscreen' as any, handleWebFullscreenWin);

      if (linkHideTimerRef.current) clearTimeout(linkHideTimerRef.current);
    };
  }, []);

  const handleConfirmDeleteImageAction = useCallback(() => {
    if (!confirmDeleteImage || !editorRef.current) return;
    const { from, to } = confirmDeleteImage;
    editorRef.current.dispatch({ changes: { from, to, insert: '' } });
    setConfirmDeleteImage(null);
  }, [confirmDeleteImage, editorRef]);

  const handleConfirmDeleteMermaidAction = useCallback(() => {
    if (!confirmDeleteMermaid || !editorRef.current) return;
    const { from, to } = confirmDeleteMermaid;
    const doc = editorRef.current.state.doc;
    const line = doc.lineAt(from);
    let endPos = to;
    if (doc.lines >= line.number && endPos < doc.length && doc.sliceString(endPos, endPos + 1) === '\n') {
      endPos += 1;
    }
    clearLivePreviewCaches();
    editorRef.current.dispatch({ changes: { from: line.from, to: endPos, insert: '' } });
    setConfirmDeleteMermaid(null);
  }, [confirmDeleteMermaid, editorRef]);

  const handleConfirmDeleteCodeBlockAction = useCallback(() => {
    if (!confirmDeleteCodeBlock || !editorRef.current) return;
    const { from, to } = confirmDeleteCodeBlock;
    const doc = editorRef.current.state.doc;
    const line = doc.lineAt(from);
    let endPos = to;
    if (doc.lines >= line.number && endPos < doc.length && doc.sliceString(endPos, endPos + 1) === '\n') {
      endPos += 1;
    }
    clearLivePreviewCaches();
    editorRef.current.dispatch({ changes: { from: line.from, to: endPos, insert: '' } });
    setConfirmDeleteCodeBlock(null);
  }, [confirmDeleteCodeBlock, editorRef]);

  const handleSaveMermaid = useCallback((payload: MermaidSavePayload) => {
    if (!editorRef.current) return;
    const view = editorRef.current;
    clearLivePreviewCaches();

    if (payload.from !== undefined && payload.to !== undefined) {
      const widthParam = payload.width ? `|width=${payload.width}` : '';
      let insertText = '```mermaid' + widthParam + '\n' + payload.code + '\n```';
      const doc = view.state.doc;
      const line = doc.lineAt(payload.from);
      let toPos = payload.to;
      if (toPos < doc.length && doc.sliceString(toPos, toPos + 1) === '\n') {
        toPos += 1;
        insertText += '\n';
      }
      view.dispatch({ changes: { from: line.from, to: toPos, insert: insertText } });
    } else {
      const widthParam = payload.width ? `|width=${payload.width}` : '';
      const insertText = '\n```mermaid' + widthParam + '\n' + payload.code + '\n```\n';
      const head = view.state.selection.main.head;
      view.dispatch({
        changes: { from: head, insert: insertText },
        selection: { anchor: head + insertText.length },
      });
    }
    setMermaidModalData({ isOpen: false });
  }, [editorRef]);

  const handleSaveCode = useCallback((payload: CodeSavePayload) => {
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
      view.dispatch({ changes: { from: line.from, to: toPos, insert: insertText } });
    } else {
      const insertText = '\n```' + (payload.lang || '') + '\n' + payload.code + '\n```\n';
      const head = view.state.selection.main.head;
      view.dispatch({
        changes: { from: head, insert: insertText },
        selection: { anchor: head + insertText.length },
      });
    }
    setCodeModalData({ isOpen: false });
  }, [editorRef]);

  return (
    <>
      {/* Task & Decision Modals */}
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

      {/* Diagrams & Sketches Modals */}
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

      {/* Mermaid & Code Block Modals */}
      <MermaidEditorModal
        isOpen={mermaidModalData.isOpen}
        initialCode={mermaidModalData.initialCode}
        code={mermaidModalData.code}
        width={mermaidModalData.width}
        from={mermaidModalData.from}
        to={mermaidModalData.to}
        onClose={() => setMermaidModalData({ isOpen: false })}
        onSave={handleSaveMermaid}
      />
      <CodeEditorModal
        isOpen={codeModalData.isOpen}
        initialCode={codeModalData.initialCode}
        initialLang={codeModalData.initialLang}
        from={codeModalData.from}
        to={codeModalData.to}
        onClose={() => setCodeModalData({ isOpen: false })}
        onSave={handleSaveCode}
      />

      {/* Confirm Deletions */}
      <ConfirmModal
        isOpen={!!confirmDeleteImage}
        title={t('confirmDeleteTitle')}
        message={confirmDeleteImage?.isDiagram ? t('confirmDeleteDiagramMessage') : t('confirmDeleteImageMessage')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={handleConfirmDeleteImageAction}
        onClose={() => setConfirmDeleteImage(null)}
      />
      <ConfirmModal
        isOpen={!!confirmDeleteMermaid}
        title={t('confirmDeleteMermaidTitle', 'Diyagramı Sil')}
        message={t('confirmDeleteMermaidMessage', 'Bu Mermaid diyagramını nottan kaldırmak istediğinize emin misiniz?')}
        confirmLabel={t('delete', 'Sil')}
        cancelLabel={t('cancel', 'İptal')}
        onConfirm={handleConfirmDeleteMermaidAction}
        onClose={() => setConfirmDeleteMermaid(null)}
      />
      <ConfirmModal
        isOpen={!!confirmDeleteCodeBlock}
        title={t('confirmDeleteCodeTitle', 'Kod Bloğunu Sil')}
        message={t('confirmDeleteCodeMessage', 'Bu kod bloğunu nottan kaldırmak istediğinize emin misiniz?')}
        confirmLabel={t('delete', 'Sil')}
        cancelLabel={t('cancel', 'İptal')}
        onConfirm={handleConfirmDeleteCodeBlockAction}
        onClose={() => setConfirmDeleteCodeBlock(null)}
      />

      {/* Fullscreen Media & Popovers */}
      <MediaFullscreenModal
        data={fullscreenMedia}
        onClose={() => setFullscreenMedia(null)}
      />
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
      <WebLinkFullscreenModal
        data={webLinkFullscreenData}
        onClose={() => setWebLinkFullscreenData(null)}
      />

      {/* Inline AI Generator */}
      <InlineAiComposer
        isOpen={inlineAiState.isOpen}
        onClose={() => setInlineAiState((prev) => ({ ...prev, isOpen: false }))}
        onInsertMarkdown={handleInsertInlineAiMarkdown}
        surroundingContext={inlineAiContext}
      />

      {/* Smart PDF Import Wizard Modal */}
      <PdfImportModal
        isOpen={!!pdfImportData}
        fileData={pdfImportData}
        onClose={() => setPdfImportData(null)}
        onNoteCreated={() => setPdfImportData(null)}
        currentNoteId={currentNoteId}
      />
    </>
  );
};
