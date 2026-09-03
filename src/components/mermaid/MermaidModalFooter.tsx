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
    <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 shrink-0">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>💡 {t('mermaidTip')}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCopyCode}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 transition-colors cursor-pointer"
        >
          <Copy size={13} />
          <span>{copiedCode ? t('copied') : t('copyCode')}</span>
        </button>

        {renderedSvg && (
          <button
            type="button"
            onClick={onCopySvg}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 transition-colors cursor-pointer"
          >
            <Copy size={13} />
            <span>{copiedSvg ? t('copied') : t('copySvg')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
        >
          {t('cancel')}
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={!code.trim() || !!syntaxError}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Check size={14} />
          <span>{isEditing ? t('updateDiagram') : t('insertDiagram')}</span>
        </button>
      </div>
    </div>
  );
};
