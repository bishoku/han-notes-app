import React, { useState } from 'react';
import { useNoteStore } from '@/store/noteStore';
import type { FileNode } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, Trash2, Edit3 } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

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

  const isSelected = !node.is_dir && (currentNoteId === node.relative_path || currentNoteId === node.name);
  const isFolderActive = node.is_dir && activeFolderPath === node.relative_path;

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
        await moveNode(srcRelPath, node.relative_path);
      }
    }
  };

  // --- Context Menu Handlers ---
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.is_dir) {
      setActiveFolder(node.relative_path);
    }
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleCreateSubNote = () => {
    closeContextMenu();
    if (openInputDialog) {
      openInputDialog({
        title: `"${node.name}" İçinde Yeni Not`,
        placeholder: "Not Adı",
        onConfirm: async (title) => {
          await createNote(title, node.is_dir ? node.relative_path : '');
          setViewMode('notes');
        }
      });
    }
  };

  const handleCreateSubFolder = () => {
    closeContextMenu();
    if (openInputDialog) {
      openInputDialog({
        title: `"${node.name}" İçinde Yeni Klasör`,
        placeholder: "Klasör Adı",
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
        title: `Yeniden Adlandır`,
        placeholder: "Yeni Ad",
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
        onClick={() => {
          if (node.is_dir) {
            setIsOpen(!isOpen);
            setActiveFolder(node.relative_path);
          } else {
            selectNote(node.relative_path);
            setViewMode('notes');
          }
        }}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md text-xs cursor-pointer select-none transition-colors group",
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
                <button onClick={handleCreateSubNote} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-mac-accent hover:text-white rounded transition-colors text-left">
                  <Plus size={12} /> Yeni Not
                </button>
                <button onClick={handleCreateSubFolder} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-mac-accent hover:text-white rounded transition-colors text-left">
                  <Folder size={12} /> Yeni Klasör
                </button>
                <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
              </>
            )}
            <button onClick={handleRename} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-mac-accent hover:text-white rounded transition-colors text-left">
              <Edit3 size={12} /> Yeniden Adlandır
            </button>
            <button onClick={handleDelete} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-red-500 hover:text-white rounded text-red-500 transition-colors text-left">
              <Trash2 size={12} /> Sil
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
