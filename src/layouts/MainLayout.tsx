import React, { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MainEditor } from '@/components/MainEditor';
import { RightPanel } from '@/components/RightPanel';
import { TasksView } from '@/components/TasksView';
import { DecisionsView } from '@/components/DecisionsView';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';

export const MainLayout: React.FC = () => {
  const { theme, viewMode } = useUiStore();
  const { loadVault } = useNoteStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let activeTheme = theme;
    if (theme === 'system') {
      activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    root.classList.add(activeTheme);
    root.style.colorScheme = activeTheme;
  }, [theme]);
  
  useEffect(() => {
    loadVault();
    
    // Prevent default native WebKit right-click context menu globally
    const disableContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', disableContextMenu);
    return () => window.removeEventListener('contextmenu', disableContextMenu);
  }, [loadVault]);

  return (
    <div className="flex h-screen w-full overflow-hidden antialiased text-gray-900 dark:text-gray-100 bg-mac-mainLight dark:bg-mac-mainDark selection:bg-mac-accent/30">
      <Sidebar />
      {viewMode === 'notes' && <MainEditor />}
      {viewMode === 'tasks' && <TasksView />}
      {viewMode === 'decisions' && <DecisionsView />}
      {viewMode === 'notes' && <RightPanel />}
    </div>
  );
};
