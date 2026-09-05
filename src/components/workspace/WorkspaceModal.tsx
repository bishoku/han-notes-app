import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  FolderOpen,
  Database,
  HardDrive,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { WORKSPACE_COLORS, WORKSPACE_ICONS, getWorkspaceIcon } from './workspaceIcons';
import { isFileSystemAccessSupported } from '@/services/storage';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/services/workspace';

export const WorkspaceModal: React.FC = () => {
  const { t } = useTranslation();
  const {
    workspaces,
    activeWorkspaceId,
    isWorkspaceModalOpen,
    isSwitching,
    setWorkspaceModalOpen,
    switchWorkspace,
    createWorkspace,
    createBrowserWorkspace,
    deleteWorkspace,
    renameWorkspace,
  } = useWorkspaceStore();

  // Create workspace form state
  const [newWsName, setNewWsName] = useState('');
  const [newWsColor, setNewWsColor] = useState(WORKSPACE_COLORS[0]);
  const [newWsIcon, setNewWsIcon] = useState('Folder');
  const [newWsStorageType, setNewWsStorageType] = useState<'indexeddb' | 'browser'>(
    isFileSystemAccessSupported() ? 'browser' : 'indexeddb'
  );
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Editing state
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editIcon, setEditIcon] = useState('');

  // Delete confirm state
  const [deletingWsId, setDeletingWsId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!isWorkspaceModalOpen) return null;

  const handleStartEdit = (ws: Workspace) => {
    setEditingWsId(ws.id);
    setEditName(ws.name);
    setEditColor(ws.color || WORKSPACE_COLORS[0]);
    setEditIcon(ws.icon || 'Folder');
  };

  const handleSaveEdit = async () => {
    if (!editingWsId || !editName.trim()) return;
    try {
      await renameWorkspace(editingWsId, editName.trim(), editColor, editIcon);
      setEditingWsId(null);
    } catch (err: any) {
      console.error('[WorkspaceModal] Save edit failed:', err);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    setCreateError(null);
    setIsCreating(true);

    try {
      if (newWsStorageType === 'browser') {
        const ws = await createBrowserWorkspace();
        if (ws) {
          // If custom color/icon were picked, update them
          await renameWorkspace(ws.id, newWsName.trim() || ws.name, newWsColor, newWsIcon);
        }
      } else {
        await createWorkspace({
          name: newWsName.trim(),
          color: newWsColor,
          icon: newWsIcon,
          storageType: 'indexeddb',
        });
      }

      setNewWsName('');
      setWorkspaceModalOpen(false);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setCreateError(err?.message || 'Çalışma alanı oluşturulamadı.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteConfirm = async (wsId: string) => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteWorkspace(wsId);
      setDeletingWsId(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Çalışma alanı silinemedi.');
    } finally {
      setIsDeleting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={cn(
          'w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl',
          'bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-gray-200/80 dark:border-zinc-800/80',
          'animate-in zoom-in-95 duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t('manageWorkspaces')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('manageWorkspacesDesc')}
              </p>
            </div>
          </div>

          <button
            onClick={() => setWorkspaceModalOpen(false)}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: Workspaces List */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              {t('activeAndSavedWorkspaces')} ({workspaces.length})
            </h3>

            {deleteError && (
              <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="space-y-2.5">
              {workspaces.map((ws) => {
                const Icon = getWorkspaceIcon(ws.icon);
                const isActive = ws.id === activeWorkspaceId;
                const isEditing = ws.id === editingWsId;
                const isConfirmingDelete = ws.id === deletingWsId;

                if (isEditing) {
                  return (
                    <div
                      key={ws.id}
                      className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-purple-500/30 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-sm rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder={t('workspaceName')}
                        />
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors cursor-pointer"
                        >
                          {t('save')}
                        </button>
                        <button
                          onClick={() => setEditingWsId(null)}
                          className="px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          {t('cancel')}
                        </button>
                      </div>

                      {/* Color & Icon Picker in Edit */}
                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">{t('color')}:</span>
                          <div className="flex items-center gap-1">
                            {WORKSPACE_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditColor(c)}
                                className={cn(
                                  'w-5 h-5 rounded-full cursor-pointer transition-transform',
                                  editColor === c && 'scale-125 ring-2 ring-purple-500'
                                )}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">{t('icon')}:</span>
                          <div className="flex items-center gap-1">
                            {Object.keys(WORKSPACE_ICONS).slice(0, 6).map((iconKey) => {
                              const I = WORKSPACE_ICONS[iconKey];
                              return (
                                <button
                                  key={iconKey}
                                  type="button"
                                  onClick={() => setEditIcon(iconKey)}
                                  className={cn(
                                    'p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer',
                                    editIcon === iconKey && 'bg-purple-500/20 text-purple-600'
                                  )}
                                >
                                  <I size={14} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={ws.id}
                    className={cn(
                      'flex items-center justify-between p-3.5 rounded-2xl border transition-all',
                      isActive
                        ? 'bg-purple-500/5 dark:bg-purple-500/10 border-purple-500/30'
                        : 'bg-black/2 dark:bg-white/2 border-gray-100 dark:border-zinc-800/80 hover:bg-black/5 dark:hover:bg-white/5'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                        style={{
                          backgroundColor: `${ws.color || '#6366f1'}20`,
                          color: ws.color || '#6366f1',
                        }}
                      >
                        <Icon size={18} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                            {ws.name}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-700 dark:text-purple-300">
                              {t('active')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            {ws.storageType === 'browser' ? (
                              <FolderOpen size={12} className="text-indigo-400" />
                            ) : ws.storageType === 'indexeddb' ? (
                              <Database size={12} className="text-emerald-400" />
                            ) : (
                              <HardDrive size={12} className="text-amber-400" />
                            )}
                            {ws.storageType === 'browser'
                              ? ws.handleName || t('localFolder')
                              : ws.storageType === 'indexeddb'
                              ? t('browserStorage')
                              : t('tauriDisk')}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(ws.updatedAt || ws.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-red-500/10 border border-red-500/20">
                          <span className="text-[11px] text-red-600 dark:text-red-400 px-1 font-medium">
                            {t('confirmDelete')}?
                          </span>
                          <button
                            onClick={() => handleDeleteConfirm(ws.id)}
                            disabled={isDeleting}
                            className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : t('yes')}
                          </button>
                          <button
                            onClick={() => setDeletingWsId(null)}
                            disabled={isDeleting}
                            className="px-2 py-1 rounded-lg text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 text-[11px] cursor-pointer"
                          >
                            {t('no')}
                          </button>
                        </div>
                      ) : (
                        <>
                          {!isActive && (
                            <button
                              onClick={async () => {
                                await switchWorkspace(ws.id);
                                setWorkspaceModalOpen(false);
                              }}
                              disabled={isSwitching}
                              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {t('openWorkspace')}
                            </button>
                          )}

                          <button
                            onClick={() => handleStartEdit(ws)}
                            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            title={t('edit')}
                          >
                            <Edit2 size={14} />
                          </button>

                          {workspaces.length > 1 && (
                            <button
                              onClick={() => setDeletingWsId(ws.id)}
                              className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title={t('deleteWorkspace')}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Create New Workspace */}
          <div className="pt-2 border-t border-gray-100 dark:border-zinc-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              {t('createNewWorkspace')}
            </h3>

            <form
              onSubmit={handleCreateNew}
              className="p-4 rounded-2xl bg-black/2 dark:bg-white/2 border border-gray-100 dark:border-zinc-800/80 space-y-4"
            >
              {createError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Name & Storage type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('workspaceName')}
                  </label>
                  <input
                    type="text"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    placeholder={t('workspaceNamePlaceholder')}
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('storageType')}
                  </label>
                  {isFileSystemAccessSupported() ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewWsStorageType('browser')}
                        className={cn(
                          'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                          newWsStorageType === 'browser'
                            ? 'bg-purple-500/15 border-purple-500 text-purple-700 dark:text-purple-300'
                            : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400'
                        )}
                      >
                        <FolderOpen size={13} />
                        <span>{t('localFolder')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewWsStorageType('indexeddb')}
                        className={cn(
                          'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                          newWsStorageType === 'indexeddb'
                            ? 'bg-purple-500/15 border-purple-500 text-purple-700 dark:text-purple-300'
                            : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400'
                        )}
                      >
                        <Database size={13} />
                        <span>{t('browserMemory')}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-500 flex items-center gap-2">
                      <Database size={13} className="text-emerald-500" />
                      <span>{t('browserMemoryIsolated')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Color and Icon Palettes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Color Selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    {t('color')}
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {WORKSPACE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewWsColor(c)}
                        className={cn(
                          'w-6 h-6 rounded-full cursor-pointer transition-transform',
                          newWsColor === c && 'scale-125 ring-2 ring-offset-2 ring-purple-500'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon Selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    {t('icon')}
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Object.keys(WORKSPACE_ICONS).map((iconKey) => {
                      const IconComp = WORKSPACE_ICONS[iconKey];
                      return (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setNewWsIcon(iconKey)}
                          className={cn(
                            'p-1.5 rounded-xl border transition-all cursor-pointer',
                            newWsIcon === iconKey
                              ? 'bg-purple-500/20 border-purple-500 text-purple-600 dark:text-purple-300'
                              : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
                          )}
                        >
                          <IconComp size={15} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Create Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isCreating || !newWsName.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isCreating ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Plus size={15} />
                  )}
                  <span>
                    {newWsStorageType === 'browser'
                      ? t('selectFolderAndCreate')
                      : t('createWorkspace')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
