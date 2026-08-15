import React, { useState, useRef, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store/uiStore';
import '@excalidraw/excalidraw/index.css';

// Lazy load Excalidraw component for code splitting and instant startup
const Excalidraw = React.lazy(async () => {
  const mod = await import('@excalidraw/excalidraw');
  return { default: mod.Excalidraw };
});

export interface ExcalidrawSavePayload {
  sketchJson: string;
  pngBlob: Blob;
}

interface ExcalidrawEditorModalProps {
  isOpen: boolean;
  initialJson?: string | null;
  onClose: () => void;
  onSave: (payload: ExcalidrawSavePayload) => Promise<void> | void;
}

export const ExcalidrawEditorModal: React.FC<ExcalidrawEditorModalProps> = ({
  isOpen,
  initialJson,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const { theme, language } = useUiStore();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialDataRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialJson) {
        try {
          const parsed = JSON.parse(initialJson);
          initialDataRef.current = {
            elements: parsed.elements || [],
            appState: {
              ...(parsed.appState || {}),
              theme: theme === 'dark' ? 'dark' : 'light',
            },
            files: parsed.files || {},
          };
        } catch (e) {
          console.error('Failed to parse initial Excalidraw JSON', e);
          initialDataRef.current = {
            appState: { theme: theme === 'dark' ? 'dark' : 'light' },
          };
        }
      } else {
        initialDataRef.current = {
          appState: { theme: theme === 'dark' ? 'dark' : 'light' },
        };
      }
    } else {
      initialDataRef.current = null;
    }
  }, [isOpen, initialJson, theme]);

  if (!isOpen) return null;

  const handleSaveAndClose = async () => {
    if (!excalidrawAPI) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      const sketchData = {
        engine: 'excalidraw',
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          currentItemFontFamily: appState.currentItemFontFamily,
        },
        files,
      };

      const sketchJson = JSON.stringify(sketchData);

      // Export transparent high-res PNG dynamically without static bundler dependency
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const pngBlob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportWithDarkMode: theme === 'dark',
          exportBackground: false,
        },
        files,
        mimeType: 'image/png',
        quality: 1,
      });

      await onSave({ sketchJson, pngBlob });
      onClose();
    } catch (err) {
      console.error('Failed to save Excalidraw sketch:', err);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-[96vw] h-[96vh] bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {t('excalidrawEditorTitle', 'Excalidraw Serbest Çizim')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAndClose}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-mac-accent hover:opacity-90 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              <span>{t('saveAndClose', 'Kaydet & Kapat')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              title="Kapat"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Excalidraw Canvas Area */}
        <div className="w-full relative overflow-hidden bg-gray-50 dark:bg-zinc-950" style={{ height: 'calc(96vh - 54px)' }}>
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
                <Loader2 size={24} className="animate-spin text-mac-accent" />
                <span className="text-xs font-medium">{t('loadingExcalidraw', 'Excalidraw yükleniyor...')}</span>
              </div>
            }
          >
            <div style={{ height: '100%', width: '100%', position: 'relative' }}>
              <Excalidraw
                excalidrawAPI={(api) => setExcalidrawAPI(api)}
                initialData={initialDataRef.current}
                theme={theme === 'dark' ? 'dark' : 'light'}
                langCode={language === 'tr' ? 'tr-TR' : 'en-US'}
                UIOptions={{
                  canvasActions: {
                    loadScene: false,
                    saveAsImage: true,
                  },
                }}
              />
            </div>
          </Suspense>
        </div>
      </div>
    </div>,
    document.body
  );
};
