import React, { useEffect, useState, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '@/components/Sidebar';
import { RightPanel } from '@/components/RightPanel';
import { AppStatusBar } from '@/components/statusbar/AppStatusBar';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';
import { useAiStore } from '@/store/aiStore';
import { isFileSystemAccessSupported } from '@/services/storage';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { workspaceManager } from '@/services/workspace';
import { WorkspaceHubScreen } from '@/components/workspace/WorkspaceHubScreen';
import { useGitStore } from '@/store/gitStore';
import { useSyncStore } from '@/store/syncStore';
import { eventBus } from '@/lib/eventBus';
import { applyAppTheme } from '@/utils/theme';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { showToast } from '@/store/toastStore';

const ChatDrawer = React.lazy(() =>
  import('@/components/ai/ChatDrawer').then((m) => ({ default: m.ChatDrawer }))
);
const QuickSearchModal = React.lazy(() =>
  import('@/components/search/QuickSearchModal').then((m) => ({ default: m.QuickSearchModal }))
);
const SettingsModal = React.lazy(() =>
  import('@/components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const NoteHistoryDrawer = React.lazy(() =>
  import('@/components/git/NoteHistoryDrawer').then((m) => ({ default: m.NoteHistoryDrawer }))
);
const WebClipperModal = React.lazy(() =>
  import('@/components/clipper/WebClipperModal').then((m) => ({ default: m.WebClipperModal }))
);
const P2PSyncModal = React.lazy(() =>
  import('@/components/sync/P2PSyncModal').then((m) => ({ default: m.P2PSyncModal }))
);
const WorkspaceModal = React.lazy(() =>
  import('@/components/workspace/WorkspaceModal').then((m) => ({ default: m.WorkspaceModal }))
);
const MoveItemModal = React.lazy(() =>
  import('@/components/workspace/MoveItemModal').then((m) => ({ default: m.MoveItemModal }))
);

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

  // ── Global Keyboard Shortcuts (Cmd+K, Cmd+S, Cmd+N, Cmd+\, Cmd+,, Cmd+Shift+E) ──
  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      const key = e.key.toLowerCase();

      if (key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
        return;
      }

      if (key === 's') {
        e.preventDefault();
        const currentNoteId = useNoteStore.getState().currentNoteId;
        const note = useNoteStore.getState().notes.find((n) => n.id === currentNoteId);
        const title = note?.title || currentNoteId?.split('/').pop() || 'Manuel snapshot';
        await useGitStore.getState().createSnapshot(`Manuel snapshot: ${title}`);
        showToast(t('snapshotCreated', 'Anlık görüntü kaydedildi'), {
          description: title,
          type: 'success',
        });
        return;
      }

      if (key === '\\') {
        e.preventDefault();
        const current = useUiStore.getState().sidebarOpen;
        useUiStore.getState().setSidebarOpen(!current);
        return;
      }

      if (key === ',') {
        e.preventDefault();
        useUiStore.getState().setSettingsModalOpen(true);
        return;
      }

      if (e.shiftKey && key === 'e') {
        e.preventDefault();
        const currentMode = useUiStore.getState().editorMode;
        const nextMode = currentMode === 'preview' ? 'raw' : 'preview';
        useUiStore.getState().setEditorMode(nextMode);
        showToast(
          nextMode === 'preview'
            ? t('statusEditorPreview', 'Önizleme Modu')
            : t('statusEditorRaw', 'Ham Metin Modu'),
          { type: 'info', duration: 1800 }
        );
        return;
      }

      if (key === 'n' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const { activeFolderPath, notes, createNote } = useNoteStore.getState();
        const baseTitle = t('untitledNote', 'Yeni Not');
        let candidate = baseTitle;
        let counter = 1;
        const existingTitles = new Set(
          notes.map((n) => (n.id.split('/').pop() || n.id).replace(/\.md$/i, '').toLowerCase())
        );
        while (existingTitles.has(candidate.toLowerCase())) {
          counter += 1;
          candidate = `${baseTitle} ${counter}`;
        }
        const newNoteId = await createNote(candidate, activeFolderPath || undefined);
        if (newNoteId) {
          useUiStore.getState().setViewMode('notes');
          navigate(`/notes/${encodeURIComponent(newNoteId)}`);
          showToast(t('newNoteCreated', 'Yeni not oluşturuldu'), {
            description: candidate,
            type: 'success',
          });
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [setSearchModalOpen, navigate, t]);

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
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
        {isNotesRoute && rightPanelOpen && <RightPanel />}
        <Suspense fallback={null}>
          <ChatDrawer />
        </Suspense>
      </div>

      {/* Global Bottom Status Bar (VS Code style) */}
      <AppStatusBar />

      {/* Global Overlays & Modals */}
      <Suspense fallback={null}>
        <QuickSearchModal />
        <SettingsModal />
        <NoteHistoryDrawer />
        {clipperModalOpen && (
          <WebClipperModal
            isOpen={clipperModalOpen}
            onClose={() => setClipperModalOpen(false)}
          />
        )}
        <P2PSyncModal />
        <WorkspaceModal />
        <MoveItemModal />
      </Suspense>
      <ToastContainer />
    </div>
  );
};
