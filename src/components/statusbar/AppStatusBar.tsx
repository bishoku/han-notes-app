import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGitStore } from '@/store/gitStore';
import { useAiStore } from '@/store/aiStore';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import {
  GitBranch,
  GitCommit,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Loader2,
  FileText,
  Clock,
  History,
  AlertTriangle,
  Eye,
  FileCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AppStatusBar: React.FC = () => {
  const { t } = useTranslation();
  const {
    isInitialized,
    status,
    isSyncing,
    syncError,
    settings,
    syncNow,
    openHistoryDrawer,
    refreshStatus,
    initRepo,
  } = useGitStore();

  const modelDownloadProgress = useAiStore((s) => s.modelDownloadProgress);
  const isAiIndexing = useAiStore((s) => s.isIndexing);
  const { currentNoteId, currentNoteContent, vaultPath } = useNoteStore();

  const [feedback, setFeedback] = useState<string | null>(null);

  const editorMode = useUiStore((s) => s.editorMode);
  const setEditorMode = useUiStore((s) => s.setEditorMode);

  // Automatically refresh git status on mount and when vault / note / focus changes
  useEffect(() => {
    refreshStatus();

    const handleFocus = () => {
      refreshStatus();
    };
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      refreshStatus();
    }, 15000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [refreshStatus, vaultPath]);

  // Compute note words and characters
  const text = currentNoteContent || '';
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const uniqueChangedFiles = new Set([
    ...(status?.modifiedFiles || []),
    ...(status?.untrackedFiles || []),
    ...(status?.stagedFiles || []),
  ]);
  const totalChanges = uniqueChangedFiles.size;

  const handleSyncClick = async () => {
    const changes = totalChanges;
    await syncNow();
    if (changes === 0 && !settings.remoteUrl) {
      setFeedback(t('statusNoChanges'));
      setTimeout(() => setFeedback(null), 1800);
    }
  };

  return (
    <footer className="hidden md:flex h-6.5 min-h-[26px] max-h-[26px] bg-gray-100/90 dark:bg-zinc-950/90 border-t border-gray-200 dark:border-zinc-800/80 px-3 items-center justify-between text-[11px] text-gray-600 dark:text-zinc-400 select-none z-30 shrink-0 backdrop-blur-xs font-sans">
      {/* ── Left: Git Branch, Status & Sync ── */}
      <div className="flex items-center gap-2 min-w-0">
        {isInitialized ? (
          <>
            {/* Branch item */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-default transition-colors"
              title={`${t('gitActiveBranch')}: ${status?.branch || 'main'}`}
            >
              <GitBranch className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                {status?.branch || 'main'}
              </span>
            </div>

            <span className="text-gray-300 dark:text-zinc-700">|</span>

            {/* Changes & Sync Trigger */}
            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              className={cn(
                'flex items-center gap-1.5 px-1.5 py-0.5 rounded cursor-pointer transition-colors disabled:opacity-50',
                syncError
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
                  : isSyncing
                  ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                  : totalChanges > 0
                  ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-medium'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-zinc-300'
              )}
              title={t('gitSyncNow')}
            >
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : syncError ? (
                <AlertTriangle className="w-3 h-3 text-red-500" />
              ) : feedback ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              ) : totalChanges > 0 ? (
                <GitCommit className="w-3 h-3" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              )}

              <span>
                {feedback ||
                  (isSyncing
                    ? t('statusSyncing')
                    : syncError
                    ? t('statusSyncError')
                    : totalChanges > 0
                    ? t('statusChangesCount', { count: totalChanges })
                    : t('statusUpToDate'))}
              </span>
            </button>

            {/* Note History Drawer Button (if note active) */}
            {currentNoteId && (
              <button
                onClick={() => openHistoryDrawer(currentNoteId)}
                className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title={t('versionHistoryAndDiff')}
              >
                <History className="w-3 h-3" />
                <span>{t('statusHistory')}</span>
              </button>
            )}
          </>
        ) : (
          <button
            onClick={async () => {
              try {
                await initRepo();
              } catch {
                setFeedback(t('error'));
                setTimeout(() => setFeedback(null), 2500);
              }
            }}
            className="flex items-center gap-1 text-gray-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-black/5 dark:hover:bg-white/5 px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-colors"
            title={t('gitSyncDesc')}
          >
            <GitBranch className="w-3 h-3 text-gray-400 dark:text-zinc-500" />
            <span>{t('statusGitNotInit')}</span>
          </button>
        )}
      </div>

      {/* ── Center: AI Embedding & Indexing Indicator ── */}
      <div className="flex items-center gap-2 px-2">
        {modelDownloadProgress && modelDownloadProgress.progress < 100 ? (
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full font-medium animate-pulse">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>{t('statusAiModelDownloading')}</span>
          </div>
        ) : isAiIndexing ? (
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            <span>{t('aiIndexing')}...</span>
          </div>
        ) : null}
      </div>

      {/* ── Right: Document Stats & Workspace Metadata ── */}
      <div className="flex items-center gap-2.5">
        {currentNoteId && (
          <>
            {/* Word & Char Count */}
            <div
              className="flex items-center gap-1 px-1 py-0.5 text-gray-600 dark:text-zinc-400"
              title={`${t('statusWordsCount', { count: wordCount })}, ${t('statusCharsCount', { count: charCount })}`}
            >
              <FileText className="w-3 h-3 opacity-60" />
              <span>
                {t('statusWordsCount', { count: wordCount })}, {t('statusCharsCount', { count: charCount })}
              </span>
            </div>

            <span className="text-gray-300 dark:text-zinc-700 hidden md:inline">|</span>

            {/* Reading Time */}
            <div
              className="hidden md:flex items-center gap-1 px-1 py-0.5 text-gray-500 dark:text-zinc-500"
              title={t('statusReadingTime', { minutes: readingTimeMinutes })}
            >
              <Clock className="w-3 h-3 opacity-60" />
              <span>{t('statusReadingTime', { minutes: readingTimeMinutes })}</span>
            </div>

            <span className="text-gray-300 dark:text-zinc-700 hidden sm:inline">|</span>
          </>
        )}

        {/* Editor Mode Quick Switcher */}
        <button
          onClick={() => setEditorMode(editorMode === 'preview' ? 'raw' : 'preview')}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
          title={`${editorMode === 'preview' ? t('statusEditorPreview') : t('statusEditorRaw')}`}
        >
          {editorMode === 'preview' ? (
            <Eye className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          ) : (
            <FileCode className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          )}
          <span>{editorMode === 'preview' ? t('modePreview') : t('modeRaw')}</span>
        </button>

        <span className="text-gray-300 dark:text-zinc-700 hidden sm:inline">|</span>

        {/* Encoding / Format Badge */}
        <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono opacity-75">
          <span>UTF-8</span>
          <span className="opacity-40">/</span>
          <span>Markdown</span>
        </div>
      </div>
    </footer>
  );
};

