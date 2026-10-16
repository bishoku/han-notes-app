/**
 * QuickSearchModal.tsx — Spotlight & Raycast style Command Palette and Hybrid Search Modal.
 * Integrates instant 0ms in-memory keyword matching with debounced local ONNX vector search.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Sparkles,
  FileText,
  CheckSquare,
  ShieldCheck,
  Tag,
  X,
  ExternalLink,
  ChevronRight,
  Plus,
  Network,
  Settings,
  Palette,
  GitBranch,
  Command,
} from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';
import { useGitStore } from '@/store/gitStore';
import { showToast } from '@/store/toastStore';
import {
  hybridSearchService,
  type SearchMatchItem,
  type SearchFilterType,
} from '@/services/search/hybridSearchService';

interface CommandActionItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  keywords: string[];
  onExecute: () => void | Promise<void>;
}

export const QuickSearchModal: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Granular Zustand selectors to prevent unnecessary modal re-renders
  const isSearchModalOpen = useUiStore((s) => s.isSearchModalOpen);
  const setSearchModalOpen = useUiStore((s) => s.setSearchModalOpen);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const setSettingsModalOpen = useUiStore((s) => s.setSettingsModalOpen);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const selectNote = useNoteStore((s) => s.selectNote);
  const notes = useNoteStore((s) => s.notes);

  const [inputQuery, setInputQuery] = useState(searchQuery || '');
  const [activeFilter, setActiveFilter] = useState<SearchFilterType>('all');
  const [results, setResults] = useState<SearchMatchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSemanticLoading, setIsSemanticLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const quickCommands = useMemo<CommandActionItem[]>(() => [
    {
      id: 'cmd_new_note',
      label: t('createNewNote', 'Yeni Not Oluştur'),
      shortcut: '⌘N',
      icon: <Plus size={13} />,
      keywords: ['new', 'note', 'yeni', 'not', 'create', 'oluştur'],
      onExecute: async () => {
        const { activeFolderPath, notes: allNotes, createNote } = useNoteStore.getState();
        const baseTitle = t('untitledNote', 'Yeni Not');
        let candidate = baseTitle;
        let counter = 1;
        const existingTitles = new Set(
          allNotes.map((n) => (n.id.split('/').pop() || n.id).replace(/\.md$/i, '').toLowerCase())
        );
        while (existingTitles.has(candidate.toLowerCase())) {
          counter += 1;
          candidate = `${baseTitle} ${counter}`;
        }
        const newNoteId = await createNote(candidate, activeFolderPath || undefined);
        setSearchModalOpen(false);
        if (newNoteId) {
          setViewMode('notes');
          navigate(`/notes/${encodeURIComponent(newNoteId)}`);
          showToast(t('newNoteCreated', 'Yeni not oluşturuldu'), {
            description: candidate,
            type: 'success',
          });
        }
      },
    },
    {
      id: 'cmd_tasks',
      label: t('tasks', 'Görevler Görünümü'),
      icon: <CheckSquare size={13} />,
      keywords: ['tasks', 'görevler', 'gantt', 'todo'],
      onExecute: () => {
        setViewMode('tasks');
        navigate('/tasks');
        setSearchModalOpen(false);
      },
    },
    {
      id: 'cmd_decisions',
      label: t('decisions', 'Kararlar Görünümü'),
      icon: <ShieldCheck size={13} />,
      keywords: ['decisions', 'kararlar', 'adr'],
      onExecute: () => {
        setViewMode('decisions');
        navigate('/decisions');
        setSearchModalOpen(false);
      },
    },
    {
      id: 'cmd_mindmap',
      label: t('mindmap', 'Zihin Haritası Görünümü'),
      icon: <Network size={13} />,
      keywords: ['mindmap', 'graph', 'zihin', 'harita'],
      onExecute: () => {
        setViewMode('mindmap');
        navigate('/mindmap');
        setSearchModalOpen(false);
      },
    },
    {
      id: 'cmd_theme',
      label: t('toggleTheme', 'Temayı Değiştir'),
      icon: <Palette size={13} />,
      keywords: ['theme', 'dark', 'light', 'tema', 'görünüm'],
      onExecute: () => {
        const themes = ['light', 'dark', 'nord', 'dracula', 'synthwave', 'retro'] as const;
        const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length];
        setTheme(nextTheme);
        setSearchModalOpen(false);
        showToast(`${t('theme', 'Tema')}: ${nextTheme.toUpperCase()}`, {
          type: 'info',
          duration: 1800,
        });
      },
    },
    {
      id: 'cmd_snapshot',
      label: t('createSnapshotNow', 'Anlık Görüntü (Snapshot) Oluştur'),
      shortcut: '⌘S',
      icon: <GitBranch size={13} />,
      keywords: ['git', 'snapshot', 'commit', 'yedek', 'kaydet'],
      onExecute: async () => {
        const currentNoteId = useNoteStore.getState().currentNoteId;
        const title = currentNoteId?.split('/').pop() || 'Manuel snapshot';
        await useGitStore.getState().createSnapshot(`Manuel snapshot: ${title}`);
        setSearchModalOpen(false);
        showToast(t('snapshotCreated', 'Anlık görüntü kaydedildi'), {
          description: title,
          type: 'success',
        });
      },
    },
    {
      id: 'cmd_settings',
      label: t('settings', 'Ayarlar'),
      shortcut: '⌘,',
      icon: <Settings size={13} />,
      keywords: ['settings', 'ayarlar', 'preferences'],
      onExecute: () => {
        setSearchModalOpen(false);
        setSettingsModalOpen(true);
      },
    },
  ], [t, navigate, setSearchModalOpen, setViewMode, setSettingsModalOpen, theme, setTheme]);

  const matchingCommands = useMemo(() => {
    if (activeFilter !== 'all') return [];
    const raw = inputQuery.trim();
    if (!raw) return quickCommands.slice(0, 4);
    const isCommandMode = raw.startsWith('>');
    const q = (isCommandMode ? raw.slice(1) : raw).trim().toLowerCase();
    if (!q) return quickCommands;
    return quickCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.keywords.some((kw) => kw.includes(q))
    );
  }, [inputQuery, activeFilter, quickCommands]);

  // Sync state when modal is opened
  useEffect(() => {
    if (isSearchModalOpen) {
      setInputQuery(searchQuery || '');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSearchModalOpen, searchQuery]);

  // Progressive Two-Stage Hybrid Search (0ms instant keyword + 200ms debounced vector search)
  useEffect(() => {
    if (!isSearchModalOpen) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmed = inputQuery.trim();
    if (trimmed.startsWith('>')) {
      setResults([]);
      setSelectedIndex(0);
      setIsSemanticLoading(false);
      return;
    }

    if (!trimmed) {
      // Default: show recent notes
      const recentMatches: SearchMatchItem[] = notes.slice(0, 10).map((n) => ({
        id: `recent_${n.id}`,
        noteId: n.id,
        title: n.title || n.id.split('/').pop() || n.id,
        path: n.id,
        snippet: n.title,
        matchType: 'title',
        matchedKeywords: [],
        tags: n.tags || [],
        score: 10,
      }));
      setResults(recentMatches);
      setSelectedIndex(0);
      setIsSemanticLoading(false);
      return;
    }

    // Stage 1: Instant 0ms keyword match
    const instantHits = hybridSearchService.searchKeywordOnly(trimmed, activeFilter);
    setResults(instantHits);
    setSelectedIndex(0);

    // Stage 2: Debounced ONNX vector search (only if query is 3+ chars)
    if (trimmed.length < 3 || activeFilter === 'tasks' || activeFilter === 'decisions' || activeFilter === 'tags') {
      setIsSemanticLoading(false);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const timer = setTimeout(async () => {
      setIsSemanticLoading(true);
      try {
        const { results: searchHits, isSemanticDone } = await hybridSearchService.search(
          trimmed,
          activeFilter,
          abortController.signal
        );
        if (!abortController.signal.aborted) {
          setResults(searchHits);
          setIsSemanticLoading(!isSemanticDone);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Search execution failed:', err);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsSemanticLoading(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [inputQuery, activeFilter, isSearchModalOpen, notes]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, results]);

  if (!isSearchModalOpen) return null;

  const handleClose = () => {
    setSearchModalOpen(false);
  };

  const handleSelectNote = (item: SearchMatchItem) => {
    selectNote(item.noteId);
    setViewMode('notes');
    navigate(`/notes/${encodeURIComponent(item.noteId)}`);
    setSearchModalOpen(false);
  };

  const handleOpenFullSearchView = () => {
    setSearchQuery(inputQuery);
    setViewMode('search');
    navigate('/search');
    setSearchModalOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (inputQuery.trim().startsWith('>') && matchingCommands[0]) {
        matchingCommands[0].onExecute();
      } else if (e.metaKey || e.ctrlKey || (results.length === 0 && inputQuery.trim() && matchingCommands.length === 0)) {
        handleOpenFullSearchView();
      } else if (results[selectedIndex]) {
        handleSelectNote(results[selectedIndex]);
      } else if (matchingCommands[0]) {
        matchingCommands[0].onExecute();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  const filterTabs: { id: SearchFilterType; label: string }[] = [
    { id: 'all', label: t('searchFilterAll') },
    { id: 'semantic', label: t('searchFilterSemantic') },
    { id: 'notes', label: t('searchFilterNotes') },
    { id: 'tasks', label: t('searchFilterTasks') },
    { id: 'decisions', label: t('searchFilterDecisions') },
    { id: 'tags', label: t('searchFilterTags') },
  ];

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-2 sm:pt-24 p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none pt-safe"
    >
      <div className="w-full max-w-2xl max-h-[88vh] bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-xs">
        {/* 1. Search Header Input */}
        <div className="p-3 sm:p-3.5 px-3.5 sm:px-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-2.5 sm:gap-3">
          <div className="text-gray-400 dark:text-gray-500 shrink-0">
            {isSemanticLoading ? (
              <Sparkles size={18} className="text-purple-500 animate-pulse" />
            ) : (
              <Search size={18} />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('searchPlaceholder')}
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 py-1"
          />

          {inputQuery && (
            <button
              onClick={() => {
                setInputQuery('');
                inputRef.current?.focus();
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer shrink-0"
              title={t('clear')}
            >
              <X size={15} />
            </button>
          )}

          {/* Explicit Mobile Dismiss Button */}
          <button
            onClick={handleClose}
            className="sm:hidden px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 bg-gray-100 dark:bg-zinc-800 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            {t('cancel') || 'Kapat'}
          </button>
        </div>

        {/* 2. Filter Pills Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 dark:border-zinc-800/60 bg-gray-50/60 dark:bg-zinc-950/40 overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer shrink-0 ${
                activeFilter === tab.id
                  ? 'bg-mac-accent text-white shadow-2xs'
                  : 'bg-gray-200/60 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300/60 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 3. Quick Commands & Results List */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2 space-y-1 select-text">
          {matchingCommands.length > 0 && (
            <div className="mb-2 pb-1.5 border-b border-gray-100 dark:border-zinc-800/70">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <Command size={10} />
                <span>{t('quickActions', 'Hızlı İşlemler')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {matchingCommands.map((cmd) => (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => cmd.onExecute()}
                    className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-purple-500/10 dark:hover:bg-purple-500/15 text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        {cmd.icon}
                      </span>
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                        {cmd.label}
                      </span>
                    </div>
                    {cmd.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-[10px] font-mono text-gray-400 shrink-0">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.length === 0 && !inputQuery.trim().startsWith('>') ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400 mb-2">
                <Search size={18} />
              </div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('searchNoResults')}
              </p>
              <p className="text-[11px] text-gray-400 max-w-sm mt-1">
                {t('searchNoResultsDesc')}
              </p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const hasSimilarity = typeof item.similarityScore === 'number';
              const similarityPercent = hasSimilarity
                ? Math.round(item.similarityScore! * 100)
                : null;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectNote(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/30'
                      : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          item.matchType === 'task'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : item.matchType === 'decision'
                            ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                            : item.matchType === 'tag'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : hasSimilarity
                            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                            : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {item.matchType === 'task' ? (
                          <CheckSquare size={13} />
                        ) : item.matchType === 'decision' ? (
                          <ShieldCheck size={13} />
                        ) : item.matchType === 'tag' ? (
                          <Tag size={13} />
                        ) : hasSimilarity ? (
                          <Sparkles size={13} />
                        ) : (
                          <FileText size={13} />
                        )}
                      </div>

                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate">
                        {item.title}
                      </span>

                      {item.heading && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-0.5">
                          <ChevronRight size={10} className="shrink-0" />
                          {item.heading}
                        </span>
                      )}
                    </div>

                    {/* Similarity / Match Score Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {similarityPercent !== null && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                            similarityPercent >= 80
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : similarityPercent >= 60
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          <Sparkles size={9} />
                          %{similarityPercent}
                        </span>
                      )}

                      <span className="text-[10px] text-gray-400 font-mono hidden sm:inline truncate max-w-[120px]">
                        {item.path}
                      </span>
                    </div>
                  </div>

                  {/* Snippet */}
                  {item.snippet && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 pl-8 leading-relaxed">
                      {item.snippet}
                    </p>
                  )}

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-8 mt-0.5">
                      {item.tags.slice(0, 3).map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[9px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400"
                        >
                          #{tag.replace(/^#/, '')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 4. Footer & Keyboard Navigation Legend */}
        <div className="p-2.5 px-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-950/60 flex items-center justify-between text-[11px] text-gray-400">
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-gray-200 dark:bg-zinc-800 font-mono text-[9px]">
                ↑
              </span>
              <span className="px-1 py-0.5 rounded bg-gray-200 dark:bg-zinc-800 font-mono text-[9px]">
                ↓
              </span>
              <span>{t('searchHintNav')}</span>
            </span>

            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-zinc-800 font-mono text-[9px]">
                ↵
              </span>
              <span>{t('searchHintOpen')}</span>
            </span>

            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-zinc-800 font-mono text-[9px]">
                esc
              </span>
              <span>{t('searchHintEsc')}</span>
            </span>
          </div>

          <button
            onClick={handleOpenFullSearchView}
            className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
          >
            <span>{t('searchHintFull')}</span>
            <ExternalLink size={11} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
