import React from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';

interface MermaidModalFooterProps {
  code: string;
  syntaxError: string | null;
  renderedSvg: string;
  copiedCode: boolean;
  copiedSvg: boolean;
  isEditing: boolean;
  onCopyCode: () => void;
  onCopySvg: () => void;
  onClose: () => void;
  onSave: () => void;
}

export const MermaidModalFooter: React.FC<MermaidModalFooterProps> = ({
  code,
  syntaxError,
  renderedSvg,
  copiedCode,
  copiedSvg,
  isEditing,
  onCopyCode,
  onCopySvg,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 bg-gray-50 dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 shrink-0 gap-2 pb-safe">
      <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>💡 {t('mermaidTip')}</span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
        <button
          type="button"
          onClick={onCopyCode}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 transition-colors cursor-pointer"
        >
          <Copy size={13} />
          <span>{copiedCode ? t('copied') : t('copyCode')}</span>
        </button>

        {renderedSvg && (
          <button
            type="button"
            onClick={onCopySvg}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 transition-colors cursor-pointer"
          >
            <Copy size={13} />
            <span>{copiedSvg ? t('copied') : t('copySvg')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="min-h-[36px] px-3 sm:px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer active:scale-95"
        >
          {t('cancel')}
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={!code.trim() || !!syntaxError}
          className="min-h-[36px] flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
        >
          <Check size={14} />
          <span>{isEditing ? t('updateDiagram') : t('insertDiagram')}</span>
        </button>
      </div>
    </div>
  );
};
