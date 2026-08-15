import React from 'react';
import { Eye, FileCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { EditorMode } from '@/store/uiStore';

interface EditorFooterProps {
  editorMode: EditorMode;
  onSetEditorMode: (mode: EditorMode) => void;
}

export const EditorFooter: React.FC<EditorFooterProps> = ({
  editorMode,
  onSetEditorMode,
}) => {
  const { t } = useTranslation();

  return (
    <div className="py-2.5 flex items-center justify-center border-t border-gray-200/60 dark:border-zinc-800/80 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md shrink-0 select-none">
      <div className="flex items-center gap-1 p-1 bg-gray-200/60 dark:bg-zinc-800/80 rounded-xl border border-gray-200/50 dark:border-zinc-700/50 shadow-inner">
        <button
          type="button"
          onClick={() => onSetEditorMode('preview')}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer",
            editorMode === 'preview'
              ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-xs"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          )}
        >
          <Eye size={13} className={editorMode === 'preview' ? "text-mac-accent" : ""} />
          {t('modePreview')}
        </button>
        <button
          type="button"
          onClick={() => onSetEditorMode('raw')}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer",
            editorMode === 'raw'
              ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-xs"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          )}
        >
          <FileCode size={13} className={editorMode === 'raw' ? "text-mac-accent" : ""} />
          {t('modeRaw')}
        </button>
      </div>
    </div>
  );
};
