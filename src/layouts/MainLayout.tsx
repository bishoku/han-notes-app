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
import { initBrowserStorage, pickBrowserDirectory } from '@/services/storage';
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner';
import { ModelDownloadIndicator } from '@/components/ai/ModelDownloadIndicator';
import { QuickSearchModal } from '@/components/search/QuickSearchModal';
import { SearchView } from '@/components/search/SearchView';
import { FolderOpen } from 'lucide-react';

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
          // No saved handle or permission denied — need user click
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
   * Called from the "Select Folder" button — this runs inside a user gesture,
   * so showDirectoryPicker() is allowed by the browser.
   */
  const handlePickDirectory = useCallback(async () => {
    setStorageError(null);
    try {
      await pickBrowserDirectory();
      setNeedsDirectoryPick(false);
      setStorageReady(true);
      await loadVault();
    } catch (err) {
      console.error('Directory picker failed:', err);
      setStorageError('Klasör seçilemedi veya izin verilmedi. Lütfen tekrar deneyin.');
    }
  }, [loadVault]);

  // ── Welcome Screen: Browser needs directory pick ──
  if (needsDirectoryPick && !storageReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950">
        <div className="text-center max-w-lg p-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 dark:border-zinc-800/50">
          <img src="icon-192.png" alt="H.A.N." className="w-20 h-20 mx-auto mb-5 rounded-2xl shadow-lg" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Han Notes'a Hoş Geldiniz</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            Notlarınızın saklanacağı bir klasör seçin. Mevcut bir not klasörünüz varsa onu seçebilir,
            yoksa yeni bir klasör oluşturabilirsiniz.
          </p>

          {storageError && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium">
              {storageError}
            </div>
          )}

          <button
            onClick={handlePickDirectory}
            className="inline-flex items-center gap-2.5 px-7 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <FolderOpen size={18} />
            Klasör Seç
          </button>

          <p className="mt-5 text-[11px] text-gray-400 dark:text-gray-600">
            Chrome, Edge veya Arc tarayıcıları gereklidir. Safari desteklenmemektedir.
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
      {!isTauri() && <PwaUpdateBanner />}
      <SettingsModal />
    </div>
  );
};
