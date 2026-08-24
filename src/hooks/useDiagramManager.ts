import { useState, useRef, useCallback, useEffect } from 'react';
import type React from 'react';
import type { EditorView } from '@codemirror/view';
import { storage } from '@/services/storage';
import { extractPngMetadata, injectPngMetadata, YADA_METADATA_KEYWORD, EXCALIDRAW_METADATA_KEYWORD } from '@/utils/pngMetadata';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import {
  generateDiagramAiSummary,
  formatDiagramAiComment,
  updateDiagramAiCommentInMarkdown,
} from '@/utils/diagramAiGenerator';
import type { DiagramPayload } from '@/components/DiagramEditorModal';
import type { ExcalidrawSavePayload } from '@/components/ExcalidrawEditorModal';

/**
 * Custom hook to manage YADA and Excalidraw diagrams/sketches:
 * opening modals, PNG metadata injection & extraction, and persistence.
 */
export function useDiagramManager(
  currentNoteId: string | null,
  onInsertText: (text: string) => void,
  editorRef?: React.RefObject<EditorView | null>
) {
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

  // Listen for custom edit-diagram events dispatched from image widgets
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

  const handleSaveDiagram = useCallback(async (payload: DiagramPayload) => {
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

        const language = useUiStore.getState().language;
        const aiSummary = payload.aiSummary || generateDiagramAiSummary(projectPayload.logicalData, projectPayload.visualData, language);
        const aiCommentBlock = formatDiagramAiComment(fileNamePng, aiSummary);

        if (!isEditing) {
          onInsertText(`\n![${fileNamePng}](${relPathPng})\n${aiCommentBlock}\n`);
        } else {
          // Sync AI comment in document when editing existing diagram
          if (editorRef?.current) {
            const view = editorRef.current;
            const currentDoc = view.state.doc.toString();
            const updatedDoc = updateDiagramAiCommentInMarkdown(currentDoc, fileNamePng, aiSummary);
            if (updatedDoc !== currentDoc) {
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: updatedDoc },
              });
            }
          } else {
            const currentNoteContent = useNoteStore.getState().currentNoteContent;
            if (currentNoteContent) {
              const updatedDoc = updateDiagramAiCommentInMarkdown(currentNoteContent, fileNamePng, aiSummary);
              if (updatedDoc !== currentNoteContent) {
                await useNoteStore.getState().updateNote(updatedDoc);
              }
            }
          }
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
  }, [currentNoteId, onInsertText, editorRef]);

  const handleSaveSketch = useCallback(async (payload: ExcalidrawSavePayload) => {
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
        onInsertText(`\n![${fileNamePng}](${relPathPng})\n`);
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
  }, [currentNoteId, onInsertText]);

  return {
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
  };
}
