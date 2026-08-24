import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2, Sun, Moon, Grid } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface FullscreenMediaData {
  src?: string;
  alt?: string;
  isSimulation?: boolean;
  embedUrl?: string;
  relPath?: string;
  svgContent?: string;
  mermaidCode?: string;
}

interface MediaFullscreenModalProps {
  data: FullscreenMediaData | null;
  onClose: () => void;
}

export const MediaFullscreenModal: React.FC<MediaFullscreenModalProps> = ({
  data,
  onClose,
}) => {
  const { t } = useTranslation();
  const [bgMode, setBgMode] = useState<'theme' | 'light' | 'dark' | 'grid'>('theme');

  // Reset bgMode when a new image opens
  useEffect(() => {
    if (data) {
      setBgMode('theme');
    }
  }, [data]);

  useEffect(() => {
    if (!data) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, onClose]);

  if (!data) return null;

  const { src, alt, isSimulation, embedUrl } = data;
  const cleanTitle = alt?.split('|')[0]?.trim() || '';

  const getCanvasBgClass = () => {
    switch (bgMode) {
      case 'light':
        return 'bg-white text-zinc-900';
      case 'dark':
        return 'bg-zinc-900 text-zinc-100';
      case 'grid':
        return 'bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:16px_16px] bg-white dark:bg-zinc-900';
      case 'theme':
      default:
        return 'bg-white dark:bg-zinc-900';
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md transition-all duration-200 animate-in fade-in"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        className="w-full flex items-center justify-between px-6 py-4 absolute top-0 left-0 right-0 z-30 select-none bg-gradient-to-b from-black/80 to-transparent pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-white/90">
          <Maximize2 size={16} className="text-mac-accent shrink-0" />
          <span className="text-sm font-medium truncate max-w-md">
            {cleanTitle || (isSimulation ? t('mediaSimulationPreview') : t('mediaImagePreview'))}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Canvas Background Toggle (only for static images/sketches) */}
          {!isSimulation && (
            <div className="flex items-center bg-white/10 rounded-full p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setBgMode('light')}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  bgMode === 'light' ? 'bg-white/25 text-white' : 'text-white/60 hover:text-white'
                }`}
                title={t('themeLight')}
              >
                <Sun size={14} />
              </button>
              <button
                type="button"
                onClick={() => setBgMode('dark')}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  bgMode === 'dark' ? 'bg-white/25 text-white' : 'text-white/60 hover:text-white'
                }`}
                title={t('themeDark')}
              >
                <Moon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setBgMode('grid')}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  bgMode === 'grid' ? 'bg-white/25 text-white' : 'text-white/60 hover:text-white'
                }`}
                title="Grid"
              >
                <Grid size={14} />
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all duration-150 cursor-pointer shadow-md"
            title={t('close')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="flex items-center justify-center w-full h-full p-4 sm:p-6 pt-16 pb-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isSimulation && embedUrl ? (
          <div className="w-[96vw] h-[88vh] max-w-[1700px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-950 flex flex-col animate-in zoom-in-95 duration-150">
            <iframe
              src={embedUrl}
              className="w-full h-full border-0"
              allow="fullscreen"
              title={cleanTitle || "Simulation View"}
            />
          </div>
        ) : data.svgContent ? (
          <div className="relative max-w-[96vw] max-h-[88vh] flex items-center justify-center animate-in zoom-in-95 duration-150 overflow-auto p-4">
            <div
              className={`p-6 sm:p-10 rounded-2xl shadow-2xl border border-white/15 flex items-center justify-center max-w-[94vw] max-h-[86vh] overflow-auto transition-colors duration-200 ${getCanvasBgClass()}`}
              dangerouslySetInnerHTML={{ __html: data.svgContent }}
            />
          </div>
        ) : (
          <div className="relative max-w-[96vw] max-h-[88vh] flex items-center justify-center animate-in zoom-in-95 duration-150">
            <div
              className={`p-4 sm:p-6 rounded-2xl shadow-2xl border border-white/15 flex items-center justify-center max-w-[96vw] max-h-[88vh] transition-colors duration-200 ${getCanvasBgClass()}`}
            >
              <img
                src={src}
                alt={alt}
                className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg select-none pointer-events-auto"
              />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
