/**
 * EditorHeader.tsx — Top header bar for the editor, showing note metadata
 * (path, read time), tag badges with inline editor, and right panel toggle.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TagCount } from '@/store/noteStore';
import { MultiBadgeSelect } from '@/components/MultiBadgeSelect';
import {
  PanelRightClose,
  PanelRightOpen,
  Calendar,
  Clock,
  Tag,
  X,
} from 'lucide-react';

interface EditorHeaderProps {
  currentNoteId: string;
  localContent: string;
  currentTags: string[];
  vaultTags: TagCount[];
  rightPanelOpen: boolean;
  showTagPopover: boolean;
  onToggleRightPanel: () => void;
  onToggleTagPopover: () => void;
  onCloseTagPopover: () => void;
  onUpdateTags: (tags: string[]) => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  currentNoteId,
  localContent,
  currentTags,
  vaultTags,
  rightPanelOpen,
  showTagPopover,
  onToggleRightPanel,
  onToggleTagPopover,
  onCloseTagPopover,
  onUpdateTags,
}) => {
  const { t } = useTranslation();
  const readMinutes = Math.max(1, Math.ceil(localContent.split(' ').length / 200));

  return (
    <header className="h-12 border-b border-mac-borderLight dark:border-mac-borderDark flex items-center justify-between px-4 shrink-0 relative">
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
        <div className="flex items-center gap-1.5"><Calendar size={14} /> {currentNoteId}</div>
        <div className="flex items-center gap-1.5"><Clock size={14} /> {readMinutes} min read</div>
        
        {/* Note Tags Badges & Popover Trigger */}
        <div className="relative flex items-center gap-1.5 border-l border-gray-200 dark:border-zinc-800 pl-3">
          {currentTags.map((tag: string) => (
            <span 
              key={tag} 
              className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1"
            >
              #{tag}
            </span>
          ))}

          <button
            onClick={onToggleTagPopover}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-purple-500/15 hover:text-purple-600 transition-colors flex items-center gap-1"
            title={t('editNoteTags')}
          >
            <Tag size={10} />
            <span>{currentTags.length === 0 ? t('addTag') : t('editTags')}</span>
          </button>

          {/* Tag Manager Popover */}
          {showTagPopover && (
            <div className="absolute top-9 left-3 z-50 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl p-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                  <Tag size={12} className="text-purple-500" /> {t('noteTags')}
                </span>
                <button 
                  onClick={onCloseTagPopover}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md"
                >
                  <X size={12} />
                </button>
              </div>

              <MultiBadgeSelect
                label=""
                icon={<Tag size={12} />}
                values={currentTags}
                onChange={onUpdateTags}
                suggestions={vaultTags.map((t: TagCount) => t.tag)}
                placeholder={t('tagPlaceholder')}
                badgeStyle="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
              />
            </div>
          )}
        </div>
      </div>

      <button onClick={onToggleRightPanel} className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 transition-colors">
        {rightPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
      </button>
    </header>
  );
};
