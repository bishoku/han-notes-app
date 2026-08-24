import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useUiStore } from '@/store/uiStore';

export interface DiagramPayload {
  logicalJson: string;
  visualJson: string;
  previewDataUri?: string;
  aiSummary?: string;
}

interface DiagramEditorModalProps {
  isOpen: boolean;
  initialMetadata?: { logicalData?: any; visualData?: any } | null;
  onClose: () => void;
  onSave: (payload: DiagramPayload) => void;
}

export const DiagramEditorModal: React.FC<DiagramEditorModalProps> = ({
  isOpen,
  initialMetadata,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);

  const { theme, language } = useUiStore();
  const YADA_URL = import.meta.env.VITE_YADA_URL || 'https://bishoku.github.io/yada/';
  const iframeSrc = `${YADA_URL}?mode=modal&embed=true&theme=${theme}&lang=${language}`;

  const sendLoadDiagram = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      let logicalJson = '{"schemaVersion":2,"nodes":[],"edges":[],"sequences":[]}';
      let visualJson = '{"canvas":{"zoom":1,"pan":{"x":0,"y":0}},"layoutNodes":{},"layoutEdges":{},"timelines":{},"annotations":{}}';
      if (initialMetadata) {
        logicalJson = initialMetadata.logicalData
          ? typeof initialMetadata.logicalData === 'string'
            ? initialMetadata.logicalData
            : JSON.stringify(initialMetadata.logicalData)
          : '{}';
        visualJson = initialMetadata.visualData
          ? typeof initialMetadata.visualData === 'string'
            ? initialMetadata.visualData
            : JSON.stringify(initialMetadata.visualData)
          : '{}';
      }

      iframeRef.current.contentWindow.postMessage(
        {
          type: 'LOAD_DIAGRAM',
          payload: {
            logicalJson,
            visualJson,
          },
        },
        '*'
      );
    }
  }, [initialMetadata]);

  useEffect(() => {
    if (!isOpen) {
      setIframeReady(false);
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'READY') {
        setIframeReady(true);
        sendLoadDiagram();
      } else if (event.data?.type === 'SAVE_DIAGRAM') {
        onSave(event.data.payload);
      } else if (event.data?.type === 'CLOSE_DIAGRAM') {
        onClose();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, sendLoadDiagram, onSave, onClose]);

  // Resend if initialMetadata updates after iframe was already ready
  useEffect(() => {
    if (isOpen && iframeReady) {
      sendLoadDiagram();
    }
  }, [isOpen, iframeReady, sendLoadDiagram]);

  const handleRequestClose = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'REQUEST_SAVE_AND_CLOSE' }, '*');
      setTimeout(() => {
        onClose();
      }, 500);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[95vw] h-[95vh] bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('diagramEditorTitle')}
          </h2>
          <button
            onClick={handleRequestClose}
            className="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 transition-colors rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Iframe content */}
        <div className="flex-1 w-full bg-white dark:bg-zinc-900 relative">
          {!iframeReady && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              {t('loading')}
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="w-full h-full border-none"
            title="Diagram Editor"
            allow="clipboard-read; clipboard-write"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
