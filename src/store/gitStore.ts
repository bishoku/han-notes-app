/**
 * gitStore.ts — Zustand store for Git Versioning, Time Machine & Sync.
 */
import { create } from 'zustand';
import { gitService, type GitStatusInfo, type GitCommitInfo, type GitDiffResult, type GitSyncSettings } from '@/services/git';
import { useNoteStore } from './noteStore';

const SETTINGS_KEY = 'han_git_sync_settings';

const DEFAULT_SETTINGS: GitSyncSettings = {
  enabled: false,
  mode: 'local',
  remoteUrl: '',
  branch: 'main',
  authorName: 'HAN Kullanıcısı',
  authorEmail: 'user@han-notes.local',
  autoCommit: true,
  autoCommitIntervalMinutes: 3,
  autoSync: false,
  autoSyncIntervalMinutes: 5,
};

function loadSettings(): GitSyncSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load git settings:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: GitSyncSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save git settings:', e);
  }
}

interface GitState {
  // Status
  isInitialized: boolean;
  status: GitStatusInfo | null;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncTime: number | null;
  settings: GitSyncSettings;

  // History Drawer State
  isHistoryDrawerOpen: boolean;
  historyNoteId: string | null;
  historyCommits: GitCommitInfo[];
  selectedCommit: GitCommitInfo | null;
  diffResult: GitDiffResult | null;
  isLoadingHistory: boolean;
  isLoadingDiff: boolean;
  hasMoreHistory: boolean;
  isLoadingMoreHistory: boolean;
  historyLimit: number;

  // Actions
  refreshStatus: () => Promise<void>;
  initRepo: () => Promise<void>;
  createSnapshot: (message?: string) => Promise<string | null>;
  syncNow: () => Promise<void>;
  openHistoryDrawer: (noteId: string) => Promise<void>;
  loadMoreHistory: () => Promise<void>;
  closeHistoryDrawer: () => void;
  selectHistoryCommit: (commit: GitCommitInfo) => Promise<void>;
  revertNote: (noteId: string, commitHash: string) => Promise<boolean>;
  updateSettings: (partial: Partial<GitSyncSettings>) => Promise<void>;
  triggerAutoCommitDebounced: (noteId: string) => void;
}

let autoSyncIntervalTimer: ReturnType<typeof setInterval> | null = null;
const INITIAL_PAGE_SIZE = 15;
const PAGE_STEP = 15;

