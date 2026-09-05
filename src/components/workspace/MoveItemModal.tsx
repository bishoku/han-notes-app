import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  FolderInput,
  Folder,
  FolderPlus,
  Layers,
  X,
  Search,
  Check,
  ArrowRight,
  Loader2,
  AlertCircle,
  HardDrive,
  Database,
  Home,
  Sparkles,
} from 'lucide-react';
import { eventBus } from '@/lib/eventBus';
import { useNoteStore } from '@/store/noteStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { moveNodeToWorkspace } from '@/services/workspace/workspaceTransfer';
import { getWorkspaceIcon } from './workspaceIcons';
import type { FileNode } from '@/services/storage';
import { cn } from '@/lib/utils';

export const MoveItemModal: React.FC = () => {
  const { t } = useTranslation();
  const fileTree = useNoteStore((s) => s.fileTree);
  const moveNode = useNoteStore((s) => s.moveNode);
  const createFolder = useNoteStore((s) => s.createFolder);

  const {
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    setWorkspaceModalOpen,
  } = useWorkspaceStore();

  const [isOpen, setIsOpen] = useState(false);
  const [item, setItem] = useState<{ path: string; name: string; isDir: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'folder' | 'workspace'>('folder');

  // Search & folder creation state
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Transfer & feedback state
  const [isMoving, setIsMoving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    targetWorkspaceId?: string;
    targetWorkspaceName?: string;
  } | null>(null);

  useEffect(() => {
    const unsub = eventBus.on('file-tree:open-move-modal', (payload) => {
      setItem(payload);
      setIsOpen(true);
      setActiveTab('folder');
      setSearchQuery('');
      setStatusMessage(null);
      setIsCreatingFolder(false);
      setNewFolderName('');
    });
    return () => unsub();
  }, []);

  // Extract all existing folder paths in current vault
  const folderList = useMemo(() => {
    const folders: string[] = [];
    const traverse = (list: FileNode[]) => {
      for (const node of list) {
        if (node.is_dir) {
          folders.push(node.relative_path);
          if (node.children && node.children.length > 0) {
            traverse(node.children);
          }
        }
      }
    };
    traverse(fileTree);
    return folders.sort();
  }, [fileTree]);

  // Determine current parent folder of the item
  const currentParent = useMemo(() => {
    if (!item) return '';
    const clean = item.path.replace(/^\/+|\/+$/g, '');
    if (!clean.includes('/')) return '';
    return clean.substring(0, clean.lastIndexOf('/'));
  }, [item]);

  // Filter folder list based on search query
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folderList;
    const q = searchQuery.toLowerCase();
    return folderList.filter((f) => f.toLowerCase().includes(q));
  }, [folderList, searchQuery]);

  if (!isOpen || !item) return null;

  const handleClose = () => {
    if (isMoving) return;
    setIsOpen(false);
    setItem(null);
    setStatusMessage(null);
  };

  // ── Move to Folder in Current Workspace ──
  const handleMoveToFolder = async (destDir: string) => {
    if (destDir === currentParent) return;
    setIsMoving(true);
    setStatusMessage(null);

    try {
      await moveNode(item.path, destDir);
      setStatusMessage({
        type: 'success',
        text: t('moveSuccess', { name: item.name }),
      });
      // Auto close after brief display
      setTimeout(() => {
        handleClose();
      }, 700);
    } catch (err: any) {
      console.error('[MoveItemModal] Move to folder error:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || t('moveError'),
      });
    } finally {
      setIsMoving(false);
    }
  };

  // ── Create New Folder and Move Into It ──
  const handleCreateAndMove = async (e: React.FormEvent) => {
    e.preventDefault();
    const folder = newFolderName.trim().replace(/^\/+|\/+$/g, '');
    if (!folder) return;

    setIsMoving(true);
    setStatusMessage(null);

    try {
      await createFolder(folder, '');
      await moveNode(item.path, folder);
      setStatusMessage({
        type: 'success',
        text: t('moveSuccess', { name: item.name }),
      });
      setTimeout(() => {
        handleClose();
      }, 700);
    } catch (err: any) {
      console.error('[MoveItemModal] Create and move error:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || t('moveError'),
      });
    } finally {
      setIsMoving(false);
    }
  };

  // ── Move to Another Workspace ──
  const handleMoveToWorkspace = async (targetWsId: string) => {
    setIsMoving(true);
    setStatusMessage(null);

    try {
      const result = await moveNodeToWorkspace(item.path, targetWsId, item.isDir);
      setStatusMessage({
        type: 'success',
        text: t('moveSuccess', { name: item.name }),
        targetWorkspaceId: targetWsId,
        targetWorkspaceName: result.targetWorkspaceName,
      });
    } catch (err: any) {
      console.error('[MoveItemModal] Move to workspace error:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || t('moveError'),
      });
    } finally {
      setIsMoving(false);
    }
  };

  const otherWorkspaces = workspaces.filter((w) => w.id !== activeWorkspaceId);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={cn(
          'w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl',
          'bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-gray-200/80 dark:border-zinc-800/80',
          'animate-in zoom-in-95 duration-200'
        )}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-mac-accent/10 dark:bg-mac-accent/20 text-mac-accent flex items-center justify-center shrink-0">
              <FolderInput size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                {t('moveTitle', { name: item.name })}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {item.isDir ? t('folder', 'Klasör') : t('note', 'Not')} • {currentParent ? `/${currentParent}` : t('rootFolder')}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={isMoving}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-800/30 px-5 pt-2 shrink-0">
          <button
            onClick={() => setActiveTab('folder')}
            className={cn(
              'flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer',
              activeTab === 'folder'
                ? 'border-mac-accent text-mac-accent'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <Folder size={14} />
            {t('moveToFolderTab')}
          </button>

          <button
            onClick={() => setActiveTab('workspace')}
            className={cn(
              'flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer',
              activeTab === 'workspace'
                ? 'border-mac-accent text-mac-accent'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <Layers size={14} />
            {t('moveToWorkspaceTab')}
            {otherWorkspaces.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300">
                {otherWorkspaces.length}
              </span>
            )}
          </button>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={cn(
              'mx-5 mt-4 p-3 rounded-xl flex items-center justify-between text-xs animate-in fade-in',
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
            )}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <Check size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>

            {statusMessage.targetWorkspaceId && (
              <button
                onClick={async () => {
                  if (statusMessage.targetWorkspaceId) {
                    handleClose();
                    await switchWorkspace(statusMessage.targetWorkspaceId);
                  }
                }}
                className="ml-3 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>{t('goToWorkspace', { name: statusMessage.targetWorkspaceName })}</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        )}

        {/* Tab 1: Move to Folder inside current workspace */}
        {activeTab === 'folder' && (
          <div className="flex-1 flex flex-col min-h-0 p-5 space-y-4 overflow-hidden">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('moveToFolderDesc')}
            </p>

            {/* Folder Search & Action Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchFolderPlaceholder')}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-gray-100/80 dark:bg-zinc-800/80 border border-transparent focus:border-mac-accent focus:bg-white dark:focus:bg-zinc-800 outline-none transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border',
                  isCreatingFolder
                    ? 'bg-mac-accent/10 border-mac-accent/30 text-mac-accent'
                    : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 border-transparent text-gray-700 dark:text-gray-300'
                )}
              >
                <FolderPlus size={14} />
                <span className="hidden sm:inline">{t('createNewFolder')}</span>
              </button>
            </div>

            {/* Inline New Folder Form */}
            {isCreatingFolder && (
              <form
                onSubmit={handleCreateAndMove}
                className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 flex items-center gap-2 animate-in slide-in-from-top-2 duration-150"
              >
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={t('enterFolderName', 'Klasör adı...')}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 outline-none focus:border-mac-accent"
                />
                <button
                  type="submit"
                  disabled={!newFolderName.trim() || isMoving}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-mac-accent text-white hover:bg-mac-accent/90 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                >
                  {isMoving ? <Loader2 size={12} className="animate-spin" /> : t('createAndMove')}
                </button>
              </form>
            )}

            {/* Folders List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1">
              {/* Option: Root Directory */}
              {(!searchQuery || 'ana dizin kok root'.includes(searchQuery.toLowerCase())) && (
                <button
                  disabled={currentParent === '' || isMoving}
                  onClick={() => handleMoveToFolder('')}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all border cursor-pointer group',
                    currentParent === ''
                      ? 'bg-gray-100/60 dark:bg-zinc-800/40 border-gray-200/50 dark:border-zinc-800 text-gray-400 cursor-not-allowed'
                      : 'bg-white dark:bg-zinc-900/60 border-gray-100 dark:border-zinc-800 hover:border-mac-accent/40 hover:bg-mac-accent/5'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                      currentParent === ''
                        ? 'bg-gray-200/50 dark:bg-zinc-700/50 text-gray-400'
                        : 'bg-mac-accent/10 text-mac-accent group-hover:bg-mac-accent group-hover:text-white transition-colors'
                    )}>
                      <Home size={14} />
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {t('rootFolder')}
                      </span>
                      <p className="text-[10px] text-gray-400">/ (En üst seviye)</p>
                    </div>
                  </div>

                  {currentParent === '' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-200 dark:bg-zinc-700 text-gray-500">
                      {t('currentLocation')}
                    </span>
                  ) : (
                    <ArrowRight size={14} className="text-gray-400 group-hover:text-mac-accent transition-colors" />
                  )}
                </button>
              )}

              {/* Other Subfolders */}
              {filteredFolders.map((folderPath) => {
                const isCurrent = currentParent === folderPath;
                const isInvalidDescendant =
                  item.isDir &&
                  (folderPath === item.path || folderPath.startsWith(`${item.path}/`));

                const isDisabled = isCurrent || isInvalidDescendant || isMoving;

                return (
                  <button
                    key={folderPath}
                    disabled={isDisabled}
                    onClick={() => handleMoveToFolder(folderPath)}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all border cursor-pointer group',
                      isDisabled
                        ? 'bg-gray-100/60 dark:bg-zinc-800/40 border-gray-200/50 dark:border-zinc-800 text-gray-400 cursor-not-allowed'
                        : 'bg-white dark:bg-zinc-900/60 border-gray-100 dark:border-zinc-800 hover:border-mac-accent/40 hover:bg-mac-accent/5'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                        isDisabled
                          ? 'bg-gray-200/50 dark:bg-zinc-700/50 text-gray-400'
                          : 'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors'
                      )}>
                        <Folder size={14} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">
                          {folderPath.split('/').pop()}
                        </span>
                        <p className="text-[10px] text-gray-400 truncate">/{folderPath}</p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-200 dark:bg-zinc-700 text-gray-500 shrink-0">
                        {t('currentLocation')}
                      </span>
                    ) : isInvalidDescendant ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-500 shrink-0">
                        {t('cannotMoveIntoSelf')}
                      </span>
                    ) : (
                      <ArrowRight size={14} className="text-gray-400 group-hover:text-mac-accent transition-colors shrink-0" />
                    )}
                  </button>
                );
              })}

              {filteredFolders.length === 0 && searchQuery && (
                <div className="text-center py-8 text-gray-400 text-xs">
                  <p>{t('noResultsFound')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Move to Another Workspace */}
        {activeTab === 'workspace' && (
          <div className="flex-1 flex flex-col min-h-0 p-5 space-y-4 overflow-y-auto">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('moveToWorkspaceDesc')}
            </p>

            {otherWorkspaces.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t('noOtherWorkspaces')}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {t('manageWorkspacesDesc')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    handleClose();
                    setWorkspaceModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-mac-accent text-white hover:bg-mac-accent/90 transition-colors cursor-pointer"
                >
                  {t('createNewWorkspace')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {workspaces.map((ws) => {
                  const isCurrent = ws.id === activeWorkspaceId;
                  const IconComp = getWorkspaceIcon(ws.icon);

                  return (
                    <div
                      key={ws.id}
                      className={cn(
                        'flex items-center justify-between p-3.5 rounded-2xl border transition-all',
                        isCurrent
                          ? 'bg-gray-100/50 dark:bg-zinc-800/30 border-gray-200/60 dark:border-zinc-800'
                          : 'bg-white dark:bg-zinc-900/60 border-gray-100 dark:border-zinc-800 hover:border-purple-500/40 hover:bg-purple-500/5'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: ws.color || '#6366f1' }}
                        >
                          <IconComp size={18} />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                              {ws.name}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300">
                                {t('currentWorkspace')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                            {ws.storageType === 'browser' ? (
                              <>
                                <HardDrive size={10} />
                                <span>{ws.handleName || t('tauriDisk')}</span>
                              </>
                            ) : (
                              <>
                                <Database size={10} />
                                <span>{t('browserMemory')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="text-[11px] text-gray-400 font-medium px-2 py-1">
                          —
                        </span>
                      ) : (
                        <button
                          disabled={isMoving}
                          onClick={() => handleMoveToWorkspace(ws.id)}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          {isMoving ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <>
                              <span>{t('move', 'Taşı')}</span>
                              <ArrowRight size={12} />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
