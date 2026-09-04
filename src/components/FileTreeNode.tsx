import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNoteStore } from '@/store/noteStore';
import type { FileNode } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, Trash2, Edit3, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileTreeNodeProps {
  node: FileNode;
  level?: number;
  openInputDialog?: (dialog: {
    title: string;
    placeholder: string;
    defaultValue?: string;
    onConfirm: (val: string) => void;
  }) => void;
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = React.memo(({ node, level = 0, openInputDialog }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  const currentNoteId = useNoteStore(state => state.currentNoteId);
  const activeFolderPath = useNoteStore(state => state.activeFolderPath);
  const selectNote = useNoteStore(state => state.selectNote);
  const setActiveFolder = useNoteStore(state => state.setActiveFolder);
  const createNote = useNoteStore(state => state.createNote);
  const createFolder = useNoteStore(state => state.createFolder);
  const moveNode = useNoteStore(state => state.moveNode);
  const deleteNode = useNoteStore(state => state.deleteNode);
  const renameNode = useNoteStore(state => state.renameNode);
  const setViewMode = useUiStore(state => state.setViewMode);

  const cleanRelPath = node.relative_path.replace(/\.md$/, '');
  const cleanName = node.name.replace(/\.md$/, '');
  const isSelected = !node.is_dir && (currentNoteId === cleanRelPath || currentNoteId === node.relative_path || currentNoteId === cleanName);
  const isFolderActive = node.is_dir && activeFolderPath === node.relative_path;

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const clampContextMenu = (clientX: number, clientY: number) => {
    const menuWidth = 180;
    const menuHeight = node.is_dir ? 165 : 95;
    const safeX = Math.min(Math.max(10, clientX), (window.innerWidth || 360) - menuWidth - 10);
    const safeY = Math.min(Math.max(10, clientY), (window.innerHeight || 600) - menuHeight - 10);
    return { x: safeX, y: safeY };
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', node.relative_path);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (node.is_dir) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (node.is_dir) {
      e.stopPropagation();
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (node.is_dir) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const srcRelPath = e.dataTransfer.getData('text/plain');
      if (srcRelPath && srcRelPath !== node.relative_path) {
        const srcParent = srcRelPath.includes('/') ? srcRelPath.split('/').slice(0, -1).join('/') : '';
        if (srcParent !== node.relative_path) {
          await moveNode(srcRelPath, node.relative_path);
        }
      }
    }
  };

  // --- Touch Long Press Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressTriggeredRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (node.is_dir) {
        setActiveFolder(node.relative_path);
      }
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
      setContextMenu(clampContextMenu(touch.clientX, touch.clientY));
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  // --- Context Menu Handlers ---
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.is_dir) {
      setActiveFolder(node.relative_path);
    }
    setContextMenu(clampContextMenu(e.clientX, e.clientY));
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleCreateSubNote = () => {
    closeContextMenu();
    if (openInputDialog) {
      openInputDialog({
        title: `${t('newNote')} ("${node.name}")`,
        placeholder: t('enterNoteTitle'),
        onConfirm: async (title) => {
          const newId = await createNote(title, node.is_dir ? node.relative_path : '');
          setViewMode('notes');
          navigate(`/notes/${encodeURIComponent(newId)}`);
        }
      });
    }
  };

  const handleCreateSubFolder = () => {
    closeContextMenu();
    if (openInputDialog) {
      openInputDialog({
        title: `${t('newFolder')} ("${node.name}")`,
        placeholder: t('enterFolderName'),
        onConfirm: async (folderName) => {
          await createFolder(folderName, node.is_dir ? node.relative_path : '');
        }
      });
    }
  };

  const handleRename = () => {
    closeContextMenu();
    if (openInputDialog) {
      openInputDialog({
        title: t('rename'),
        placeholder: t('newTitle'),
        defaultValue: node.name,
        onConfirm: async (newName) => {
          if (newName !== node.name) {
            await renameNode(node.relative_path, newName);
          }
        }
      });
    }
  };

  const handleDelete = async () => {
    closeContextMenu();
    await deleteNode(node.relative_path);
  };

  return (
    <div className="relative">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={(e) => {
          if (isLongPressTriggeredRef.current) {
            isLongPressTriggeredRef.current = false;
            e.preventDefault();
            return;
          }
          if (node.is_dir) {
            setIsOpen(!isOpen);
            setActiveFolder(node.relative_path);
          } else {
            selectNote(cleanRelPath);
            setViewMode('notes');
            navigate(`/notes/${encodeURIComponent(cleanRelPath)}`);
            if (typeof window !== 'undefined' && window.innerWidth < 768) {
              useUiStore.getState().setSidebarOpen(false);
            }
          }
        }}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        className={cn(
          "flex items-center gap-2 py-2 md:py-1.5 px-2.5 md:px-2 rounded-lg md:rounded-md text-xs cursor-pointer select-none transition-colors group min-h-[38px] md:min-h-0",
          isSelected && "bg-mac-accent text-white font-medium",
          isFolderActive && !isSelected && "bg-mac-accent/15 text-mac-accent font-semibold",
          !isSelected && !isFolderActive && "hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300",
          isDragOver && "bg-mac-accent/20 border-2 border-dashed border-mac-accent"
        )}
      >
        {node.is_dir ? (
          <>
            <span className="text-gray-400">
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            {isOpen ? <FolderOpen size={14} className="text-mac-accent shrink-0" /> : <Folder size={14} className="text-gray-400 shrink-0" />}
            <span className="truncate font-semibold">{node.name}</span>
          </>
        ) : (
          <>
            <FileText size={14} className={cn("shrink-0", isSelected ? "text-white" : "text-gray-400")} />
            <span className="truncate">{node.name}</span>
          </>
        )}

        {/* 3-dots action button: always visible on mobile, hover on desktop */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (node.is_dir) {
              setActiveFolder(node.relative_path);
            }
            const rect = e.currentTarget.getBoundingClientRect();
            setContextMenu(clampContextMenu(rect.left, rect.bottom + 4));
          }}
          className={cn(
            "p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-opacity ml-auto shrink-0",
            isSelected ? "text-white/80 hover:text-white hover:bg-white/20" : "",
            "opacity-100 md:opacity-0 md:group-hover:opacity-100"
          )}
          title={t('moreActions')}
        >
          <MoreVertical size={13} />
        </button>
      </div>

      {/* Context Menu Dropdown */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="fixed z-50 w-44 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg shadow-xl p-1 text-xs text-gray-700 dark:text-gray-200 animate-in fade-in zoom-in-95"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {node.is_dir && (
              <>
                <button onClick={handleCreateSubNote} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-mac-accent hover:text-white rounded transition-colors text-left cursor-pointer">
                  <Plus size={12} /> {t('newNote')}
                </button>
                <button onClick={handleCreateSubFolder} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-mac-accent hover:text-white rounded transition-colors text-left cursor-pointer">
                  <Folder size={12} /> {t('newFolder')}
                </button>
                <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
              </>
            )}
            <button onClick={handleRename} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-mac-accent hover:text-white rounded transition-colors text-left cursor-pointer">
              <Edit3 size={12} /> {t('rename')}
            </button>
            <button onClick={handleDelete} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-red-500 hover:text-white rounded text-red-500 transition-colors text-left cursor-pointer">
              <Trash2 size={12} /> {t('delete')}
            </button>
          </div>
        </>
      )}

      {/* Render Children Recursively */}
      {node.is_dir && isOpen && node.children && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {node.children.map((childNode) => (
            <FileTreeNode key={childNode.relative_path} node={childNode} level={level + 1} openInputDialog={openInputDialog} />
          ))}
        </div>
      )}
    </div>
  );
});
