import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  viewMode: 'notes' | 'tasks' | 'decisions';
  editorMode: 'preview' | 'raw';
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setViewMode: (mode: 'notes' | 'tasks' | 'decisions') => void;
  setEditorMode: (mode: 'preview' | 'raw') => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  rightPanelOpen: true,
  theme: 'system',
  viewMode: 'notes',
  editorMode: 'preview',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setTheme: (theme) => set({ theme }),
  setViewMode: (viewMode) => set({ viewMode }),
  setEditorMode: (editorMode) => set({ editorMode }),
}));
