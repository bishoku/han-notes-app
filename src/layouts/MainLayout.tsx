import React, { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MainEditor } from '@/components/MainEditor';
import { RightPanel } from '@/components/RightPanel';
import { TasksView } from '@/components/TasksView';
import { DecisionsView } from '@/components/DecisionsView';
import { MindmapView } from '@/components/MindmapView';
import { ChatDrawer } from '@/components/ai/ChatDrawer';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';
import { useAiStore } from '@/store/aiStore';
import {
  initBrowserStorage,
  pickBrowserDirectory,
  getSavedDirectoryName,
  requestSavedDirectoryPermission,
} from '@/services/storage';
import { ModelDownloadIndicator } from '@/components/ai/ModelDownloadIndicator';
import { QuickSearchModal } from '@/components/search/QuickSearchModal';
import { SearchView } from '@/components/search/SearchView';
import { FolderOpen, FolderCheck, Loader2 } from 'lucide-react';

import { SettingsModal } from '@/components/SettingsModal';
import { applyAppTheme } from '@/utils/theme';

/**
 * Detect if we're running inside a Tauri desktop app.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export const MainLayout: React.FC = () => {
  // Individual Zustand selectors — prevent re-renders from unrelated store changes
  const theme = useUiStore(s => s.theme);
  const viewMode = useUiStore(s => s.viewMode);
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

  // ── Global Keyboard Shortcuts (Cmd+K / Ctrl+K) ──
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
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
      } else {
        // Browser: try to reuse saved handle silently (no user gesture needed for that)
        try {
          await initBrowserStorage();
          // If we get here, a saved handle was reused successfully
          setStorageReady(true);
          await loadVault();
        } catch {
          // Check if there is a saved directory name in IndexedDB
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
  }, [loadVault]);

  /**
   * Restore access to previously used directory with a single click permission prompt
   */
  const handleRestoreSavedDirectory = useCallback(async () => {
    setStorageError(null);
    setIsRestoring(true);
    try {
      const granted = await requestSavedDirectoryPermission();
      if (granted) {
        setNeedsDirectoryPick(false);
        setStorageReady(true);
        await loadVault();
      } else {
        setStorageError('Klasöre erişim izni verilmedi. Lütfen tarayıcı onayını kabul edin veya farklı bir klasör seçin.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      console.error('Failed to restore saved directory:', err);
      setStorageError('Klasör açılamadı. Lütfen farklı bir klasör seçin.');
    } finally {
      setIsRestoring(false);
    }
  }, [loadVault]);

  /**
   * Called from the "Select Folder" button — runs inside a user gesture
   */
  const handlePickDirectory = useCallback(async () => {
    setStorageError(null);
    try {
      await pickBrowserDirectory();
      setNeedsDirectoryPick(false);
      setStorageReady(true);
      await loadVault();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User closed/cancelled the directory picker — do not show red error
        return;
      }
      console.error('Directory picker failed:', err);
      setStorageError('Klasör seçilemedi veya izin verilmedi. Lütfen tekrar deneyin.');
    }
  }, [loadVault]);

  // ── Welcome Screen: Browser needs directory pick / permission ──
  if (needsDirectoryPick && !storageReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950 p-4">
        <div className="text-center max-w-lg w-full p-8 sm:p-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 dark:border-zinc-800/50 animate-in fade-in zoom-in-95 duration-200">
          <img src="icon-192.png" alt="H.A.N." className="w-20 h-20 mx-auto mb-5 rounded-2xl shadow-lg" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Han Notes'a Hoş Geldiniz</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            Notlarınız yerel olarak cihazınızda saklanır. Başlamak için çalışma klasörünüzü açın veya yeni bir klasör seçin.
          </p>

          {storageError && (
            <div className="mb-5 px-4 py-3 rounded-2xl bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium leading-relaxed text-left">
              {storageError}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {savedDirName ? (
              <>
                <button
                  onClick={handleRestoreSavedDirectory}
                  disabled={isRestoring}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 transition-all cursor-pointer"
                >
                  {isRestoring ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <FolderCheck size={18} />
                  )}
                  <span>"{savedDirName}" Klasörüne İzin Ver ve Aç</span>
                </button>

                <button
                  onClick={handlePickDirectory}
                  disabled={isRestoring}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800/80 transition-all cursor-pointer"
                >
                  <FolderOpen size={15} />
                  Farklı Bir Klasör Seç
                </button>
              </>
            ) : (
              <button
                onClick={handlePickDirectory}
                className="w-full inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
              >
                <FolderOpen size={18} />
                Klasör Seç
              </button>
            )}
          </div>

          <p className="mt-6 text-[11px] text-gray-400 dark:text-gray-500">
            Chrome, Edge veya Arc tarayıcıları önerilir. Verileriniz tamamen cihazınızdadır.
          </p>
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
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Başlatılıyor...</p>
        </div>
      </div>
    );
  }

  // ── Main App ──
  return (
    <div className="flex h-screen w-full overflow-hidden antialiased text-gray-900 dark:text-gray-100 bg-mac-mainLight dark:bg-mac-mainDark selection:bg-mac-accent/30">
      <Sidebar />
      {viewMode === 'notes' && <MainEditor />}
      {viewMode === 'tasks' && <TasksView />}
      {viewMode === 'decisions' && <DecisionsView />}
      {viewMode === 'mindmap' && <MindmapView />}
      {viewMode === 'search' && <SearchView />}
      {viewMode === 'notes' && rightPanelOpen && <RightPanel />}
      <ChatDrawer />
      <ModelDownloadIndicator />
      <QuickSearchModal />
      <SettingsModal />
    </div>
  );
};
