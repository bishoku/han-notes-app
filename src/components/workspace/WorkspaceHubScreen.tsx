import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderOpen,
  FolderCheck,
  Plus,
  Loader2,
  Database,
  ArrowRight,
  HardDrive,
  AlertCircle,
} from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getWorkspaceIcon } from './workspaceIcons';
import { isFileSystemAccessSupported } from '@/services/storage';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/services/workspace';

interface WorkspaceHubScreenProps {
  onWorkspaceSelected?: () => void;
}

export const WorkspaceHubScreen: React.FC<WorkspaceHubScreenProps> = ({
  onWorkspaceSelected,
}) => {
  const { t } = useTranslation();
  const {
    workspaces,
    switchWorkspace,
    createBrowserWorkspace,
    createWorkspace,
  } = useWorkspaceStore();

  const [loadingWsId, setLoadingWsId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newIndexedDbName, setNewIndexedDbName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  const handleOpenWorkspace = async (ws: Workspace) => {
    setError(null);
    setLoadingWsId(ws.id);
    try {
      await switchWorkspace(ws.id);
      onWorkspaceSelected?.();
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || t('directoryRestoreError'));
      }
    } finally {
      setLoadingWsId(null);
    }
  };

  const handlePickNewBrowserFolder = async () => {
    setError(null);
    setIsCreatingNew(true);
    try {
      const ws = await createBrowserWorkspace();
      if (ws) {
        onWorkspaceSelected?.();
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || t('directorySelectError'));
      }
    } finally {
      setIsCreatingNew(false);
    }
  };

  const handleCreateIndexedDbWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndexedDbName.trim()) return;

    setError(null);
    setIsCreatingNew(true);
    try {
      await createWorkspace({
        name: newIndexedDbName.trim(),
        storageType: 'indexeddb',
      });
      setNewIndexedDbName('');
      setShowNamePrompt(false);
      onWorkspaceSelected?.();
    } catch (err: any) {
      setError(err?.message || 'Çalışma alanı oluşturulamadı.');
    } finally {
      setIsCreatingNew(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-4 sm:p-6 select-none">
      <div className="w-full max-w-xl p-6 sm:p-8 rounded-3xl bg-white/10 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/20 dark:border-zinc-700/50 shadow-2xl text-white">
        {/* App Logo & Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-2xl font-bold tracking-tight">H</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight mb-2">
            H.A.N. {t('workspaces')}
          </h1>
          <p className="text-xs sm:text-sm text-gray-300 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
            {isFileSystemAccessSupported()
              ? t('workspaceHubDescFSA')
              : t('workspaceHubDescIDB')}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/20 border border-red-500/30 text-xs text-red-200 flex items-center gap-2.5">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Workspaces List / Cards */}
        <div className="space-y-3 mb-5">
          {workspaces.map((ws) => {
            const Icon = getWorkspaceIcon(ws.icon);
            const isLoadingThis = loadingWsId === ws.id;

            return (
              <div
                key={ws.id}
                onClick={() => !isLoadingThis && handleOpenWorkspace(ws)}
                className={cn(
                  'group flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer',
                  'bg-white/5 hover:bg-white/10 border-white/10 hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.99]',
                  isLoadingThis && 'opacity-70 pointer-events-none'
                )}
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform"
                    style={{
                      backgroundColor: `${ws.color || '#6366f1'}30`,
                      color: ws.color || '#6366f1',
                    }}
                  >
                    <Icon size={20} />
                  </div>

                  <div className="min-w-0 text-left">
                    <div className="font-semibold text-sm sm:text-base text-white truncate flex items-center gap-2">
                      <span>{ws.name}</span>
                      {ws.isDefault && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-gray-300">
                          {t('default')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        {ws.storageType === 'browser' ? (
                          <FolderOpen size={12} className="text-indigo-400" />
                        ) : ws.storageType === 'indexeddb' ? (
                          <Database size={12} className="text-emerald-400" />
                        ) : (
                          <HardDrive size={12} className="text-amber-400" />
                        )}
                        {ws.handleName || (ws.storageType === 'browser' ? t('localFolder') : t('browserMemory'))}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(ws.updatedAt || ws.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    disabled={isLoadingThis}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-2xs"
                  >
                    {isLoadingThis ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : ws.storageType === 'browser' ? (
                      <FolderCheck size={14} />
                    ) : (
                      <ArrowRight size={14} />
                    )}
                    <span>
                      {ws.storageType === 'browser' ? t('openFolder') : t('enter')}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action: Add New Workspace */}
        {showNamePrompt ? (
          <form
            onSubmit={handleCreateIndexedDbWorkspace}
            className="p-4 rounded-2xl bg-white/5 border border-purple-500/40 space-y-3"
          >
            <label className="block text-xs font-semibold text-gray-300">
              {t('newWorkspaceName')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={newIndexedDbName}
                onChange={(e) => setNewIndexedDbName(e.target.value)}
                placeholder="Örn: Kişisel Notlar"
                className="flex-1 px-3.5 py-2 rounded-xl bg-black/40 border border-white/20 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={isCreatingNew || !newIndexedDbName.trim()}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold text-xs hover:bg-purple-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isCreatingNew ? <Loader2 size={14} className="animate-spin" /> : t('create')}
              </button>
              <button
                type="button"
                onClick={() => setShowNamePrompt(false)}
                className="px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            {isFileSystemAccessSupported() ? (
              <button
                onClick={handlePickNewBrowserFolder}
                disabled={isCreatingNew}
                className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 transition-all cursor-pointer"
              >
                {isCreatingNew ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <FolderOpen size={18} />
                )}
                <span>{t('selectDifferentFolderOrAdd')}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowNamePrompt(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>{t('addNewWorkspace')}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
