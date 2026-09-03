import React from 'react';
import { useTranslation } from 'react-i18next';
import { FilePlus, FolderPlus } from 'lucide-react';

interface SidebarContextMenuProps {
  contextMenu: { x: number; y: number } | null;
  onClose: () => void;
  onNewNote: () => void;
  onNewFolder: () => void;
}

export const SidebarContextMenu: React.FC<SidebarContextMenuProps> = ({
  contextMenu,
  onClose,
  onNewNote,
  onNewFolder,
}) => {
  const { t } = useTranslation();
  if (!contextMenu) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-50 min-w-[160px] bg-white dark:bg-zinc-900 border border-mac-borderLight dark:border-mac-borderDark rounded-xl shadow-xl p-1 text-xs text-gray-700 dark:text-gray-300 animate-in fade-in zoom-in-95 duration-100"
        style={{ top: contextMenu.y, left: contextMenu.x }}
      >
        <button
          onClick={() => {
            onClose();
            onNewNote();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors cursor-pointer"
        >
          <FilePlus size={14} />
          <span>{t('newNote')}</span>
        </button>
        <button
          onClick={() => {
            onClose();
            onNewFolder();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors cursor-pointer"
        >
          <FolderPlus size={14} />
          <span>{t('newFolder')}</span>
        </button>
      </div>
    </>
  );
};
