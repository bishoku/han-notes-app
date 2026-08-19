import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TagCount } from '@/store/noteStore';
import { MultiBadgeSelect } from '@/components/MultiBadgeSelect';
import { useGitStore } from '@/store/gitStore';
import {
  PanelRightClose,
  PanelRightOpen,
  PanelLeftOpen,
  Calendar,
  Tag,
  X,
  History,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCode,
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
  localContent: _localContent,
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
  const editorMode = useUiStore(s => s.editorMode);
  const setEditorMode = useUiStore(s => s.setEditorMode);
  const sidebarOpen = useUiStore(s => s.sidebarOpen);
  const setSidebarOpen = useUiStore(s => s.setSidebarOpen);

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
    <header className="h-11 min-h-[44px] max-h-[44px] border-b border-mac-borderLight dark:border-mac-borderDark flex items-center justify-between px-3 md:px-4 shrink-0 relative bg-mac-mainLight/80 dark:bg-mac-mainDark/80 backdrop-blur-xs gap-2 select-none overflow-hidden">
      {/* ── Left Side: Back/Forward, Note Title, Tags ── */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium min-w-0 flex-1 overflow-hidden">
        {/* Expand Sidebar Button (Visible when sidebar is collapsed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 rounded-md text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer shrink-0 mr-0.5"
            title="Kenar Çubuğunu Aç (Explorer)"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        {/* Navigation Arrows */}
        <div className="flex items-center gap-0.5 pr-1.5 border-r border-gray-200 dark:border-zinc-800 shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Geri (Alt + Sol Ok)"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => navigate(1)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="İleri (Alt + Sağ Ok)"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Note Path / Title */}
        <div className="flex items-center gap-1.5 truncate min-w-0 shrink">
          <Calendar size={13} className="shrink-0 text-gray-400" />
          <span className="truncate text-gray-700 dark:text-gray-300 font-semibold">{currentNoteId}</span>
        </div>
        
        {/* Note Tags Badges & Popover Trigger */}
        <div className="relative flex items-center gap-1.5 border-l border-gray-200 dark:border-zinc-800 pl-2 shrink-0">
          <div className="hidden lg:flex items-center gap-1 max-w-[200px] overflow-hidden truncate">
            {currentTags.map((tag: string) => (
              <span 
                key={tag} 
                className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1 shrink-0"
              >
                #{tag}
              </span>
            ))}
          </div>

          <button
            onClick={onToggleTagPopover}
            className="px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-purple-500/15 hover:text-purple-600 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            title={t('editNoteTags')}
          >
            <Tag size={11} />
            <span className="hidden sm:inline">{currentTags.length === 0 ? t('addTag') : `${currentTags.length} ${t('noteTags')}`}</span>
          </button>

          {/* Tag Manager Popover */}
          {showTagPopover && (
            <div className="absolute top-8 left-0 z-50 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl p-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                  <Tag size={12} className="text-purple-500" /> {t('noteTags')}
                </span>
                <button 
                  onClick={onCloseTagPopover}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md cursor-pointer"
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

      {/* ── Right Side: Mode Switcher, Font Size (a/A/A), History, Right Panel ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Editor Mode Segmented Control: Önizleme vs Ham Metin */}
        <div className="flex items-center bg-gray-100/90 dark:bg-zinc-800/90 p-0.5 rounded-lg border border-gray-200/80 dark:border-zinc-700/80 select-none">
          <button
            onClick={() => setEditorMode('preview')}
            className={cn(
              "flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer",
              editorMode === 'preview'
                ? "bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-2xs font-semibold"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            )}
            title="Canlı Önizleme Modu (WYSIWYG)"
          >
            <Eye size={12} className={editorMode === 'preview' ? "text-purple-600 dark:text-purple-400" : ""} />
            <span className="hidden md:inline">Önizleme</span>
          </button>
          <button
            onClick={() => setEditorMode('raw')}
            className={cn(
              "flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer",
              editorMode === 'raw'
                ? "bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-2xs font-semibold"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            )}
            title="Ham Metin Kod Editörü (Plain Text)"
          >
            <FileCode size={12} className={editorMode === 'raw' ? "text-purple-600 dark:text-purple-400" : ""} />
            <span className="hidden md:inline">Ham Metin</span>
          </button>
        </div>

        {/* Font Size Segmented Control (a, A, A typography icons) */}
        <div className="flex items-center bg-gray-100/90 dark:bg-zinc-800/90 p-0.5 rounded-lg border border-gray-200/80 dark:border-zinc-700/80 select-none">
          <button
            onClick={() => setFontSize('sm')}
            className={cn(
              "w-5 h-5 flex items-center justify-center rounded-md transition-all cursor-pointer",
              fontSize === 'sm'
                ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-2xs font-bold"
                : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
            title="Küçük Font (13px)"
          >
            <span className="text-[10px] font-medium leading-none">a</span>
          </button>
          <button
            onClick={() => setFontSize('md')}
            className={cn(
              "w-5 h-5 flex items-center justify-center rounded-md transition-all cursor-pointer",
              fontSize === 'md'
                ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-2xs font-bold"
                : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
            title="Orta Font (14px)"
          >
            <span className="text-[12px] font-semibold leading-none">A</span>
          </button>
          <button
            onClick={() => setFontSize('lg')}
            className={cn(
              "w-5 h-5 flex items-center justify-center rounded-md transition-all cursor-pointer",
              fontSize === 'lg'
                ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-2xs font-bold"
                : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
            title="Büyük Font (16px)"
          >
            <span className="text-[15px] font-bold leading-none">A</span>
          </button>
        </div>

        {/* History / Time Machine Button */}
        {currentNoteId && (
          <button
            onClick={() => useGitStore.getState().openHistoryDrawer(currentNoteId)}
            className="p-1.5 rounded-md hover:bg-purple-500/10 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
            title="Not Versiyon Geçmişi & Diff"
          >
            <History size={15} />
          </button>
        )}

        {/* Right Panel Toggle Button */}
        <button 
          onClick={onToggleRightPanel} 
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer" 
          title={rightPanelOpen ? "Sağ Paneli Kapat" : "Sağ Paneli Aç"}
        >
          {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>
    </header>
  );
};

