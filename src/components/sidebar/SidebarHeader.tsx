import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  FolderPlus,
  FilePlus,
  FileUp,
  Globe,
  PanelLeftClose,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { eventBus } from '@/lib/eventBus';
import { WorkspaceSwitcherDropdown } from '@/components/workspace';

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
    <div className="p-3 md:p-4 flex flex-col gap-2.5 md:gap-3">
      {/* ── Desktop Row: Workspace dropdown & 5 compact action buttons ── */}
      <div className="hidden md:flex items-center justify-between">
        <WorkspaceSwitcherDropdown />
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
            title={t('importPdf')}
          >
            <FileUp size={15} />
          </button>
          <button
            onClick={() => eventBus.emit('clipper:open-modal')}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            title={t('webClipperTooltip')}
          >
            <Globe size={15} />
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

      {/* ── Mobile Rows: Two-row responsive layout with comfortable touch targets ── */}
      <div className="md:hidden flex flex-col gap-2.5">
        {/* Top Mobile Row: Workspace Switcher & Close Drawer Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <WorkspaceSwitcherDropdown />
          </div>
          <button
            onClick={onCollapseSidebar}
            className="min-w-[40px] min-h-[40px] w-10 h-10 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 active:scale-95 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title={t('collapseSidebar')}
            aria-label={t('collapseSidebar')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Second Mobile Row: 4 Action Buttons with generous touch areas */}
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={onOpenNewNote}
            className="h-10 min-h-[40px] flex items-center justify-center rounded-xl bg-purple-500/10 active:scale-95 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors cursor-pointer"
            title={activeFolderPath ? `${t('newNote')} ("${activeFolderPath}")` : t('newNote')}
            aria-label={t('newNote')}
          >
            <FilePlus size={18} />
          </button>
          <button
            onClick={onOpenNewFolder}
            className="h-10 min-h-[40px] flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 active:scale-95 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title={activeFolderPath ? `${t('newFolder')} ("${activeFolderPath}")` : t('newFolder')}
            aria-label={t('newFolder')}
          >
            <FolderPlus size={18} />
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-pdf-import-picker'))}
            className="h-10 min-h-[40px] flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 active:scale-95 text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title={t('importPdf')}
            aria-label={t('importPdf')}
          >
            <FileUp size={18} />
          </button>
          <button
            onClick={() => eventBus.emit('clipper:open-modal')}
            className="h-10 min-h-[40px] flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 active:scale-95 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title={t('webClipperTooltip')}
            aria-label={t('webClipperTooltip')}
          >
            <Globe size={18} />
          </button>
        </div>
      </div>

      {/* ── Search Bar: responsive height and touch comfort ── */}
      <button
        onClick={onOpenSearch}
        className={cn(
          'flex items-center justify-between px-3 py-2 md:px-2.5 md:py-1.5 text-xs rounded-xl md:rounded-lg transition-all cursor-pointer border group min-h-[40px] md:min-h-0',
          isSearchActive
            ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300 shadow-2xs'
            : 'bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'
        )}
        title={`${t('search')} (Cmd+K)`}
      >
        <div className="flex items-center gap-2">
          <Search size={15} className="group-hover:text-purple-500 transition-colors" />
          <span className="font-medium">{t('search')}</span>
        </div>
        <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
          ⌘K
        </kbd>
      </button>
    </div>
  );
};
