import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';
import { useAiStore } from '@/store/aiStore';
import { FileTreeNode } from '@/components/FileTreeNode';
import { Search, Settings, CheckCircle, FolderPlus, FilePlus, FileCheck, Tag, ChevronDown, ChevronUp, X, Network, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Individual Zustand selectors — prevent re-renders from unrelated store changes
  const sidebarOpen = useUiStore(s => s.sidebarOpen);
  const setSettingsModalOpen = useUiStore(s => s.setSettingsModalOpen);
  const isSearchModalOpen = useUiStore(s => s.isSearchModalOpen);
  const setSearchModalOpen = useUiStore(s => s.setSearchModalOpen);
  const setViewMode = useUiStore(s => s.setViewMode);
  const fileTree = useNoteStore(s => s.fileTree);
  const notes = useNoteStore(s => s.notes);
  const activeFolderPath = useNoteStore(s => s.activeFolderPath);
  const createNote = useNoteStore(s => s.createNote);
  const createFolder = useNoteStore(s => s.createFolder);
  const moveNode = useNoteStore(s => s.moveNode);
  const vaultTags = useNoteStore(s => s.vaultTags);
  const activeTagFilter = useNoteStore(s => s.activeTagFilter);
  const setActiveTagFilter = useNoteStore(s => s.setActiveTagFilter);
  const vaultPath = useNoteStore(s => s.vaultPath);
  const { settings: aiSettings, isChatDrawerOpen, setChatDrawerOpen } = useAiStore();
  
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

  const pathname = location.pathname;
  const isTasksActive = pathname.startsWith('/tasks');
  const isDecisionsActive = pathname.startsWith('/decisions');
  const isMindmapActive = pathname.startsWith('/mindmap');

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
    const srcPath = e.dataTransfer.getData('text/plain');
    if (!srcPath) return;
    
    // Move to root
    await moveNode(srcPath, '');
  };

  const openNewNoteDialog = (parentPath = activeFolderPath || '') => {
    const dialogTitle = parentPath ? `"${parentPath}" İçinde Yeni Not` : 'Yeni Not (Kök Dizin)';
    setInputDialog({
      title: dialogTitle,
      placeholder: 'Not Adı (örn. Toplantı Notları)',
      onConfirm: async (val) => {
        const newId = await createNote(val, parentPath);
        setViewMode('notes');
        navigate(`/notes/${encodeURIComponent(newId)}`);
      },
    });
  };

  const openNewFolderDialog = (parentPath = activeFolderPath || '') => {
    const dialogTitle = parentPath ? `"${parentPath}" İçinde Yeni Klasör` : 'Yeni Klasör (Kök Dizin)';
    setInputDialog({
      title: dialogTitle,
      placeholder: 'Klasör Adı (örn. Projeler)',
      onConfirm: async (val) => {
        await createFolder(val, parentPath);
      },
    });
  };

  return (
    <aside className="w-[20%] min-w-[220px] h-full bg-mac-sidebarLight dark:bg-mac-sidebarDark border-r border-mac-borderLight dark:border-mac-borderDark flex flex-col transition-all duration-200 ease-mac-ease relative select-none">
      {/* Vault Header & Quick Actions */}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs uppercase tracking-wider text-gray-500">{t('vault')}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openNewNoteDialog()}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              title={activeFolderPath ? `"${activeFolderPath}" İçinde Yeni Not` : 'Yeni Not'}
            >
              <FilePlus size={16} />
            </button>
            <button
              onClick={() => openNewFolderDialog()}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              title={activeFolderPath ? `"${activeFolderPath}" İçinde Yeni Klasör` : 'Yeni Klasör'}
            >
              <FolderPlus size={16} />
            </button>
          </div>
        </div>

        <button
          onClick={() => setSearchModalOpen(true)}
          className={cn(
            'flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-all cursor-pointer border group',
            isSearchModalOpen || pathname.startsWith('/search')
              ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300 shadow-2xs'
              : 'bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          )}
          title="Hızlı Arama & Komut Paleti (Cmd+K)"
        >
          <div className="flex items-center gap-2">
            <Search size={14} className="group-hover:text-purple-500 transition-colors" />
            <span className="font-medium">{t('search')}</span>
          </div>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
            ⌘K
          </kbd>
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
          'flex-1 overflow-y-auto px-2 pb-4 transition-colors rounded-lg mx-2 min-h-[200px]',
          isRootDragOver && 'bg-mac-accent/10 border-2 border-dashed border-mac-accent'
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

      {/* Tags Section */}
      {vaultTags && vaultTags.length > 0 && (
        <div className="px-3 py-2 border-t border-mac-borderLight dark:border-mac-borderDark max-h-36 flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Tag size={11} className="text-mac-accent" />
              Etiketler ({vaultTags.length})
            </span>
            {activeTagFilter && (
              <button
                onClick={() => setActiveTagFilter(null)}
                className="text-[10px] text-mac-accent hover:underline flex items-center gap-0.5 cursor-pointer"
                title="Filtreyi Temizle"
              >
                <X size={10} /> Temizle
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1 overflow-y-auto pr-1">
            {(showAllTags ? vaultTags : vaultTags.slice(0, 8)).map(tagObj => {
              const isActive = activeTagFilter === tagObj.tag;
              return (
                <button
                  key={tagObj.tag}
                  onClick={() => setActiveTagFilter(isActive ? null : tagObj.tag)}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-md font-mono transition-all flex items-center gap-1 cursor-pointer border',
                    isActive
                      ? 'bg-mac-accent text-white border-mac-accent shadow-xs font-semibold'
                      : 'bg-black/5 dark:bg-white/5 border-transparent text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'
                  )}
                  title={`${tagObj.count} notta geçiyor`}
                >
                  <span>#{tagObj.tag}</span>
                  <span className={cn(
                    'text-[9px] px-1 py-0.2 rounded-full',
                    isActive ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/5 text-gray-400'
                  )}>
                    {tagObj.count}
                  </span>
                </button>
              );
            })}
            
            {vaultTags.length > 8 && (
              <button
                onClick={() => setShowAllTags(!showAllTags)}
                className="text-[10px] px-1.5 py-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center gap-0.5 cursor-pointer"
              >
                {showAllTags ? (
                  <><ChevronUp size={11} /> Daha Az</>
                ) : (
                  <><ChevronDown size={11} /> +{vaultTags.length - 8} Diğer</>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Root Context Menu Portal/Dropdown */}
      {rootContextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={closeRootContextMenu} onContextMenu={(e) => { e.preventDefault(); closeRootContextMenu(); }} />
          <div
            className="fixed z-50 min-w-[160px] bg-white dark:bg-zinc-900 border border-mac-borderLight dark:border-mac-borderDark rounded-xl shadow-xl p-1 text-xs text-gray-700 dark:text-gray-300 animate-in fade-in zoom-in-95 duration-100"
            style={{ top: rootContextMenu.y, left: rootContextMenu.x }}
          >
            <button
              onClick={() => {
                closeRootContextMenu();
                openNewNoteDialog('');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors cursor-pointer"
            >
              <FilePlus size={14} />
              <span>Yeni Not Oluştur</span>
            </button>
            <button
              onClick={() => {
                closeRootContextMenu();
                openNewFolderDialog('');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors cursor-pointer"
            >
              <FolderPlus size={14} />
              <span>Yeni Klasör Oluştur</span>
            </button>
          </div>
        </>
      )}

      {/* Modal Dialog for Create/Rename */}
      {inputDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="w-80 bg-white dark:bg-zinc-900 border border-mac-borderLight dark:border-mac-borderDark rounded-2xl shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {inputDialog.title}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = form.elements.namedItem('dialogInput') as HTMLInputElement;
                inputDialog.onConfirm(input.value);
                setInputDialog(null);
              }}
            >
              <input
                autoFocus
                name="dialogInput"
                defaultValue={inputDialog.defaultValue || ''}
                placeholder={inputDialog.placeholder}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-800 border border-mac-borderLight dark:border-mac-borderDark rounded-lg focus:outline-none focus:ring-2 focus:ring-mac-accent mb-3 text-gray-900 dark:text-gray-100"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setInputDialog(null)}
                  className="px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-mac-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
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
          onClick={() => {
            setViewMode('tasks');
            navigate('/tasks');
          }}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
            isTasksActive ? 'bg-mac-accent text-white font-medium shadow-xs' : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
          )}
        >
          <CheckCircle size={16} />
          {t('tasks')}
        </button>
        <button 
          onClick={() => {
            setViewMode('decisions');
            navigate('/decisions');
          }}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
            isDecisionsActive ? 'bg-purple-600 text-white font-medium shadow-xs' : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
          )}
        >
          <FileCheck size={16} />
          Karar Kayıtları (Decisions)
        </button>
        <button 
          onClick={() => {
            setViewMode('mindmap');
            navigate('/mindmap');
          }}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
            isMindmapActive ? 'bg-emerald-600 text-white font-medium shadow-xs' : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
          )}
        >
          <Network size={16} />
          Zihin Haritası (Mindmap)
        </button>
        <button 
          onClick={() => {
            if (aiSettings.enabled) {
              setChatDrawerOpen(!isChatDrawerOpen);
            } else {
              setSettingsModalOpen(true);
            }
          }}
          className={cn(
            'flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
            isChatDrawerOpen
              ? 'bg-gradient-to-r from-purple-600 to-mac-accent text-white font-semibold shadow-xs'
              : aiSettings.enabled
              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold hover:bg-purple-500/20'
              : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
          )}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} className={aiSettings.enabled ? 'text-purple-500 animate-pulse' : ''} />
            <span>AI Asistan</span>
          </div>
          {aiSettings.enabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
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
