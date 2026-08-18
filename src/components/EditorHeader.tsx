import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TagCount } from '@/store/noteStore';
import { MultiBadgeSelect } from '@/components/MultiBadgeSelect';
import { useGitStore } from '@/store/gitStore';
import {
  PanelRightClose,
  PanelRightOpen,
  Calendar,
  Clock,
  Tag,
  X,
  History,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

interface EditorHeaderProps {
  currentNoteId: string;
  localContent: string;
  currentTags: string[];
  vaultTags: TagCount[];
  rightPanelOpen: boolean;
  showTagPopover: boolean;
  onToggleRightPanel: () => void;
  onToggleTagPopover: () => void;
  onCloseTagPopover: () => void;
  onUpdateTags: (tags: string[]) => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  currentNoteId,
  localContent,
  currentTags,
  vaultTags,
  rightPanelOpen,
  showTagPopover,
  onToggleRightPanel,
  onToggleTagPopover,
  onCloseTagPopover,
  onUpdateTags,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fontSize = useUiStore(s => s.fontSize);
  const setFontSize = useUiStore(s => s.setFontSize);
  const readMinutes = Math.max(1, Math.ceil(localContent.split(' ').length / 200));

  // Navigation shortcuts: Alt+Left / Alt+Right or Cmd+[ / Cmd+]
  useEffect(() => {
    const handleNavShortcuts = (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        navigate(-1);
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        navigate(1);
      }
    };
    window.addEventListener('keydown', handleNavShortcuts);
    return () => window.removeEventListener('keydown', handleNavShortcuts);
  }, [navigate]);

  return (
    <header className="h-12 border-b border-mac-borderLight dark:border-mac-borderDark flex items-center justify-between px-4 shrink-0 relative">
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-medium min-w-0">
        {/* Obsidian/VS Code Style Back & Forward Arrows */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-gray-200 dark:border-zinc-800">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Geri (Alt + Sol Ok)"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => navigate(1)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="İleri (Alt + Sağ Ok)"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 truncate"><Calendar size={14} className="shrink-0" /> <span className="truncate">{currentNoteId}</span></div>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0"><Clock size={14} /> {readMinutes} min read</div>
        
        {/* Note Tags Badges & Popover Trigger */}
        <div className="relative flex items-center gap-1.5 border-l border-gray-200 dark:border-zinc-800 pl-3">
          {currentTags.map((tag: string) => (
            <span 
              key={tag} 
              className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1"
            >
              #{tag}
            </span>
          ))}

          <button
            onClick={onToggleTagPopover}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-purple-500/15 hover:text-purple-600 transition-colors flex items-center gap-1"
            title={t('editNoteTags')}
          >
            <Tag size={10} />
            <span>{currentTags.length === 0 ? t('addTag') : t('editTags')}</span>
          </button>

          {/* Tag Manager Popover */}
          {showTagPopover && (
            <div className="absolute top-9 left-3 z-50 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl p-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                  <Tag size={12} className="text-purple-500" /> {t('noteTags')}
                </span>
                <button 
                  onClick={onCloseTagPopover}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md"
                >
                  <X size={12} />
                </button>
              </div>

              <MultiBadgeSelect
                label=""
                values={currentTags}
                onChange={onUpdateTags}
                suggestions={vaultTags.map((t: TagCount) => t.tag)}
                placeholder={t('tagPlaceholder')}
                badgeStyle="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Font Size Segmented Control (Small, Medium, Large) */}
        <div className="flex items-center bg-gray-100 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-gray-200/80 dark:border-zinc-700/80 select-none">
          <button
            onClick={() => setFontSize('sm')}
            className={cn(
              "px-2 py-0.5 text-[11px] font-medium rounded-md transition-all",
              fontSize === 'sm'
                ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-2xs font-semibold"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            )}
            title="Küçük Font (13px)"
          >
            Small
          </button>
          <button
            onClick={() => setFontSize('md')}
            className={cn(
              "px-2 py-0.5 text-[11px] font-medium rounded-md transition-all",
              fontSize === 'md'
                ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-2xs font-semibold"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            )}
            title="Orta Font (14px)"
          >
            Medium
          </button>
          <button
            onClick={() => setFontSize('lg')}
            className={cn(
              "px-2 py-0.5 text-[11px] font-medium rounded-md transition-all",
              fontSize === 'lg'
                ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-2xs font-semibold"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            )}
            title="Büyük Font (16px)"
          >
            Large
          </button>
        </div>

        {/* History / Time Machine Button */}
        {currentNoteId && (
          <button
            onClick={() => useGitStore.getState().openHistoryDrawer(currentNoteId)}
            className="p-1.5 rounded-md hover:bg-purple-500/10 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
            title="Not Versiyon Geçmişi & Diff"
          >
            <History size={16} />
          </button>
        )}

        <button onClick={onToggleRightPanel} className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 transition-colors cursor-pointer" title="Sağ Paneli Aç/Kapat">
          {rightPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </div>
    </header>
  );
};
