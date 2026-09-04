import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '@/components/Sidebar';
import { RightPanel } from '@/components/RightPanel';
import { AppStatusBar } from '@/components/statusbar/AppStatusBar';
import { ChatDrawer } from '@/components/ai/ChatDrawer';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';
import { useAiStore } from '@/store/aiStore';
import {
  initBrowserStorage,
  initIndexedDbStorage,
  isFileSystemAccessSupported,
  pickBrowserDirectory,
  getSavedDirectoryName,
  requestSavedDirectoryPermission,
} from '@/services/storage';
import { QuickSearchModal } from '@/components/search/QuickSearchModal';
import { FolderOpen, FolderCheck, Loader2 } from 'lucide-react';

import { useGitStore } from '@/store/gitStore';
import { SettingsModal } from '@/components/SettingsModal';
import { NoteHistoryDrawer } from '@/components/git/NoteHistoryDrawer';
import { WebClipperModal } from '@/components/clipper/WebClipperModal';
import { P2PSyncModal } from '@/components/sync/P2PSyncModal';
import { useSyncStore } from '@/store/syncStore';
import { eventBus } from '@/lib/eventBus';
import { applyAppTheme } from '@/utils/theme';

/**
 * Detect if we're running inside a Tauri desktop app.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export const MainLayout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isNotesRoute = location.pathname === '/' || location.pathname.startsWith('/notes');

  // Individual Zustand selectors — prevent re-renders from unrelated store changes
  const theme = useUiStore(s => s.theme);
  const rightPanelOpen = useUiStore(s => s.rightPanelOpen);
  const initPreferences = useUiStore(s => s.initPreferences);
  const setSearchModalOpen = useUiStore(s => s.setSearchModalOpen);
  const loadVault = useNoteStore(s => s.loadVault);
  const { initAiStore } = useAiStore();
  const [storageReady, setStorageReady] = useState(false);
  const [needsDirectoryPick, setNeedsDirectoryPick] = useState(false);
  const [savedDirName, setSavedDirName] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [clipperModalOpen, setClipperModalOpen] = useState(false);

  // ── Clipper Cross-Tab Synchronization ──
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel('han_clipper_channel');
    channel.onmessage = (event) => {
      // Only respond as an active main tab if we are NOT on the /import-clip route
      const isImportRoute =
        window.location.hash.includes('import-clip') ||
        window.location.pathname.includes('import-clip');

      if (event.data?.type === 'CLIPPER_PING' && !isImportRoute) {
        channel.postMessage({ type: 'CLIPPER_PONG' });
      } else if (event.data?.type === 'OPEN_IMPORTED_NOTE' && !isImportRoute) {
        const { noteId } = event.data;
        if (noteId) {
          useNoteStore.getState().loadVault().then(() => {
            useNoteStore.getState().selectNote(noteId, true);
            navigate(`/notes/${encodeURIComponent(noteId)}`);
          });
          try {
            window.focus();
          } catch {}
        }
      }
    };

    return () => {
      channel.close();
    };
  }, [navigate]);

  // ── Web Clipper Modal Event Listener ──
  useEffect(() => {
    const unsub = eventBus.on('clipper:open-modal', () => {
      setClipperModalOpen(true);
    });
    return () => unsub();
  }, []);

  // ── Automatic QR Code Pairing Link Handler (#sync=...&key=...) ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkHashSync = () => {
      const hash = window.location.hash;
      if (hash.includes('sync=') && hash.includes('key=')) {
        useSyncStore.getState().openModal('scan');
        useSyncStore.getState().startPeerSession(hash);
      }
    };

    checkHashSync();
    window.addEventListener('hashchange', checkHashSync);
    return () => window.removeEventListener('hashchange', checkHashSync);
  }, []);

  // ── Global Keyboard Shortcuts (Cmd+K / Ctrl+K, Cmd+S / Ctrl+S) ──
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const currentNoteId = useNoteStore.getState().currentNoteId;
        const note = useNoteStore.getState().notes.find((n) => n.id === currentNoteId);
        const title = note?.title || currentNoteId?.split('/').pop() || 'Manuel snapshot';
        useGitStore.getState().createSnapshot(`Manuel snapshot: ${title}`);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [setSearchModalOpen]);

  // ── Theme & Preferences Init ──
  useEffect(() => {
    initPreferences();
    initAiStore();
  }, [initPreferences, initAiStore]);

  useEffect(() => {
    applyAppTheme(theme);
  }, [theme]);

  // ── Storage Init ──
  useEffect(() => {
    const init = async () => {
      if (isTauri()) {
        // Tauri: no directory picker needed, load directly
        setStorageReady(true);
        await loadVault();
      } else if (!isFileSystemAccessSupported()) {
        // Mobile or unsupported browser: automatically initialize IndexedDB storage
        try {
          await initIndexedDbStorage();
          setStorageReady(true);
          await loadVault();
        } catch (err: any) {
          console.error('[MainLayout] IndexedDB init failed:', err);
          setStorageError(err?.message || t('directoryRestoreError'));
        }
      } else {
        // Browser: try to reuse saved handle silently (no user gesture needed for that)
        try {
          await initBrowserStorage();
          setStorageReady(true);
          await loadVault();
        } catch {
          // Check if there's a previously used directory name
          const name = await getSavedDirectoryName();
          if (name) {
            setSavedDirName(name);
          }
          setNeedsDirectoryPick(true);
        }
      }
    };
    init();

    // Prevent default native WebKit right-click context menu globally
    const disableContextMenu = (e: MouseEvent) => { e.preventDefault(); };
    window.addEventListener('contextmenu', disableContextMenu);
    return () => window.removeEventListener('contextmenu', disableContextMenu);
  }, [loadVault, t]);

  // Handler to restore permission on previously chosen directory (requires user click)
  const handleRestoreDirectory = async () => {
    setIsRestoring(true);
    setStorageError(null);
    try {
      const granted = await requestSavedDirectoryPermission();
      if (granted) {
        setNeedsDirectoryPick(false);
        setStorageReady(true);
        await loadVault();
      } else {
        setStorageError(t('directoryAccessDenied'));
      }
    } catch (e: any) {
      setStorageError(e?.message || t('directoryRestoreError'));
    } finally {
      setIsRestoring(false);
    }
  };

  // Handler to pick a new directory (requires user click)
  const handlePickDirectory = async () => {
    setStorageError(null);
    try {
      await pickBrowserDirectory();
      setNeedsDirectoryPick(false);
      setStorageReady(true);
      await loadVault();
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setStorageError(e?.message || t('directorySelectError'));
      }
    }
  };

  // ── Directory Picker Screen (Browser only, first visit or permission needed) ──
  if (needsDirectoryPick) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white/10 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/20 dark:border-zinc-700/50 shadow-2xl text-center text-white">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-2xl font-bold tracking-tight">H</span>
          </div>

          <h1 className="text-2xl font-bold mb-2">H.A.N. Not Defteri</h1>
          <p className="text-sm text-gray-300 dark:text-gray-400 mb-6 leading-relaxed">
            {t('storagePermissionDesc')}
          </p>

          {storageError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-xs text-red-200">
              {storageError}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {savedDirName ? (
              <>
                <button
                  onClick={handleRestoreDirectory}
                  disabled={isRestoring}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 transition-all cursor-pointer"
                >
                  {isRestoring ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <FolderCheck size={18} />
                  )}
                  <span>{t('grantFolderPermission', { name: savedDirName })}</span>
                </button>

                <button
                  onClick={handlePickDirectory}
                  disabled={isRestoring}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold text-gray-300 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <FolderOpen size={15} />
                  {t('selectDifferentFolder')}
                </button>
              </>
            ) : (
              <button
                onClick={handlePickDirectory}
                className="w-full inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
              >
                <FolderOpen size={18} />
                {t('selectFolder')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (!storageReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-mac-mainLight dark:bg-mac-mainDark">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📝</div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('initializing')}</p>
        </div>
      </div>
    );
  }

  // ── Main App Layout with Outlet and Bottom AppStatusBar ──
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden antialiased text-gray-900 dark:text-gray-100 bg-mac-mainLight dark:bg-mac-mainDark selection:bg-mac-accent/30 print:h-auto print:overflow-visible print:bg-white print:block">
      {/* Workspace Body: Sidebar + Dynamic Route Outlet + RightPanel + ChatDrawer */}
      <div className="flex-1 flex min-h-0 w-full overflow-hidden print:h-auto print:overflow-visible print:block">
        <Sidebar />
        <div className="flex-1 flex min-w-0 h-full overflow-hidden relative print:h-auto print:overflow-visible print:static print:block">
          <Outlet />
        </div>
        {isNotesRoute && rightPanelOpen && <RightPanel />}
        <ChatDrawer />
      </div>

      {/* Global Bottom Status Bar (VS Code style) */}
      <AppStatusBar />

      {/* Global Overlays & Modals */}
      <QuickSearchModal />
      <SettingsModal />
      <NoteHistoryDrawer />
      <WebClipperModal
        isOpen={clipperModalOpen}
        onClose={() => setClipperModalOpen(false)}
      />
      <P2PSyncModal />
    </div>
  );
};
