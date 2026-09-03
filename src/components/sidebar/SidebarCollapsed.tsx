import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Settings,
  CheckCircle,
  FilePlus,
  FileCheck,
  Network,
  Sparkles,
  PanelLeftOpen,
  FolderTree,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarCollapsedProps {
  isNotesActive: boolean;
  isTasksActive: boolean;
  isDecisionsActive: boolean;
  isMindmapActive: boolean;
  isSearchActive: boolean;
  isAiEnabled: boolean;
  isChatDrawerOpen: boolean;
  onExpand: () => void;
  onOpenNewNote: () => void;
  onOpenSearch: () => void;
  onNavigateNotes: () => void;
  onNavigateTasks: () => void;
  onNavigateDecisions: () => void;
  onNavigateMindmap: () => void;
  onToggleAi: () => void;
  onOpenSettings: () => void;
}

export const SidebarCollapsed: React.FC<SidebarCollapsedProps> = ({
  isNotesActive,
  isTasksActive,
  isDecisionsActive,
  isMindmapActive,
  isSearchActive,
  isAiEnabled,
  isChatDrawerOpen,
  onExpand,
  onOpenNewNote,
  onOpenSearch,
  onNavigateNotes,
  onNavigateTasks,
  onNavigateDecisions,
  onNavigateMindmap,
  onToggleAi,
  onOpenSettings,
}) => {
  const { t } = useTranslation();

  return (
    <aside className="w-13 min-w-[52px] max-w-[52px] h-full bg-mac-sidebarLight dark:bg-mac-sidebarDark border-r border-mac-borderLight dark:border-mac-borderDark flex flex-col items-center justify-between py-3 select-none transition-all duration-200 ease-mac-ease relative z-20 shrink-0">
      {/* Top Icon Group: Expand, Explorer, Search, New Note */}
      <div className="flex flex-col items-center gap-2 w-full px-1.5">
        <button
          onClick={onExpand}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title={t('expandSidebar')}
        >
          <PanelLeftOpen size={18} />
        </button>

        <button
          onClick={onNavigateNotes}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer',
            isNotesActive
              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-semibold'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
          )}
          title={t('notesExplorer')}
        >
          <FolderTree size={18} />
        </button>

        <button
          onClick={onOpenSearch}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer',
            isSearchActive
              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-semibold'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
          )}
          title={`${t('search')} (Cmd+K)`}
        >
          <Search size={18} />
        </button>

        <button
          onClick={onOpenNewNote}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title={t('newNote')}
        >
          <FilePlus size={18} />
        </button>
      </div>

      {/* Bottom Icon Group: Tasks, Decisions, Mindmap, AI, Settings */}
      <div className="flex flex-col items-center gap-2 w-full px-1.5 border-t border-mac-borderLight dark:border-mac-borderDark pt-2">
        <button
          onClick={onNavigateTasks}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer',
            isTasksActive
              ? 'bg-mac-accent text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
          )}
          title={t('tasks')}
        >
          <CheckCircle size={18} />
        </button>

        <button
          onClick={onNavigateDecisions}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer',
            isDecisionsActive
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
          )}
          title={t('decisions')}
        >
          <FileCheck size={18} />
        </button>

        <button
          onClick={onNavigateMindmap}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer',
            isMindmapActive
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
          )}
          title={t('mindmap')}
        >
          <Network size={18} />
        </button>

        <button
          onClick={onToggleAi}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer relative',
            isChatDrawerOpen
              ? 'bg-gradient-to-r from-purple-600 to-mac-accent text-white shadow-xs'
              : isAiEnabled
              ? 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
          )}
          title={t('aiAssistantTitle')}
        >
          <Sparkles size={18} className={isAiEnabled ? 'text-purple-500 animate-pulse' : ''} />
          {isAiEnabled && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title={t('settings')}
        >
          <Settings size={18} />
        </button>
      </div>
    </aside>
  );
};
