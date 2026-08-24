/**
 * GitSyncSettingsTab.tsx — Settings panel for Git Versioning & Remote Sync.
 * Supports On-Prem Bitbucket, GitHub, GitLab, and Local Time Machine.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGitStore } from '@/store/gitStore';
import {
  GitBranch,
  Cloud,
  HardDrive,
  RefreshCw,
  Check,
  AlertCircle,
  Clock,
  Shield,
  Loader2,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const GitSyncSettingsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    isInitialized,
    status,
    isSyncing,
    syncError,
    lastSyncTime,
    settings,
    initRepo,
    syncNow,
    updateSettings,
  } = useGitStore();

  const [remoteUrl, setRemoteUrl] = useState(settings.remoteUrl || '');
  const [authorName, setAuthorName] = useState(settings.authorName || 'HAN User');
  const [authorEmail, setAuthorEmail] = useState(settings.authorEmail || 'user@han-notes.local');
  const [mode, setMode] = useState<'local' | 'bitbucket' | 'github' | 'custom'>(settings.mode || 'local');
  const [autoCommit, setAutoCommit] = useState(settings.autoCommit ?? true);
  const [autoSync, setAutoSync] = useState(settings.autoSync ?? false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async () => {
    await updateSettings({
      enabled: true,
      mode,
      remoteUrl: remoteUrl.trim(),
      authorName: authorName.trim(),
      authorEmail: authorEmail.trim(),
      autoCommit,
      autoSync,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 select-text text-xs leading-relaxed text-gray-700 dark:text-gray-300">
      {/* Overview Banner */}
      <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 shrink-0">
          <GitBranch className="w-5 h-5" />
        </div>
        <div className="space-y-1 min-w-0">
          <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200">
            {t('gitSyncTitle')}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-[11px] leading-normal">
            {t('gitSyncDesc')}
          </p>
        </div>
      </div>

      {/* Repo Status Card */}
      <div className="p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{t('gitRepoStatus')}:</span>
            {isInitialized ? (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium text-[11px] flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>{t('gitActive')}</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                {t('gitNotInitialized')}
              </span>
            )}
          </div>

          {!isInitialized ? (
            <button
              onClick={() => initRepo()}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitBranch className="w-3 h-3" />}
              <span>{t('gitInit')}</span>
            </button>
          ) : (
            <button
              onClick={() => syncNow()}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 rounded-xl border border-purple-200 dark:border-purple-800 transition-colors shadow-2xs cursor-pointer"
            >
              {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span>{t('gitSyncNow')}</span>
            </button>
          )}
        </div>

        {isInitialized && status && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800 text-[11px]">
            <div>
              <span className="text-gray-500">{t('gitActiveBranch')}:</span>
              <p className="font-mono font-medium text-gray-900 dark:text-gray-100">{status.branch}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('gitModifiedNotes')}:</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">{status.modifiedFiles.length + status.untrackedFiles.length}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('gitLastSync')}:</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString(i18n.language === 'tr' ? 'tr-TR' : 'en-US') : t('gitNever')}
              </p>
            </div>
          </div>
        )}

        {syncError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{syncError}</span>
          </div>
        )}
      </div>

      {/* Mode Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-900 dark:text-gray-100">
          {t('settingsGitSync')}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setMode('local')}
            className={cn(
              'p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer',
              mode === 'local'
                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-700 shadow-2xs'
                : 'bg-white dark:bg-zinc-900/60 border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
            )}
          >
            <div className="flex items-center gap-2">
              <HardDrive className={cn('w-4 h-4', mode === 'local' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400')} />
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{t('gitModeLocal')}</span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-normal">
              {t('gitModeLocalDesc')}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode('bitbucket')}
            className={cn(
              'p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer',
              mode === 'bitbucket'
                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-700 shadow-2xs'
                : 'bg-white dark:bg-zinc-900/60 border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
            )}
          >
            <div className="flex items-center gap-2">
              <Server className={cn('w-4 h-4', mode === 'bitbucket' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400')} />
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{t('gitModeBitbucket')}</span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-normal">
              {t('gitModeBitbucketDesc')}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode('github')}
            className={cn(
              'p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer',
              mode === 'github'
                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-700 shadow-2xs'
                : 'bg-white dark:bg-zinc-900/60 border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
            )}
          >
            <div className="flex items-center gap-2">
              <Cloud className={cn('w-4 h-4', mode === 'github' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400')} />
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{t('gitModeGithub')}</span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-normal">
              {t('gitModeGithubDesc')}
            </p>
          </button>
        </div>
      </div>

      {/* Remote Repository URL (if mode !== local) */}
      {mode !== 'local' && (
        <div className="space-y-1.5 p-4 rounded-2xl bg-gray-50/50 dark:bg-zinc-950/40 border border-gray-200 dark:border-zinc-800">
          <label className="block text-xs font-semibold text-gray-900 dark:text-gray-100">
            {t('gitRemoteUrl')}
          </label>
          <input
            type="text"
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
            placeholder={
              mode === 'bitbucket'
                ? 'git@bitbucket.company.com:team/notes.git'
                : 'https://github.com/username/notes.git'
            }
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-mono text-gray-900 dark:text-gray-100"
          />
        </div>
      )}

      {/* Author Details & Automation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-900 dark:text-gray-100">
            {t('gitAuthorName')}
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-900 dark:text-gray-100">
            {t('gitAuthorEmail')}
          </label>
          <input
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            placeholder="user@company.com"
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Automation Checkboxes */}
      <div className="p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-3">
        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>{t('gitAutoSnapshots')}</span>
        </h4>

        <div className="space-y-2.5">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCommit}
              onChange={(e) => setAutoCommit(e.target.checked)}
              className="rounded border-gray-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
            />
            <span className="text-xs text-gray-800 dark:text-gray-200">
              {t('gitAutoSnapshots')} (30s idle)
            </span>
          </label>

          {mode !== 'local' && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="rounded border-gray-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-gray-800 dark:text-gray-200">
                {t('gitAutoSyncInterval')} (5 min Pull & Push)
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span>{t('gitSecurityNote')}</span>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl text-white bg-purple-600 hover:bg-purple-700 transition-all shadow-xs cursor-pointer"
        >
          {savedSuccess ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>{t('gitSaved')}</span>
            </>
          ) : (
            <span>{t('gitSaveSettings')}</span>
          )}
        </button>
      </div>
    </div>
  );
};

