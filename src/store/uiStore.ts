import { create } from 'zustand';
import { applyAppTheme } from '@/utils/theme';
import type { AppTheme, AppLanguage } from '@/utils/theme';
import i18n from '@/i18n';

const SAVED_THEME_KEY = 'han_app_theme';
const SAVED_LANG_KEY = 'han_app_language';
const SAVED_FONTSIZE_KEY = 'han_editor_fontsize';

export type FontSize = 'sm' | 'md' | 'lg';
export type EditorMode = 'preview' | 'raw';

const getInitialTheme = (): AppTheme => {
  const saved = localStorage.getItem(SAVED_THEME_KEY) as AppTheme;
  if (saved && ['light', 'dark', 'nord', 'dracula', 'synthwave', 'retro'].includes(saved)) {
    return saved;
  }
  return 'light';
};

const getInitialLanguage = (): AppLanguage => {
  const saved = localStorage.getItem(SAVED_LANG_KEY) as AppLanguage;
  if (saved && (saved === 'tr' || saved === 'en')) {
    return saved;
  }
  return 'tr';
};

const getInitialFontSize = (): FontSize => {
  const saved = localStorage.getItem(SAVED_FONTSIZE_KEY) as FontSize;
  if (saved && ['sm', 'md', 'lg'].includes(saved)) {
    return saved;
  }
  return 'md';
};

interface UiState {
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  isSettingsModalOpen: boolean;
  isSearchModalOpen: boolean;
  searchQuery: string;
  theme: AppTheme;
  language: AppLanguage;
  fontSize: FontSize;
  viewMode: 'notes' | 'tasks' | 'decisions' | 'mindmap' | 'search';
  editorMode: 'preview' | 'raw';
  pdfSplitReader: {
    isOpen: boolean;
    pdfPath: string;
    pdfName: string;
    initialPage: number;
    jumpKey?: number;
  };
  
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  setSettingsModalOpen: (open: boolean) => void;
  setSearchModalOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  openSearch: (query?: string) => void;
  openPdfSplitReader: (pdfPath: string, initialPage?: number) => void;
  closePdfSplitReader: () => void;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: AppLanguage) => void;
  setFontSize: (size: FontSize) => void;
  setViewMode: (mode: 'notes' | 'tasks' | 'decisions' | 'mindmap' | 'search') => void;
  setEditorMode: (mode: 'preview' | 'raw') => void;
  initPreferences: () => void;
}

const initialTheme = getInitialTheme();
const initialLang = getInitialLanguage();
const initialFontSize = getInitialFontSize();

export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  rightPanelOpen: false,
  isSettingsModalOpen: false,
  isSearchModalOpen: false,
  searchQuery: '',
  theme: initialTheme,
  language: initialLang,
  fontSize: initialFontSize,
  viewMode: 'notes',
  editorMode: 'preview',
  pdfSplitReader: {
    isOpen: false,
    pdfPath: '',
    pdfName: '',
    initialPage: 1,
    jumpKey: 0,
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
  setSearchModalOpen: (open) => set({ isSearchModalOpen: open }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  openSearch: (query = '') => set({ isSearchModalOpen: true, searchQuery: query }),
  openPdfSplitReader: (pdfPath, initialPage = 1) => {
    const cleanPath = pdfPath.replace(/^\[\[/, '').replace(/\]\]$/, '');
    const pageMatch = cleanPath.match(/#page=(\d+)/i);
    const targetPage = pageMatch ? parseInt(pageMatch[1], 10) : initialPage;
    const pathWithoutHash = cleanPath.split('#')[0];
    const pdfName = pathWithoutHash.split('/').pop() || 'Doküman.pdf';
    set({
      pdfSplitReader: {
        isOpen: true,
        pdfPath: pathWithoutHash,
        pdfName,
        initialPage: targetPage,
        jumpKey: Date.now(),
      },
    });
  },
  closePdfSplitReader: () => {
    set((s) => ({
      pdfSplitReader: {
        ...s.pdfSplitReader,
        isOpen: false,
      },
    }));
  },

  setFontSize: (size) => {
    localStorage.setItem(SAVED_FONTSIZE_KEY, size);
    set({ fontSize: size });
  },

  setTheme: (theme) => {
    localStorage.setItem(SAVED_THEME_KEY, theme);
    applyAppTheme(theme);
    set({ theme });
  },

  setLanguage: (language) => {
    localStorage.setItem(SAVED_LANG_KEY, language);
    i18n.changeLanguage(language);
    set({ language });
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setEditorMode: (editorMode) => set({ editorMode }),

  initPreferences: () => {
    const { theme, language } = get();
    applyAppTheme(theme);
    i18n.changeLanguage(language);
  },
}));
