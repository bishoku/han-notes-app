import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  FolderPlus,
  FilePlus,
  FileUp,
  PanelLeftClose,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarHeaderProps {
  activeFolderPath: string | null;
  isSearchActive: boolean;
  onOpenNewNote: () => void;
  onOpenNewFolder: () => void;
  onOpenSearch: () => void;
  onCollapseSidebar: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  activeFolderPath,
  isSearchActive,
  onOpenNewNote,
  onOpenNewFolder,
  onOpenSearch,
  onCollapseSidebar,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-xs uppercase tracking-wider text-gray-500">{t('vault')}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenNewNote}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
            title={activeFolderPath ? `${t('newNote')} ("${activeFolderPath}")` : t('newNote')}
          >
            <FilePlus size={15} />
          </button>
          <button
            onClick={onOpenNewFolder}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
            title={activeFolderPath ? `${t('newFolder')} ("${activeFolderPath}")` : t('newFolder')}
          >
            <FolderPlus size={15} />
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-pdf-import-picker'))}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
            title="PDF İçe Aktar (Smart PDF Import)"
          >
            <FileUp size={15} />
          </button>
          <button
            onClick={onCollapseSidebar}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer ml-0.5"
            title={t('collapseSidebar')}
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      </div>

      <button
        onClick={onOpenSearch}
        className={cn(
          'flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-all cursor-pointer border group',
          isSearchActive
            ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300 shadow-2xs'
            : 'bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
        )}
        title={`${t('search')} (Cmd+K)`}
      >
        <div className="flex items-center gap-2">
          <Search size={14} className="group-hover:text-purple-500 transition-colors" />
          <span className="font-medium">{t('search')}</span>
        </div>
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
          ⌘K
        </kbd>
      </button>
    </div>
  );
};
