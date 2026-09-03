import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TagCount } from '@/services/storage/types';

interface SidebarTagsProps {
  vaultTags: TagCount[];
  activeTagFilter: string | null;
  onSelectTag: (tag: string | null) => void;
}

export const SidebarTags: React.FC<SidebarTagsProps> = ({
  vaultTags,
  activeTagFilter,
  onSelectTag,
}) => {
  const { t } = useTranslation();
  const [showAllTags, setShowAllTags] = useState(false);

  if (!vaultTags || vaultTags.length === 0) return null;

  return (
    <div className="px-3 py-2 border-t border-mac-borderLight dark:border-mac-borderDark max-h-36 flex flex-col">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5 uppercase tracking-wider">
          <Tag size={11} className="text-mac-accent" />
          {t('tags')} ({vaultTags.length})
        </span>
        {activeTagFilter && (
          <button
            onClick={() => onSelectTag(null)}
            className="text-[10px] text-mac-accent hover:underline flex items-center gap-0.5 cursor-pointer"
            title={t('clearFilter')}
          >
            <X size={10} /> {t('clear')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 overflow-y-auto pr-1">
        {(showAllTags ? vaultTags : vaultTags.slice(0, 8)).map((tagObj) => {
          const isActive = activeTagFilter === tagObj.tag;
          return (
            <button
              key={tagObj.tag}
              onClick={() => onSelectTag(isActive ? null : tagObj.tag)}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-md font-mono transition-all flex items-center gap-1 cursor-pointer border',
                isActive
                  ? 'bg-mac-accent text-white border-mac-accent shadow-xs font-semibold'
                  : 'bg-black/5 dark:bg-white/5 border-transparent text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'
              )}
              title={t('notesCount', { count: tagObj.count })}
            >
              <span>#{tagObj.tag}</span>
              <span
                className={cn(
                  'text-[9px] px-1 py-0.2 rounded-full',
                  isActive ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/5 text-gray-400'
                )}
              >
                {tagObj.count}
              </span>
            </button>
          );
        })}

        {vaultTags.length > 8 && (
          <button
            onClick={() => setShowAllTags(!showAllTags)}
            className="text-[10px] px-1.5 py-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center gap-0.5 cursor-pointer"
          >
            {showAllTags ? (
              <>
                <ChevronUp size={11} /> {t('showLess')}
              </>
            ) : (
              <>
                <ChevronDown size={11} /> +{vaultTags.length - 8} {t('more')}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
