import React from 'react';
import { useTranslation } from 'react-i18next';
import { GitFork, Code2, Columns, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MermaidTemplateMenu } from './MermaidTemplateMenu';
import type { MermaidTemplate } from '@/editor/mermaid/mermaidTemplates';

interface MermaidToolbarProps {
  isEditing: boolean;
  showTemplateDropdown: boolean;
  onToggleTemplateDropdown: () => void;
  onSelectTemplate: (tpl: MermaidTemplate) => void;
  templateMenuRef: React.RefObject<HTMLDivElement | null>;
  layoutMode: 'split' | 'code' | 'preview';
  onChangeLayoutMode: (mode: 'split' | 'code' | 'preview') => void;
  onClose: () => void;
}

export const MermaidToolbar: React.FC<MermaidToolbarProps> = ({
  isEditing,
  showTemplateDropdown,
  onToggleTemplateDropdown,
  onSelectTemplate,
  templateMenuRef,
  layoutMode,
  onChangeLayoutMode,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50/90 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20 shadow-xs">
          <GitFork size={17} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100 flex items-center gap-2">
            {t('mermaidEditorTitle', 'Mermaid Diyagram Editörü')}
            <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/40">
              {isEditing ? t('edit', 'Düzenle') : t('newDiagram', 'Yeni Diyagram')}
            </span>
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <MermaidTemplateMenu
          isOpen={showTemplateDropdown}
          onToggle={onToggleTemplateDropdown}
          onSelectTemplate={onSelectTemplate}
          menuRef={templateMenuRef}
        />

        {/* Layout Mode Switcher */}
        <div className="flex items-center bg-gray-200/70 dark:bg-zinc-800 p-0.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs">
          <button
            type="button"
            onClick={() => onChangeLayoutMode('code')}
            className={cn(
              'p-1.5 rounded-md transition-colors cursor-pointer',
              layoutMode === 'code'
                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-200'
            )}
            title={t('statusEditorRaw')}
          >
            <Code2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => onChangeLayoutMode('split')}
            className={cn(
              'p-1.5 rounded-md transition-colors cursor-pointer',
              layoutMode === 'split'
                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-200'
            )}
            title={t('codeEditorTitle')}
          >
            <Columns size={14} />
          </button>
          <button
            type="button"
            onClick={() => onChangeLayoutMode('preview')}
            className={cn(
              'p-1.5 rounded-md transition-colors cursor-pointer',
              layoutMode === 'preview'
                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-200'
            )}
            title={t('statusEditorPreview')}
          >
            <Eye size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-100 rounded-lg hover:bg-gray-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title={t('close')}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
