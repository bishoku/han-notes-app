import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, FileCheck, Network, Sparkles, Settings } from 'lucide-react';
import { SyncStatusBadge } from '@/components/sync/SyncStatusBadge';
import { cn } from '@/lib/utils';

interface SidebarBottomNavProps {
  isTasksActive: boolean;
  isDecisionsActive: boolean;
  isMindmapActive: boolean;
  isAiEnabled: boolean;
  isChatDrawerOpen: boolean;
  onNavigateTasks: () => void;
  onNavigateDecisions: () => void;
  onNavigateMindmap: () => void;
  onToggleAi: () => void;
  onOpenSettings: () => void;
}

export const SidebarBottomNav: React.FC<SidebarBottomNavProps> = ({
  isTasksActive,
  isDecisionsActive,
  isMindmapActive,
  isAiEnabled,
  isChatDrawerOpen,
  onNavigateTasks,
  onNavigateDecisions,
  onNavigateMindmap,
  onToggleAi,
  onOpenSettings,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-2 border-t border-mac-borderLight dark:border-mac-borderDark flex flex-col gap-1">
      <button
        onClick={onNavigateTasks}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
          isTasksActive
            ? 'bg-mac-accent text-white font-medium shadow-xs'
            : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
        )}
      >
        <CheckCircle size={16} />
        {t('tasks')}
      </button>
      <button
        onClick={onNavigateDecisions}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
          isDecisionsActive
            ? 'bg-purple-600 text-white font-medium shadow-xs'
            : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
        )}
      >
        <FileCheck size={16} />
        {t('decisions')}
      </button>
      <button
        onClick={onNavigateMindmap}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
          isMindmapActive
            ? 'bg-emerald-600 text-white font-medium shadow-xs'
            : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
        )}
      >
        <Network size={16} />
        {t('mindmap')}
      </button>
      <button
        onClick={onToggleAi}
        className={cn(
          'flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
          isChatDrawerOpen
            ? 'bg-gradient-to-r from-purple-600 to-mac-accent text-white font-semibold shadow-xs'
            : isAiEnabled
            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold hover:bg-purple-500/20'
            : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className={isAiEnabled ? 'text-purple-500 animate-pulse' : ''} />
          <span>{t('aiAssistantTitle')}</span>
        </div>
        {isAiEnabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
      </button>

      <SyncStatusBadge variant="sidebar" />

      <button
        onClick={onOpenSettings}
        className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
      >
        <Settings size={16} />
        {t('settings')}
      </button>
    </div>
  );
};
