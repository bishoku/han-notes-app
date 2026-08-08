/**
 * PwaUpdateToast — A subtle toast notification that appears when
 * a new version of the app is available. Prompts the user to reload.
 */
import React from 'react';
import { RefreshCw, X } from 'lucide-react';

interface PwaUpdateToastProps {
  show: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export const PwaUpdateToast: React.FC<PwaUpdateToastProps> = ({ show, onAccept, onDismiss }) => {
  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-gray-200/60 dark:border-zinc-700/60 backdrop-blur-xl">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center shrink-0">
          <RefreshCw size={16} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="mr-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Güncelleme mevcut</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Yeni sürümü yüklemek için yenileyin.</p>
        </div>
        <button
          onClick={onAccept}
          className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shrink-0"
        >
          Yenile
        </button>
        <button
          onClick={onDismiss}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
