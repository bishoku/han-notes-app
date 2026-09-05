import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  Plus,
  Settings2,
  Check,
  FolderOpen,
  Loader2,
  HardDrive,
  Database,
} from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getWorkspaceIcon } from './workspaceIcons';
import { isFileSystemAccessSupported } from '@/services/storage';
import { cn } from '@/lib/utils';

export const WorkspaceSwitcherDropdown: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    workspaces,
    activeWorkspaceId,
    isSwitching,
    switchWorkspace,
    createBrowserWorkspace,
    setWorkspaceModalOpen,
    getActiveWorkspace,
  } = useWorkspaceStore();

  const activeWorkspace = getActiveWorkspace();
  const ActiveIcon = getWorkspaceIcon(activeWorkspace?.icon);

  // Close on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectWorkspace = async (workspaceId: string) => {
    if (workspaceId === activeWorkspaceId) {
      setIsOpen(false);
      return;
    }
    try {
      await switchWorkspace(workspaceId);
      setIsOpen(false);
    } catch (err) {
      console.error('[WorkspaceSwitcher] Failed to switch:', err);
    }
  };

  const handleAddBrowserWorkspace = async () => {
    setIsOpen(false);
    try {
      await createBrowserWorkspace();
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('[WorkspaceSwitcher] Add browser workspace error:', err);
      }
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isSwitching}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all cursor-pointer select-none text-left max-w-[170px]',
          'hover:bg-black/5 dark:hover:bg-white/5 active:scale-95',
          isOpen && 'bg-black/5 dark:bg-white/5 ring-1 ring-black/10 dark:ring-white/10'
        )}
        title={activeWorkspace?.name || t('workspace')}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
          style={{ backgroundColor: activeWorkspace?.color || '#6366f1' }}
        />
        <ActiveIcon
          size={13}
          className="shrink-0 text-gray-600 dark:text-gray-300"
          style={{ color: activeWorkspace?.color }}
        />
        <span className="font-bold text-xs truncate text-gray-800 dark:text-gray-200">
          {activeWorkspace?.name || t('defaultWorkspace')}
        </span>
        {isSwitching ? (
          <Loader2 size={12} className="shrink-0 animate-spin text-gray-400" />
        ) : (
          <ChevronDown
            size={12}
            className={cn(
              'shrink-0 text-gray-400 transition-transform duration-200',
              isOpen && 'rotate-180 text-gray-600 dark:text-gray-200'
            )}
          />
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 top-full mt-1.5 w-64 rounded-2xl z-50 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150',
            'bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200/80 dark:border-zinc-800/80',
            'p-1.5 flex flex-col gap-1'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-100 dark:border-zinc-800/60 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            <span>{t('workspaces')}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-[10px] font-mono text-gray-500">
              {workspaces.length}
            </span>
          </div>

          {/* Workspaces List */}
          <div className="max-h-60 overflow-y-auto flex flex-col gap-0.5 py-1">
            {workspaces.map((ws) => {
              const Icon = getWorkspaceIcon(ws.icon);
              const isActive = ws.id === activeWorkspaceId;

              return (
                <button
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer group',
                    isActive
                      ? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-medium'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: ws.color || '#6366f1' }}
                    />
                    <Icon size={14} className="shrink-0" style={{ color: ws.color }} />
                    <span className="truncate">{ws.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-black/5 dark:bg-white/5 text-gray-400"
                      title={ws.storageType === 'browser' ? t('localFolder') : t('browserStorage')}
                    >
                      {ws.storageType === 'browser' ? (
                        <FolderOpen size={10} className="inline mr-1 -mt-0.5" />
                      ) : ws.storageType === 'indexeddb' ? (
                        <Database size={10} className="inline mr-1 -mt-0.5" />
                      ) : (
                        <HardDrive size={10} className="inline mr-1 -mt-0.5" />
                      )}
                      {ws.storageType === 'browser' ? 'FSA' : ws.storageType === 'indexeddb' ? 'IDB' : 'FS'}
                    </span>
                    {isActive && <Check size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Actions Separator */}
          <div className="border-t border-gray-100 dark:border-zinc-800/60 my-0.5" />

          {/* Action Buttons */}
          <div className="flex flex-col gap-0.5">
            {isFileSystemAccessSupported() && (
              <button
                onClick={handleAddBrowserWorkspace}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer"
              >
                <FolderOpen size={13} className="text-indigo-500" />
                <span>{t('openNewFolderWorkspace')}</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsOpen(false);
                setWorkspaceModalOpen(true);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer"
            >
              <Plus size={13} className="text-purple-500" />
              <span>{t('addNewWorkspace')}</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                setWorkspaceModalOpen(true);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              <Settings2 size={13} />
              <span>{t('manageWorkspaces')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
