/**
 * MindmapToolbar.tsx — Top control bar for the Workspace Mindmap & Knowledge Graph.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  useGraphStore,
  type GraphColorBy,
} from '@/store/graphStore';
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Network,
  GitFork,
  CircleDot,
  Radio,
  Eye,
  EyeOff,
  Palette,
  Layers,
  Sparkles,
  FolderTree,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/uiStore';

interface MindmapToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onResetLayout: () => void;
}

export const MindmapToolbar: React.FC<MindmapToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  onFit,
  onResetLayout,
}) => {
  const { t } = useTranslation();
  const {
    nodes,
    edges,
    searchQuery,
    setSearchQuery,
    layoutMode,
    setLayoutMode,
    showOrphans,
    setShowOrphans,
    groupByFolder,
    setGroupByFolder,
    colorBy,
    setColorBy,
    localGraphOnly,
    setLocalGraphOnly,
    selectedNodeId,
  } = useGraphStore();

  const realNodesCount = nodes.filter((n) => !n.isGhost).length;
  const edgesCount = edges.length;

  return (
    <div className="absolute top-13 md:top-4 left-3 md:left-4 right-3 md:right-4 z-20 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none md:pt-safe">
      {/* Left Group: Search & Mode Filters */}
      <div className="flex items-center gap-1.5 sm:gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-gray-200/80 dark:border-zinc-800/80 shadow-lg pointer-events-auto">
        {/* Mobile Sidebar Button */}
        <button
          onClick={() => useUiStore.getState().setSidebarOpen(true)}
          className="md:hidden p-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer shrink-0"
          title={t('expandSidebar')}
        >
          <Menu size={16} />
        </button>

        {/* Search Box */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100/90 dark:bg-zinc-800/90 rounded-xl border border-gray-200/60 dark:border-zinc-700/60 text-xs w-36 sm:w-60 focus-within:ring-2 focus-within:ring-mac-accent/40 focus-within:border-mac-accent/50 transition-all">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder={t('mindmapSearchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent outline-none w-full text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs p-0.5"
            >
              ✕
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700" />

        {/* Layout Switcher */}
        <div className="flex items-center gap-1 bg-gray-100/70 dark:bg-zinc-800/70 p-0.5 rounded-xl">
          <button
            onClick={() => setLayoutMode('fcose')}
            className={cn(
              "p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer",
              layoutMode === 'fcose'
                ? "bg-white dark:bg-zinc-700 text-mac-accent shadow-xs font-semibold"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            )}
            title={t('mindmapForceNetwork')}
          >
            <Network size={14} />
            <span className="hidden md:inline text-[11px]">{t('mindmapForceNetwork')}</span>
          </button>
          <button
            onClick={() => setLayoutMode('breadthfirst')}
            className={cn(
              "p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer",
              layoutMode === 'breadthfirst'
                ? "bg-white dark:bg-zinc-700 text-mac-accent shadow-xs font-semibold"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            )}
            title={t('mindmapTree')}
          >
            <GitFork size={14} />
            <span className="hidden md:inline text-[11px]">{t('mindmapTree')}</span>
          </button>
          <button
            onClick={() => setLayoutMode('concentric')}
            className={cn(
              "p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer",
              layoutMode === 'concentric'
                ? "bg-white dark:bg-zinc-700 text-mac-accent shadow-xs font-semibold"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            )}
            title={t('mindmapRadial')}
          >
            <Radio size={14} />
            <span className="hidden md:inline text-[11px]">{t('mindmapRadial')}</span>
          </button>
          <button
            onClick={() => setLayoutMode('circle')}
            className={cn(
              "p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer",
              layoutMode === 'circle'
                ? "bg-white dark:bg-zinc-700 text-mac-accent shadow-xs font-semibold"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            )}
            title={t('mindmapCircle')}
          >
            <CircleDot size={14} />
          </button>
        </div>

        <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700" />

        {/* Orphans Toggle */}
        <button
          onClick={() => setShowOrphans(!showOrphans)}
          className={cn(
            "p-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer border",
            showOrphans
              ? "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-700"
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40"
          )}
          title={t('mindmapOrphanNotes')}
        >
          {showOrphans ? <Eye size={13} /> : <EyeOff size={13} />}
          <span className="text-[11px] font-medium hidden lg:inline">{t('mindmapOrphanNotes')}</span>
        </button>

        {/* Group By Folder Toggle */}
        <button
          onClick={() => setGroupByFolder(!groupByFolder)}
          className={cn(
            "p-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer border",
            groupByFolder
              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40 font-semibold"
              : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:text-gray-900 dark:hover:text-gray-200"
          )}
          title={t('mindmapFolderFrames')}
        >
          <FolderTree size={13} />
          <span className="text-[11px] font-medium hidden lg:inline">{t('mindmapFolderFrames')}</span>
        </button>

        {/* Color Scheme Picker */}
        <button
          onClick={() => {
            const next: GraphColorBy = colorBy === 'folder' ? 'tag' : colorBy === 'tag' ? 'connections' : 'folder';
            setColorBy(next);
          }}
          className="p-1.5 rounded-xl text-xs flex items-center gap-1 bg-gray-100/80 dark:bg-zinc-800/80 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-zinc-700/60 transition-all cursor-pointer"
          title={`${t('mindmapColorBy')}: ${colorBy === 'folder' ? t('mindmapColorFolder') : colorBy === 'tag' ? t('mindmapColorTag') : t('mindmapColorConnections')}`}
        >
          <Palette size={13} className="text-mac-accent" />
          <span className="text-[11px] font-medium capitalize hidden lg:inline">
            {colorBy === 'folder' ? t('mindmapColorFolder') : colorBy === 'tag' ? t('mindmapColorTag') : t('mindmapColorConnections')}
          </span>
        </button>

        {/* Local Graph Mode (Only available when a node is selected) */}
        {selectedNodeId && (
          <button
            onClick={() => setLocalGraphOnly(!localGraphOnly)}
            className={cn(
              "p-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer border",
              localGraphOnly
                ? "bg-mac-accent text-white border-mac-accent shadow-xs font-semibold"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:text-mac-accent"
            )}
            title={t('mindmapLocalNetwork')}
          >
            <Sparkles size={13} />
            <span className="text-[11px] hidden xl:inline">{t('mindmapLocalNetwork')}</span>
          </button>
        )}
      </div>

      {/* Right Group: Stats & Canvas Navigation Controls */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Stats Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-zinc-800/80 shadow-lg text-[11px] font-medium text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-1 text-mac-accent font-semibold">
            <Layers size={13} />
            {realNodesCount} {t('mindmapNotesCount')}
          </span>
          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-zinc-600" />
          <span className="text-purple-600 dark:text-purple-400 font-semibold">
            {edgesCount} {t('mindmapConnectionsCount')}
          </span>
        </div>

        {/* Zoom & Canvas Actions */}
        <div className="flex items-center gap-0.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-1 rounded-2xl border border-gray-200/80 dark:border-zinc-800/80 shadow-lg text-gray-700 dark:text-gray-300">
          <button
            onClick={onZoomIn}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            title={t('mindmapZoomIn')}
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={onZoomOut}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            title={t('mindmapZoomOut')}
          >
            <ZoomOut size={15} />
          </button>
          <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700 mx-0.5" />
          <button
            onClick={onFit}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            title={t('mindmapFit')}
          >
            <Maximize2 size={15} />
          </button>
          <button
            onClick={onResetLayout}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            title={t('mindmapResetLayout')}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

