/**
 * ModelDownloadIndicator.tsx — Non-intrusive floating progress indicator
 * that appears when local embedding model files are being downloaded to the browser cache.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, CheckCircle2, Cpu } from 'lucide-react';
import { useAiStore } from '@/store/aiStore';

export const ModelDownloadIndicator: React.FC = () => {
  const { t } = useTranslation();
  const modelDownloadProgress = useAiStore((s) => s.modelDownloadProgress);

  if (!modelDownloadProgress) return null;

  const { progress, file } = modelDownloadProgress;
  const isComplete = progress >= 100;
  const displayPercent = Math.min(100, Math.max(0, Math.round(progress)));

  // Simplify file name for user friendly display
  const cleanFileName = file ? file.split('/').pop() : 'model_quantized.onnx';

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300 pointer-events-none"
    >
      <div className="w-80 p-3.5 bg-white/95 dark:bg-zinc-900/95 rounded-2xl shadow-2xl border border-gray-200/80 dark:border-zinc-800/80 backdrop-blur-xl pointer-events-auto flex flex-col gap-2.5 transition-all">
        {/* Header with Icon and Percentage */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                isComplete
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
              }`}
            >
              {isComplete ? (
                <CheckCircle2 size={16} className="animate-in zoom-in-75 duration-200" />
              ) : (
                <Sparkles size={15} className="animate-pulse" />
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                {isComplete ? t('aiModelReady') : t('aiModelDownloading')}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate flex items-center gap-1">
                <Cpu size={10} className="shrink-0" />
                {cleanFileName}
              </span>
            </div>
          </div>

          <span
            className={`text-xs font-bold font-mono shrink-0 ml-2 ${
              isComplete
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-purple-600 dark:text-purple-400'
            }`}
          >
            {isComplete ? '100%' : `${displayPercent}%`}
          </span>
        </div>

        {/* Progress Track & Bar */}
        <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${
              isComplete
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600'
            }`}
            style={{ width: `${displayPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
