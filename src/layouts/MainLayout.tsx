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
import { isFileSystemAccessSupported } from '@/services/storage';
import { QuickSearchModal } from '@/components/search/QuickSearchModal';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { workspaceManager } from '@/services/workspace';
import { WorkspaceModal, WorkspaceHubScreen, MoveItemModal } from '@/components/workspace';

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

  // ── Storage & Workspace Init ──
  useEffect(() => {
    const init = async () => {
      try {
        await useWorkspaceStore.getState().initWorkspaces();
        const activeWs = useWorkspaceStore.getState().getActiveWorkspace();

        if (isTauri()) {
          setStorageReady(true);
          await loadVault();
        } else if (activeWs && activeWs.storageType === 'indexeddb') {
          // Scoped IndexedDB workspace on any platform (desktop or mobile)
          setStorageReady(true);
          await loadVault();
        } else if (!isFileSystemAccessSupported()) {
          // Mobile / Safari / PWA (Scoped IndexedDB)
          setStorageReady(true);
          await loadVault();
        } else {
          // Browser FSA: Check if active workspace has readwrite permission
          if (activeWs && activeWs.storageType === 'browser') {
            const handle = await workspaceManager.getDirectoryHandle(activeWs.id);
            if (handle) {
              try {
                const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
                if (perm === 'granted') {
                  setStorageReady(true);
                  await loadVault();
                  return;
                }
              } catch (err) {
                console.warn('[MainLayout] Permission query check:', err);
              }
            }
          }
          // Show Workspace Hub screen to grant permission or pick workspace
          setNeedsDirectoryPick(true);
        }
      } catch (err: any) {
        console.error('[MainLayout] Workspace init failed:', err);
      }
    };
    init();

    // Prevent default native WebKit right-click context menu globally
    const disableContextMenu = (e: MouseEvent) => { e.preventDefault(); };
    window.addEventListener('contextmenu', disableContextMenu);
    return () => window.removeEventListener('contextmenu', disableContextMenu);
  }, [loadVault]);

  // ── Directory / Workspace Picker Hub Screen (Browser only, first visit or permission needed) ──
  if (needsDirectoryPick) {
    return (
      <WorkspaceHubScreen
        onWorkspaceSelected={async () => {
          setNeedsDirectoryPick(false);
          setStorageReady(true);
          await loadVault();
        }}
      />
    );
  }

  // ── Loading ──
  if (!storageReady) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-mac-mainLight dark:bg-mac-mainDark">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📝</div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('initializing')}</p>
        </div>
      </div>
    );
  }

  // ── Main App Layout with Outlet and Bottom AppStatusBar ──
  return (
    <div className="flex flex-col h-full h-[100dvh] max-h-[100dvh] w-full overflow-hidden antialiased text-gray-900 dark:text-gray-100 bg-mac-mainLight dark:bg-mac-mainDark selection:bg-mac-accent/30 print:h-auto print:overflow-visible print:bg-white print:block">
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
      <WorkspaceModal />
      <MoveItemModal />
    </div>
  );
};
