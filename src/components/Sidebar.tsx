import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';
import { FileTreeNode } from '@/components/FileTreeNode';
import { Search, Settings, CheckCircle, FolderPlus, FilePlus, Folder, FileCheck, Tag, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { sidebarOpen, setSettingsModalOpen, setViewMode, viewMode } = useUiStore();
  const { fileTree, notes, activeFolderPath, createNote, createFolder, moveNode, vaultTags, activeTagFilter, setActiveTagFilter, vaultPath } = useNoteStore();
  
  const [isRootDragOver, setIsRootDragOver] = useState(false);
  const [rootContextMenu, setRootContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showAllTags, setShowAllTags] = useState(false);
  
  const [inputDialog, setInputDialog] = useState<{
    title: string;
    placeholder: string;
    defaultValue?: string;
    onConfirm: (val: string) => void;
  } | null>(null);

  if (!sidebarOpen) return null;

  const closeRootContextMenu = () => setRootContextMenu(null);

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
    const srcRelPath = e.dataTransfer.getData('text/plain');
    if (srcRelPath) {
      await moveNode(srcRelPath, "");
    }
  };

  const openNewNoteDialog = (parentPath = activeFolderPath || "") => {
    const dialogTitle = parentPath ? `"${parentPath}" İçinde Yeni Not` : "Yeni Not (Kök Dizin)";
    setInputDialog({
      title: dialogTitle,
      placeholder: "Not Adı (örn. Toplantı Notları)",
      onConfirm: async (val) => {
        await createNote(val, parentPath);
        setViewMode('notes');
      }
    });
  };

  const openNewFolderDialog = (parentPath = activeFolderPath || "") => {
    const dialogTitle = parentPath ? `"${parentPath}" İçinde Yeni Klasör` : "Yeni Klasör (Kök Dizin)";
    setInputDialog({
      title: dialogTitle,
      placeholder: "Klasör Adı (örn. Projeler)",
      onConfirm: async (val) => {
        await createFolder(val, parentPath);
      }
    });
  };

  return (
    <aside className="w-[20%] min-w-[220px] h-screen bg-mac-sidebarLight dark:bg-mac-sidebarDark border-r border-mac-borderLight dark:border-mac-borderDark flex flex-col transition-all duration-200 ease-mac-ease relative select-none">
      {/* Vault Header & Quick Actions */}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs uppercase tracking-wider text-gray-500">{t('vault')}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openNewNoteDialog()}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              title={activeFolderPath ? `"${activeFolderPath}" İçinde Yeni Not` : "Yeni Not"}
            >
              <FilePlus size={16} />
            </button>
            <button
              onClick={() => openNewFolderDialog()}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              title={activeFolderPath ? `"${activeFolderPath}" İçinde Yeni Klasör` : "Yeni Klasör"}
            >
              <FolderPlus size={16} />
            </button>
          </div>
        </div>

        <button className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-500 bg-black/5 dark:bg-white/5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          <Search size={14} />
          <span>{t('search')}</span>
        </button>
      </div>

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
          "flex-1 overflow-y-auto px-2 pb-4 transition-colors rounded-lg mx-2 min-h-[200px]",
          isRootDragOver && "bg-mac-accent/10 border-2 border-dashed border-mac-accent"
        )}
      >
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 mb-2 px-2 uppercase tracking-wider min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
            <span className="shrink-0">Explorer</span>
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
            <span className="text-[9px] text-mac-accent lowercase font-mono truncate max-w-[80px] shrink-0" title={`Klasör: /${activeFolderPath}`}>
              /{activeFolderPath}
            </span>
          )}
        </div>
        
        {fileTree.length === 0 ? (
          <div className="text-xs text-gray-400 italic px-2 py-4">Vault is empty (Right-click to create)</div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {(() => {
              let displayedTree = fileTree;
              if (activeTagFilter) {
                const taggedNoteIds = new Set(
                  notes
                    .filter((n) => n.tags && n.tags.includes(activeTagFilter))
                    .map((n) => n.id)
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
                    const id = node.relative_path.endsWith('.md')
                      ? node.relative_path.slice(0, -3)
                      : node.relative_path;
                    return taggedNoteIds.has(id) ? node : null;
                  }
                };
                displayedTree = fileTree.map(filterNode).filter((c) => c !== null);
              }

              if (displayedTree.length === 0 && activeTagFilter) {
                return (
                  <div className="text-xs text-gray-400 italic px-2 py-4 text-center">
                    "#{activeTagFilter}" etiketli not bulunamadı
                  </div>
                );
              }

              return displayedTree.map((node) => (
                <FileTreeNode key={node.relative_path} node={node} openInputDialog={setInputDialog} />
              ));
            })()}
          </div>
        )}
      </div>

      {/* Tags Section (Top 10 + Show More) */}
      {vaultTags.length > 0 && (
        <div className="border-t border-mac-borderLight dark:border-mac-borderDark p-3 flex flex-col gap-1.5 shrink-0 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
            <span className="flex items-center gap-1">
              <Tag size={11} className="text-purple-500" /> Etiketler ({vaultTags.length})
            </span>
            {activeTagFilter && (
              <button 
                onClick={() => setActiveTagFilter(null)}
                className="text-[9px] text-purple-600 dark:text-purple-400 hover:underline font-mono"
              >
                Temizle
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1 pt-1">
            {(showAllTags ? vaultTags : vaultTags.slice(0, 10)).map((t) => {
              const isActive = activeTagFilter === t.tag;
              return (
                <button
                  key={t.tag}
                  onClick={() => setActiveTagFilter(isActive ? null : t.tag)}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[11px] font-mono transition-all flex items-center gap-1 cursor-pointer",
                    isActive
                      ? "bg-purple-600 text-white font-bold shadow-xs"
                      : "bg-gray-100 dark:bg-zinc-800/80 text-gray-600 dark:text-gray-400 hover:bg-purple-500/15 hover:text-purple-600 dark:hover:text-purple-400"
                  )}
                >
                  <span>#{t.tag}</span>
                  <span className={cn("text-[9px] opacity-70", isActive ? "text-white" : "text-gray-400")}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {vaultTags.length > 10 && (
            <button
              onClick={() => setShowAllTags(!showAllTags)}
              className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 hover:underline pt-1"
            >
              {showAllTags ? (
                <>
                  <span>Daha Az Göster</span>
                  <ChevronUp size={12} />
                </>
              ) : (
                <>
                  <span>Daha Fazlası (+{vaultTags.length - 10})</span>
                  <ChevronDown size={12} />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Root Context Menu Dropdown */}
      {rootContextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeRootContextMenu} />
          <div
            className="fixed z-50 w-44 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg shadow-xl p-1 text-xs text-gray-700 dark:text-gray-200 animate-in fade-in zoom-in-95"
            style={{ top: rootContextMenu.y, left: rootContextMenu.x }}
          >
            <button 
              onClick={() => { closeRootContextMenu(); openNewNoteDialog(""); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-mac-accent hover:text-white rounded transition-colors text-left font-medium"
            >
              <FilePlus size={13} /> Yeni Not (Kök)
            </button>
            <button 
              onClick={() => { closeRootContextMenu(); openNewFolderDialog(""); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-mac-accent hover:text-white rounded transition-colors text-left font-medium"
            >
              <Folder size={13} /> Yeni Klasör (Kök)
            </button>
          </div>
        </>
      )}

      {/* Custom Input Dialog Modal */}
      {inputDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-4 w-80 shadow-2xl flex flex-col gap-3">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{inputDialog.title}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const input = form.elements.namedItem('inputValue') as HTMLInputElement;
                if (input.value.trim()) {
                  inputDialog.onConfirm(input.value.trim());
                  setInputDialog(null);
                }
              }}
              className="flex flex-col gap-3"
            >
              <input
                name="inputValue"
                autoFocus
                defaultValue={inputDialog.defaultValue || ''}
                placeholder={inputDialog.placeholder}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setInputDialog(null)}
                  className="px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-mac-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors shadow-sm"
                >
                  Tamam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fixed Bottom Actions */}
      <div className="p-2 border-t border-mac-borderLight dark:border-mac-borderDark flex flex-col gap-1">
        <button 
          onClick={() => setViewMode('tasks')}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors",
            viewMode === 'tasks' ? "bg-mac-accent text-white font-medium" : "hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"
          )}
        >
          <CheckCircle size={16} />
          {t('tasks')}
        </button>
        <button 
          onClick={() => setViewMode('decisions')}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors",
            viewMode === 'decisions' ? "bg-purple-600 text-white font-medium" : "hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"
          )}
        >
          <FileCheck size={16} />
          Karar Kayıtları (Decisions)
        </button>
        <button 
          onClick={() => setSettingsModalOpen(true)}
          className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
        >
          <Settings size={16} />
          {t('settings')}
        </button>
      </div>
    </aside>
  );
};
