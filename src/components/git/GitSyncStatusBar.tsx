/**
 * GitSyncStatusBar.tsx — Status bar component displaying Git & Sync state.
 * Shows status indicator, uncommitted change counts, and Quick Sync button.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGitStore } from '@/store/gitStore';
import {
  GitBranch,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  GitCommit,
  Loader2,
  CloudUpload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const GitSyncStatusBar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    isInitialized,
    status,
    isSyncing,
    syncError,
    lastSyncTime,
    settings,
    refreshStatus,
    initRepo,
    syncNow,
  } = useGitStore();

  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleSyncClick = async () => {
    const changes = (status?.modifiedFiles.length || 0) + (status?.untrackedFiles.length || 0);
    await syncNow();
    if (changes === 0 && !settings.remoteUrl) {
      setFeedback(t('statusNoChanges'));
      setTimeout(() => setFeedback(null), 1800);
    }
  };

  const totalChanges =
    (status?.modifiedFiles.length || 0) + (status?.untrackedFiles.length || 0);

  if (!isInitialized) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => initRepo()}
          disabled={isSyncing}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-md border border-purple-200 dark:border-purple-800/60 transition-colors shadow-2xs cursor-pointer"
          title={t('gitSyncDesc')}
        >
          {isSyncing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <GitBranch className="w-3 h-3" />
          )}
          <span>{t('gitInit')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 text-[11px]">
      {/* Branch & Sync Status Badge */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-0.5 rounded-md border transition-colors',
          syncError
            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            : isSyncing
            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
            : totalChanges > 0
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
        )}
        title={
          syncError ||
          (totalChanges > 0
            ? t('statusChangesCount', { count: totalChanges })
            : lastSyncTime
            ? `${t('gitLastSync')}: ${new Date(lastSyncTime).toLocaleTimeString(i18n.language === 'tr' ? 'tr-TR' : 'en-US')}`
            : t('statusUpToDate'))
        }
      >
        <GitBranch className="w-3 h-3 shrink-0 opacity-75" />
        <span className="font-mono font-medium">{status?.branch || 'main'}</span>

        <span className="w-1 h-1 rounded-full bg-current opacity-60" />

        {isSyncing ? (
          <span className="flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            <span>{t('statusSyncing')}</span>
          </span>
        ) : syncError ? (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>{t('statusSyncError')}</span>
          </span>
        ) : totalChanges > 0 ? (
          <span className="flex items-center gap-1 font-medium">
            <GitCommit className="w-2.5 h-2.5" />
            <span>{t('statusChangesCount', { count: totalChanges })}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>{t('statusUpToDate')}</span>
          </span>
        )}
      </div>

      {/* Sync Button (if remote or local sync enabled) */}
      <button
        onClick={handleSyncClick}
        disabled={isSyncing}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
        title={t('gitSyncNow')}
      >
        {isSyncing ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : feedback ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        ) : settings.remoteUrl ? (
          <CloudUpload className="w-3 h-3" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
        <span>{feedback || (settings.remoteUrl ? t('gitSyncNow') : 'Snapshot')}</span>
      </button>
    </div>
  );
};

