import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Sun, Moon, Grid, ZoomIn, ZoomOut, RotateCcw, GitFork } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MermaidPreviewCanvasProps {
  isRendering: boolean;
  renderedSvg: string;
  syntaxError: string | null;
  bgMode: 'theme' | 'light' | 'dark' | 'grid';
  onChangeBgMode: (mode: 'theme' | 'light' | 'dark' | 'grid') => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export const MermaidPreviewCanvas: React.FC<MermaidPreviewCanvasProps> = ({
  isRendering,
  renderedSvg,
  syntaxError,
  bgMode,
  onChangeBgMode,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}) => {
  const { t } = useTranslation();

  const getCanvasBgClass = () => {
    switch (bgMode) {
      case 'light':
        return 'bg-white text-zinc-900';
      case 'dark':
        return 'bg-zinc-950 text-zinc-100';
      case 'grid':
        return 'bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200';
      case 'theme':
      default:
        return 'bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200';
    }
  };

  return (
    <div className="flex flex-col bg-slate-50 dark:bg-zinc-950 relative overflow-hidden transition-all h-full">
      {/* Preview Controls Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm border-b border-gray-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <Eye size={13} className="text-teal-500" />
          <span className="font-medium">{t('mermaidLivePreview')}</span>
          {isRendering && (
            <span className="text-[10px] text-teal-600 dark:text-teal-400 animate-pulse ml-2 font-medium">
              {t('loading')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Canvas Background Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-full p-0.5 border border-gray-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => onChangeBgMode('light')}
              className={cn(
                'p-1 rounded-full transition-colors cursor-pointer',
                bgMode === 'light'
                  ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs'
                  : 'text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200'
              )}
              title={t('themeLight')}
            >
              <Sun size={12} />
            </button>
            <button
              type="button"
              onClick={() => onChangeBgMode('dark')}
              className={cn(
                'p-1 rounded-full transition-colors cursor-pointer',
                bgMode === 'dark'
                  ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs'
                  : 'text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200'
              )}
              title={t('themeDark')}
            >
              <Moon size={12} />
            </button>
            <button
              type="button"
              onClick={() => onChangeBgMode('grid')}
              className={cn(
                'p-1 rounded-full transition-colors cursor-pointer',
                bgMode === 'grid'
                  ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs'
                  : 'text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200'
              )}
              title="Grid"
            >
              <Grid size={12} />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-gray-200 dark:border-zinc-700 text-xs">
            <button
              type="button"
              onClick={onZoomOut}
              className="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
              title={t('zoomOut')}
            >
              <ZoomOut size={13} />
            </button>
            <span className="px-1.5 text-[11px] font-mono text-gray-600 dark:text-gray-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={onZoomIn}
              className="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
              title={t('zoomIn')}
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={onResetZoom}
              className="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer ml-0.5"
              title={t('reset')}
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Rendered SVG Display Area */}
      <div
        className={cn(
          'flex-1 overflow-auto flex items-center justify-center p-6 transition-colors duration-200 select-none',
          getCanvasBgClass()
        )}
      >
        {renderedSvg ? (
          <div
            className="transition-transform duration-100 flex items-center justify-center max-w-full"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
            dangerouslySetInnerHTML={{ __html: renderedSvg }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 gap-2">
            <GitFork size={32} className="opacity-40 animate-pulse" />
            <span className="text-xs">
              {syntaxError ? t('fixSyntaxError') : t('previewPlaceholder')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