export const useGitStore = create<GitState>((set, get) => ({
  isInitialized: false,
  status: null,
  isSyncing: false,
  syncError: null,
  lastSyncTime: null,
  settings: loadSettings(),

  isHistoryDrawerOpen: false,
  historyNoteId: null,
  historyCommits: [],
  selectedCommit: null,
  diffResult: null,
  isLoadingHistory: false,
  isLoadingDiff: false,
  hasMoreHistory: false,
  isLoadingMoreHistory: false,
  historyLimit: INITIAL_PAGE_SIZE,

  refreshStatus: async () => {
    try {
      const status = await gitService.getStatus();
      set({
        isInitialized: status.isInitialized,
        status,
        syncError: null,
      });
    } catch (err: any) {
      console.warn('Failed to refresh git status:', err);
      set({ isInitialized: false, status: null });
    }
  },

  initRepo: async () => {
    try {
      set({ isSyncing: true, syncError: null });
      await gitService.init();
      await get().refreshStatus();
      set({ isSyncing: false });
    } catch (err: any) {
      set({ isSyncing: false, syncError: err?.message || 'Git repo başlatılamadı.' });
      throw err;
    }
  },

  createSnapshot: async (message?: string) => {
    try {
      // 1. Flush any pending editor changes to storage before creating snapshot
      window.dispatchEvent(new CustomEvent('han-flush-note-save'));
      // Small tick for store update
      await new Promise((r) => setTimeout(r, 50));

      const msg = message || `Otomatik snapshot: ${new Date().toLocaleTimeString('tr-TR')}`;
      const hash = await gitService.createCommit(msg);
      await get().refreshStatus();
      return hash;
    } catch (err: any) {
      console.warn('Failed to create git snapshot:', err);
      return null;
    }
  },

  syncNow: async () => {
    const { isSyncing } = get();
    if (isSyncing) return;

    try {
      set({ isSyncing: true, syncError: null });
      const result = await gitService.sync(`Sync: ${new Date().toLocaleTimeString()}`);
      if (result.success) {
        set({
          isSyncing: false,
          lastSyncTime: Date.now(),
          syncError: null,
        });
        // Reload vault in case new notes or files were pulled
        await useNoteStore.getState().loadVault();
      } else {
        set({
          isSyncing: false,
          syncError: result.message || 'Senkronizasyon sırasında hata oluştu.',
        });
      }
      await get().refreshStatus();
    } catch (err: any) {
      set({
        isSyncing: false,
        syncError: err?.message || 'Senkronizasyon hatası.',
      });
    }
  },

  openHistoryDrawer: async (noteId: string) => {
    set({
      isHistoryDrawerOpen: true,
      historyNoteId: noteId,
      historyCommits: [],
      selectedCommit: null,
      diffResult: null,
      isLoadingHistory: true,
      isLoadingDiff: false,
      hasMoreHistory: false,
      isLoadingMoreHistory: false,
      historyLimit: INITIAL_PAGE_SIZE,
    });

    try {
      const commits = await gitService.getNoteHistory(noteId, INITIAL_PAGE_SIZE);
      set({
        historyCommits: commits,
        isLoadingHistory: false,
        hasMoreHistory: commits.length >= INITIAL_PAGE_SIZE,
      });

      if (commits.length > 0) {
        // Automatically select the most recent commit
        await get().selectHistoryCommit(commits[0]);
      }
    } catch (err: any) {
      console.warn('Failed to load note history:', err);
      set({ isLoadingHistory: false, historyCommits: [], hasMoreHistory: false });
    }
  },

  loadMoreHistory: async () => {
    const { historyNoteId, historyLimit, historyCommits, isLoadingMoreHistory, hasMoreHistory } = get();
    if (!historyNoteId || isLoadingMoreHistory || !hasMoreHistory) return;

    set({ isLoadingMoreHistory: true });
    const nextLimit = historyLimit + PAGE_STEP;

    try {
      const commits = await gitService.getNoteHistory(historyNoteId, nextLimit);
      const isEnd = commits.length <= historyCommits.length || commits.length < nextLimit;

      set({
        historyCommits: commits,
        historyLimit: nextLimit,
        hasMoreHistory: !isEnd,
        isLoadingMoreHistory: false,
      });
    } catch (err) {
      console.warn('Failed to load more note history:', err);
      set({ isLoadingMoreHistory: false, hasMoreHistory: false });
    }
  },

  closeHistoryDrawer: () => {
    set({
      isHistoryDrawerOpen: false,
      historyNoteId: null,
      selectedCommit: null,
      diffResult: null,
    });
  },

  selectHistoryCommit: async (commit: GitCommitInfo) => {
    const { historyNoteId } = get();
    if (!historyNoteId) return;

    set({ selectedCommit: commit, isLoadingDiff: true });
    try {
      const diff = await gitService.getNoteDiff(historyNoteId, commit.hash);
      set({ diffResult: diff, isLoadingDiff: false });
    } catch (err: any) {
      console.warn('Failed to load diff:', err);
      set({ diffResult: null, isLoadingDiff: false });
    }
  },

  revertNote: async (noteId: string, commitHash: string) => {
    try {
      set({ isSyncing: true });
      await gitService.revertNoteToCommit(noteId, commitHash);
      await useNoteStore.getState().refreshCurrentNote();
      await useNoteStore.getState().loadVault();
      await get().refreshStatus();
      set({ isSyncing: false });
      return true;
    } catch (err: any) {
      set({ isSyncing: false, syncError: err?.message || 'Geri yükleme başarısız.' });
      return false;
    }
  },

  updateSettings: async (partial: Partial<GitSyncSettings>) => {
    const newSettings = { ...get().settings, ...partial };
    set({ settings: newSettings });
    saveSettings(newSettings);

    if (partial.remoteUrl !== undefined) {
      try {
        await gitService.setRemoteUrl(partial.remoteUrl);
      } catch (err) {
        console.warn('Failed to set remote url:', err);
      }
    }

    // Update auto sync timers
    if (autoSyncIntervalTimer) {
      clearInterval(autoSyncIntervalTimer);
      autoSyncIntervalTimer = null;
    }

    if (newSettings.enabled && newSettings.autoSync && newSettings.autoSyncIntervalMinutes > 0) {
      const ms = newSettings.autoSyncIntervalMinutes * 60 * 1000;
      autoSyncIntervalTimer = setInterval(() => {
        get().syncNow();
      }, ms);
    }
  },

  triggerAutoCommitDebounced: (_noteId: string) => {
    // Deprecated: Typing timer disabled in favor of Note-Switch and Cmd+S snapshots
  },
}));
