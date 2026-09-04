import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TagCount } from '@/store/noteStore';
import { MultiBadgeSelect } from '@/components/MultiBadgeSelect';
import { useGitStore } from '@/store/gitStore';
import { useAiStore } from '@/store/aiStore';
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
  Printer,
  Menu,
  MoreVertical,
  Sparkles,
  List,
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
  const setSettingsModalOpen = useUiStore(s => s.setSettingsModalOpen);

  const isAiEnabled = useAiStore(s => s.settings.enabled);
  const isChatDrawerOpen = useAiStore(s => s.isChatDrawerOpen);
  const setChatDrawerOpen = useAiStore(s => s.setChatDrawerOpen);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleToggleAi = () => {
    if (isAiEnabled) {
      setChatDrawerOpen(!isChatDrawerOpen);
    } else {
      setSettingsModalOpen(true);
    }
  };

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

  // PDF Export using native print engine
  const handleExportPdf = () => {
    if (!currentNoteId) return;
    const noteTitle = currentNoteId.replace(/\.md$/, '').split('/').pop() || 'note';
    const originalTitle = document.title;
    document.title = noteTitle;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <header className="print:hidden shrink-0 pt-safe bg-mac-mainLight/80 dark:bg-mac-mainDark/80 backdrop-blur-xs border-b border-mac-borderLight dark:border-mac-borderDark z-30 select-none relative">
      <div className="h-11 min-h-[44px] flex items-center justify-between px-3 md:px-4 gap-2">
        {/* ── Left Side: Back/Forward, Note Title, Tags ── */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium min-w-0 flex-1">
        {/* Mobile Sidebar Open Button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0 -ml-1 min-w-[38px] min-h-[38px] flex items-center justify-center active:scale-95"
          title={t('expandSidebar')}
        >
          <Menu size={20} />
        </button>

        {/* Desktop Expand Sidebar Button (Visible when sidebar is collapsed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="hidden md:inline-flex p-1 rounded-md text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer shrink-0 mr-0.5"
            title={t('expandSidebar')}
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        {/* Desktop Navigation Arrows */}
        <div className="hidden md:flex items-center gap-0.5 pr-1.5 border-r border-gray-200 dark:border-zinc-800 shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={t('navBack')}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => navigate(1)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={t('navForward')}
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Note Path / Title */}
        <div className="flex items-center gap-1.5 truncate min-w-0 shrink">
          <Calendar size={13} className="shrink-0 text-gray-400" />
          <span className="truncate text-gray-700 dark:text-gray-300 font-semibold">{currentNoteId}</span>
        </div>
        
        {/* Desktop Note Tags Badges & Popover Trigger */}
        <div className="hidden md:flex relative items-center gap-1.5 border-l border-gray-200 dark:border-zinc-800 pl-2 shrink-0">
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
            <>
              {/* Invisible backdrop to dismiss popover on click outside */}
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={onCloseTagPopover}
              />
              <div className="absolute top-9 left-0 z-50 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <Tag size={12} className="text-purple-500" /> {t('noteTags')}
                  </span>
                  <button 
                    onClick={onCloseTagPopover}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md cursor-pointer"
                    title={t('close')}
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
            </>
          )}
        </div>
      </div>

      {/* ── Desktop Right Side: Mode Switcher, Font Size (a/A/A), History, Right Panel ── */}
      <div className="hidden md:flex items-center gap-1.5 shrink-0">
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
            title={t('statusEditorPreview')}
          >
            <Eye size={12} className={editorMode === 'preview' ? "text-purple-600 dark:text-purple-400" : ""} />
            <span className="hidden md:inline">{t('modePreview')}</span>
          </button>
          <button
            onClick={() => setEditorMode('raw')}
            className={cn(
              "flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer",
              editorMode === 'raw'
                ? "bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-2xs font-semibold"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            )}
            title={t('statusEditorRaw')}
          >
            <FileCode size={12} className={editorMode === 'raw' ? "text-purple-600 dark:text-purple-400" : ""} />
            <span className="hidden md:inline">{t('modeRaw')}</span>
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
            title={t('fontSizeSmall')}
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
            title={t('fontSizeMedium')}
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
            title={t('fontSizeLarge')}
          >
            <span className="text-[15px] font-bold leading-none">A</span>
          </button>
        </div>

        {/* History / Time Machine Button */}
        {currentNoteId && (
          <button
            onClick={() => useGitStore.getState().openHistoryDrawer(currentNoteId)}
            className="p-1.5 rounded-md hover:bg-purple-500/10 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
            title={t('versionHistoryAndDiff')}
          >
            <History size={15} />
          </button>
        )}

        {/* PDF Export Button */}
        {currentNoteId && (
          <button
            onClick={handleExportPdf}
            className="p-1.5 rounded-md hover:bg-purple-500/10 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
            title={t('exportPdf', 'PDF Olarak Dışa Aktar')}
          >
            <Printer size={15} />
          </button>
        )}

        {/* Right Panel Toggle Button */}
        <button 
          onClick={onToggleRightPanel} 
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer" 
          title={rightPanelOpen ? t('collapseRightPanel') : t('expandRightPanel')}
        >
          {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>

      {/* ── Mobile Right Side: AI Assistant Sparkle + More Actions ── */}
      <div className="flex md:hidden items-center gap-1 shrink-0">
        <button
          onClick={handleToggleAi}
          className={cn(
            "p-1.5 rounded-lg transition-colors cursor-pointer",
            isChatDrawerOpen
              ? "bg-purple-600 text-white shadow-xs"
              : "text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
          )}
          title={t('aiAssistantTitle')}
        >
          <Sparkles size={18} className={isAiEnabled ? "animate-pulse" : ""} />
        </button>

        <div className="relative">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={t('moreOptions', 'Daha Fazla')}
          >
            <MoreVertical size={18} />
          </button>

          {mobileMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="absolute right-0 top-9 z-50 w-60 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95">
                {/* Note Tags */}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onToggleTagPopover();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 transition-colors text-left"
                >
                  <Tag size={15} className="text-purple-500 shrink-0" />
                  <span>{currentTags.length === 0 ? t('addTag') : `${currentTags.length} ${t('noteTags')}`}</span>
                </button>

                {/* Font Size Selector */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800/50">
                  <span className="text-gray-500 font-medium">{t('fontSize', 'Yazı')}</span>
                  <div className="flex items-center gap-1">
                    {(['sm', 'md', 'lg'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setFontSize(size)}
                        className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs cursor-pointer transition-all",
                          fontSize === size
                            ? "bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-xs"
                            : "text-gray-400 hover:text-gray-700"
                        )}
                      >
                        {size === 'sm' ? 'a' : size === 'md' ? 'A' : 'A+'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outline & Backlinks */}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onToggleRightPanel();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 transition-colors text-left"
                >
                  <List size={15} className="text-blue-500 shrink-0" />
                  <span>{t('outline', 'Başlıklar')} & {t('backlinks', 'Bağlantılar')}</span>
                </button>

                {/* Export PDF */}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleExportPdf();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 transition-colors text-left"
                >
                  <Printer size={15} className="text-gray-500 shrink-0" />
                  <span>{t('exportPdf', 'PDF Olarak Dışa Aktar')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </header>
  );
};

