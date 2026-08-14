import { create } from 'zustand';
import { applyAppTheme } from '@/utils/theme';
import type { AppTheme, AppLanguage } from '@/utils/theme';
import i18n from '@/i18n';

const SAVED_THEME_KEY = 'han_app_theme';
const SAVED_LANG_KEY = 'han_app_language';
const SAVED_FONTSIZE_KEY = 'han_editor_fontsize';

export type FontSize = 'sm' | 'md' | 'lg';

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
  theme: AppTheme;
  language: AppLanguage;
  fontSize: FontSize;
  viewMode: 'notes' | 'tasks' | 'decisions';
  editorMode: 'preview' | 'raw';
  
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setSettingsModalOpen: (open: boolean) => void;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: AppLanguage) => void;
  setFontSize: (size: FontSize) => void;
  setViewMode: (mode: 'notes' | 'tasks' | 'decisions') => void;
  setEditorMode: (mode: 'preview' | 'raw') => void;
  initPreferences: () => void;
}

const initialTheme = getInitialTheme();
const initialLang = getInitialLanguage();
const initialFontSize = getInitialFontSize();

export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: true,
  rightPanelOpen: true,
  isSettingsModalOpen: false,
  theme: initialTheme,
  language: initialLang,
  fontSize: initialFontSize,
  viewMode: 'notes',
  editorMode: 'preview',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),

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
