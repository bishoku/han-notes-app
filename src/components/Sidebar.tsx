import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';
import { useAiStore } from '@/store/aiStore';
import { FileTreeNode } from '@/components/FileTreeNode';
import { normalizeNoteId } from '@/utils/pathUtils';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

import { InputDialogModal, type InputDialogState } from './sidebar/InputDialogModal';
import { SidebarCollapsed } from './sidebar/SidebarCollapsed';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarTags } from './sidebar/SidebarTags';
import { SidebarContextMenu } from './sidebar/SidebarContextMenu';
import { SidebarBottomNav } from './sidebar/SidebarBottomNav';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Fine-grained Zustand selectors — prevent re-renders from unrelated store mutations
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const setSettingsModalOpen = useUiStore((s) => s.setSettingsModalOpen);
  const isSearchModalOpen = useUiStore((s) => s.isSearchModalOpen);
  const setSearchModalOpen = useUiStore((s) => s.setSearchModalOpen);
  const setViewMode = useUiStore((s) => s.setViewMode);

  const fileTree = useNoteStore((s) => s.fileTree);
  const notes = useNoteStore((s) => s.notes);
  const activeFolderPath = useNoteStore((s) => s.activeFolderPath);
  const createNote = useNoteStore((s) => s.createNote);
  const createFolder = useNoteStore((s) => s.createFolder);
  const moveNode = useNoteStore((s) => s.moveNode);
  const vaultTags = useNoteStore((s) => s.vaultTags);
  const activeTagFilter = useNoteStore((s) => s.activeTagFilter);
  const setActiveTagFilter = useNoteStore((s) => s.setActiveTagFilter);
  const vaultPath = useNoteStore((s) => s.vaultPath);

  const isAiEnabled = useAiStore((s) => s.settings.enabled);
  const isChatDrawerOpen = useAiStore((s) => s.isChatDrawerOpen);
  const setChatDrawerOpen = useAiStore((s) => s.setChatDrawerOpen);

  const [isRootDragOver, setIsRootDragOver] = useState(false);
  const [rootContextMenu, setRootContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [inputDialog, setInputDialog] = useState<InputDialogState | null>(null);

  const pathname = location.pathname;
  const isNotesActive = pathname === '/' || pathname.startsWith('/notes');
  const isTasksActive = pathname.startsWith('/tasks');
  const isDecisionsActive = pathname.startsWith('/decisions');
  const isMindmapActive = pathname.startsWith('/mindmap');
  const isSearchActive = isSearchModalOpen || pathname.startsWith('/search');

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDragOver(true);
  };

  const handleRootDragLeave = () => {
    setIsRootDragOver(false);
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDragOver(false);
    const srcPath = e.dataTransfer.getData('text/plain');
    if (!srcPath) return;

    await moveNode(srcPath, '');
  };

  const openNewNoteDialog = (parentPath = activeFolderPath || '') => {
    const dialogTitle = parentPath ? `${t('newNote')} ("${parentPath}")` : `${t('newNote')} (${t('rootFolder')})`;
    setInputDialog({
      title: dialogTitle,
      placeholder: t('enterNoteTitle'),
      onConfirm: async (val) => {
        const newId = await createNote(val, parentPath);
        setViewMode('notes');
        navigate(`/notes/${encodeURIComponent(newId)}`);
      },
    });
  };

  const openNewFolderDialog = (parentPath = activeFolderPath || '') => {
    const dialogTitle = parentPath ? `${t('newFolder')} ("${parentPath}")` : `${t('newFolder')} (${t('rootFolder')})`;
    setInputDialog({
      title: dialogTitle,
      placeholder: t('enterFolderName'),
      onConfirm: async (val) => {
        await createFolder(val, parentPath);
      },
    });
  };

  const handleToggleAi = () => {
    if (isAiEnabled) {
      setChatDrawerOpen(!isChatDrawerOpen);
    } else {
      setSettingsModalOpen(true);
    }
  };

  // Memoized file tree based on active tag filter
  const displayedTree = useMemo(() => {
    if (!activeTagFilter) return fileTree;

    const taggedNoteIds = new Set(
      notes
        .filter((n) => n.tags && n.tags.includes(activeTagFilter))
        .map((n) => normalizeNoteId(n.id))
    );

    const filterNode = (node: any): any => {
      if (node.is_dir) {
        const filteredChildren = (node.children || [])
          .map(filterNode)
          .filter((c: any) => c !== null);
        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return null;
      } else {
        const id = normalizeNoteId(node.relative_path);
        return taggedNoteIds.has(id) ? node : null;
      }
    };

    return fileTree.map(filterNode).filter((c) => c !== null);
  }, [fileTree, notes, activeTagFilter]);

  if (!sidebarOpen) {
    return (
      <>
        <SidebarCollapsed
          isNotesActive={isNotesActive}
          isTasksActive={isTasksActive}
          isDecisionsActive={isDecisionsActive}
          isMindmapActive={isMindmapActive}
          isSearchActive={isSearchActive}
          isAiEnabled={isAiEnabled}
          isChatDrawerOpen={isChatDrawerOpen}
          onExpand={() => setSidebarOpen(true)}
          onOpenNewNote={() => {
            setSidebarOpen(true);
            openNewNoteDialog();
          }}
          onOpenSearch={() => setSearchModalOpen(true)}
          onNavigateNotes={() => {
            setSidebarOpen(true);
            setViewMode('notes');
          }}
          onNavigateTasks={() => {
            setViewMode('tasks');
            navigate('/tasks');
          }}
          onNavigateDecisions={() => {
            setViewMode('decisions');
            navigate('/decisions');
          }}
          onNavigateMindmap={() => {
            setViewMode('mindmap');
            navigate('/mindmap');
          }}
          onToggleAi={handleToggleAi}
          onOpenSettings={() => setSettingsModalOpen(true)}
        />
        <InputDialogModal dialog={inputDialog} onClose={() => setInputDialog(null)} />
      </>
    );
  }

  return (
    <aside className="w-[20%] min-w-[220px] h-full bg-mac-sidebarLight dark:bg-mac-sidebarDark border-r border-mac-borderLight dark:border-mac-borderDark flex flex-col transition-all duration-200 ease-mac-ease relative select-none shrink-0">
      {/* Vault Header & Quick Actions */}
      <SidebarHeader
        activeFolderPath={activeFolderPath}
        isSearchActive={isSearchActive}
        onOpenNewNote={() => openNewNoteDialog()}
        onOpenNewFolder={() => openNewFolderDialog()}
        onOpenSearch={() => setSearchModalOpen(true)}
        onCollapseSidebar={() => setSidebarOpen(false)}
      />

      {/* File Tree & Root Drop Zone */}
      <div
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setRootContextMenu({ x: e.clientX, y: e.clientY });
        }}
        className={cn(
          'flex-1 overflow-y-auto px-2 pb-4 transition-colors rounded-lg mx-2 min-h-[200px]',
          isRootDragOver && 'bg-mac-accent/10 border-2 border-dashed border-mac-accent'
        )}
      >
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 mb-2 px-2 uppercase tracking-wider min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
            <span className="shrink-0">{t('notesExplorer')}</span>
            {vaultPath && (
              <span
                className="text-[9px] font-mono text-gray-500 dark:text-gray-400 truncate normal-case tracking-normal cursor-help hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                title={vaultPath}
              >
                ({vaultPath})
              </span>
            )}
            {activeTagFilter && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[9px] font-mono capitalize shrink-0">
                #{activeTagFilter}
                <X
                  size={10}
                  className="cursor-pointer hover:text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTagFilter(null);
                  }}
                />
              </span>
            )}
          </div>
          {activeFolderPath && (
            <span
              className="text-[9px] text-mac-accent lowercase font-mono truncate max-w-[80px] shrink-0"
              title={`${t('folder')}: /${activeFolderPath}`}
            >
              /{activeFolderPath}
            </span>
          )}
        </div>

        {displayedTree.length === 0 ? (
          <div className="text-xs text-gray-400 italic px-2 py-4 text-center">
            {activeTagFilter ? `#${activeTagFilter} ${t('noResultsFound')}` : t('emptyVault')}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {displayedTree.map((node) => (
              <FileTreeNode key={node.relative_path} node={node} openInputDialog={setInputDialog} />
            ))}
          </div>
        )}
      </div>

      {/* Tags Section */}
      <SidebarTags
        vaultTags={vaultTags}
        activeTagFilter={activeTagFilter}
        onSelectTag={setActiveTagFilter}
      />

      {/* Root Context Menu Portal/Dropdown */}
      <SidebarContextMenu
        contextMenu={rootContextMenu}
        onClose={() => setRootContextMenu(null)}
        onNewNote={() => openNewNoteDialog('')}
        onNewFolder={() => openNewFolderDialog('')}
      />

      {/* Fixed Bottom Actions */}
      <SidebarBottomNav
        isTasksActive={isTasksActive}
        isDecisionsActive={isDecisionsActive}
        isMindmapActive={isMindmapActive}
        isAiEnabled={isAiEnabled}
        isChatDrawerOpen={isChatDrawerOpen}
        onNavigateTasks={() => {
          setViewMode('tasks');
          navigate('/tasks');
        }}
        onNavigateDecisions={() => {
          setViewMode('decisions');
          navigate('/decisions');
        }}
        onNavigateMindmap={() => {
          setViewMode('mindmap');
          navigate('/mindmap');
        }}
        onToggleAi={handleToggleAi}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      <InputDialogModal dialog={inputDialog} onClose={() => setInputDialog(null)} />
    </aside>
  );
};
