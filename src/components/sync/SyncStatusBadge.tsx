import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSyncStore } from '@/store/syncStore';
import { ArrowDownUp, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncStatusBadgeProps {
  variant?: 'statusbar' | 'sidebar';
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ variant = 'statusbar' }) => {
  const { t } = useTranslation();
  const { openModal, syncState, error } = useSyncStore();

  if (variant === 'sidebar') {
    return (
      <button
        onClick={() => openModal('share')}
        className="flex items-center justify-between px-2 py-1.5 text-xs rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
        title={t('syncButtonTooltip')}
      >
        <div className="flex items-center gap-2">
          {syncState === 'syncing' ? (
            <RefreshCw size={16} className="text-indigo-500 animate-spin" />
          ) : syncState === 'completed' ? (
            <CheckCircle2 size={16} className="text-emerald-500" />
          ) : (
            <ArrowDownUp size={16} className="text-indigo-500" />
          )}
          <span>{t('syncNavButton')}</span>
        </div>
        {syncState === 'syncing' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />}
      </button>
    );
  }

  // StatusBar variant
  return (
    <button
      onClick={() => openModal('share')}
      className={cn(
        'flex items-center gap-1.5 px-1.5 py-0.5 rounded cursor-pointer transition-colors text-[11px]',
        syncState === 'syncing'
          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10'
          : error
          ? 'text-red-500 hover:bg-red-500/10'
          : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-zinc-400'
      )}
      title={t('syncButtonTooltip')}
    >
      {syncState === 'syncing' ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : error ? (
        <AlertTriangle className="w-3 h-3 text-red-500" />
      ) : syncState === 'completed' ? (
        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
      ) : (
        <ArrowDownUp className="w-3 h-3 text-indigo-500" />
      )}
      <span className="font-medium">
        {syncState === 'syncing' ? t('syncInProgress') : t('syncStatusBarLabel')}
      </span>
    </button>
  );
};
