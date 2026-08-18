import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Sparkles,
  FileText,
  CheckSquare,
  ShieldCheck,
  Tag,
  Folder,
  ArrowRight,
  SlidersHorizontal,
  X,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';
import { storage } from '@/services/storage';
import {
  hybridSearchService,
  type SearchMatchItem,
  type SearchFilterType,
} from '@/services/search/hybridSearchService';
import { MarkdownMessage } from '@/components/ai/MarkdownMessage';

export const SearchView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery, setViewMode } = useUiStore();
  const { selectNote, notes } = useNoteStore();

  const [inputQuery, setInputQuery] = useState(searchQuery || '');
  const [filterType, setFilterType] = useState<SearchFilterType>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [results, setResults] = useState<SearchMatchItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchMatchItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSemanticLoading, setIsSemanticLoading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Extract unique folders and tags for faceted filtering
  const allFolders = useMemo(() => {
    const folders = new Set<string>();
    for (const n of notes) {
      if (n.id.includes('/')) {
        const parts = n.id.split('/');
        parts.pop();
        folders.add(parts.join('/'));
      }
    }
    return Array.from(folders).sort();
  }, [notes]);

  const allTags = useMemo(() => {
    const tagCount = new Map<string, number>();
    for (const n of notes) {
      for (const t of n.tags || []) {
        const clean = t.replace(/^#/, '');
        tagCount.set(clean, (tagCount.get(clean) || 0) + 1);
      }
    }
    return Array.from(tagCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }, [notes]);

  // Execute hybrid search
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmed = inputQuery.trim();
    if (!trimmed) {
      // Default: list all notes
      const initialMatches: SearchMatchItem[] = notes.map((n) => ({
        id: `init_${n.id}`,
        noteId: n.id,
        title: n.title || n.id.split('/').pop() || n.id,
        path: n.id,
        snippet: n.title,
        matchType: 'title',
        matchedKeywords: [],
        tags: n.tags || [],
        score: 10,
      }));
      setResults(initialMatches);
      if (initialMatches.length > 0) setSelectedItem(initialMatches[0]);
      setIsSemanticLoading(false);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsSemanticLoading(true);

    const timer = setTimeout(async () => {
      try {
        const { results: searchHits, isSemanticDone } = await hybridSearchService.search(
          trimmed,
          filterType,
          abortController.signal
        );
        if (!abortController.signal.aborted) {
          setResults(searchHits);
          if (searchHits.length > 0) {
            setSelectedItem(searchHits[0]);
          } else {
            setSelectedItem(null);
          }
          setIsSemanticLoading(!isSemanticDone);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Search error in SearchView:', err);
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [inputQuery, filterType, notes]);

  // Load preview content when selected item changes
  useEffect(() => {
    if (!selectedItem) {
      setPreviewContent('');
      return;
    }

    let isMounted = true;
    setIsLoadingPreview(true);

    storage
      .readNote(selectedItem.noteId)
      .then((content) => {
        if (isMounted) {
          setPreviewContent(content);
          setIsLoadingPreview(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setPreviewContent(`Not içeriği yüklenemedi: ${err.message}`);
          setIsLoadingPreview(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedItem]);

  // Apply folder & tag facet filters
  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      if (selectedFolder && !item.path.startsWith(selectedFolder)) {
        return false;
      }
      if (selectedTag) {
        const itemTags = item.tags.map((t) => t.replace(/^#/, ''));
        if (!itemTags.includes(selectedTag)) return false;
      }
      return true;
    });
  }, [results, selectedFolder, selectedTag]);

  const handleOpenNote = (item: SearchMatchItem) => {
    selectNote(item.noteId);
    setViewMode('notes');
    navigate(`/notes/${encodeURIComponent(item.noteId)}`);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-mac-mainLight dark:bg-mac-mainDark select-none">
      {/* 1. Search Header Bar */}
      <div className="p-4 px-6 border-b border-mac-borderLight dark:border-mac-borderDark bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Search size={16} />
            </div>
            <div>
              <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                {t('searchViewTitle')}
              </h2>
              <span className="text-[11px] text-gray-400">
                {t('searchResultsCount', { count: filteredResults.length })}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setViewMode('notes');
              navigate('/notes');
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Big Search Input */}
        <div className="flex items-center gap-2.5 p-2 px-3 rounded-xl bg-gray-100/90 dark:bg-zinc-800/90 border border-gray-200/80 dark:border-zinc-700/80 focus-within:ring-2 focus-within:ring-purple-500/30 focus-within:border-purple-500 transition-all">
          <div className="text-gray-400 dark:text-gray-500">
            {isSemanticLoading ? (
              <Sparkles size={16} className="text-purple-500 animate-pulse" />
            ) : (
              <Search size={16} />
            )}
          </div>

          <input
            type="text"
            value={inputQuery}
            onChange={(e) => {
              setInputQuery(e.target.value);
              setSearchQuery(e.target.value);
            }}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-transparent outline-none text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 py-0.5"
            autoFocus
          />

          {inputQuery && (
            <button
              onClick={() => {
                setInputQuery('');
                setSearchQuery('');
              }}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Type Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all' as SearchFilterType, label: t('searchFilterAll') },
            { id: 'semantic' as SearchFilterType, label: t('searchFilterSemantic') },
            { id: 'notes' as SearchFilterType, label: t('searchFilterNotes') },
            { id: 'tasks' as SearchFilterType, label: t('searchFilterTasks') },
            { id: 'decisions' as SearchFilterType, label: t('searchFilterDecisions') },
            { id: 'tags' as SearchFilterType, label: t('searchFilterTags') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 ${
                filterType === tab.id
                  ? 'bg-mac-accent text-white shadow-2xs'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Workspace Body: Filters Sidebar + Results List + Live Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Facet Filters Sidebar */}
        <div className="w-56 p-4 border-r border-mac-borderLight dark:border-mac-borderDark overflow-y-auto hidden md:flex flex-col gap-4 text-xs">
          <div className="flex items-center justify-between font-bold text-gray-500 uppercase tracking-wider text-[10px]">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal size={11} />
              {t('searchFilterFolders')}
            </span>
            {selectedFolder && (
              <button
                onClick={() => setSelectedFolder(null)}
                className="text-purple-600 hover:underline cursor-pointer lowercase"
              >
                sıfırla
              </button>
            )}
          </div>

          <div className="space-y-1">
            {allFolders.length === 0 ? (
              <span className="text-[11px] text-gray-400 italic">Alt klasör yok</span>
            ) : (
              allFolders.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFolder(selectedFolder === f ? null : f)}
                  className={`w-full text-left p-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer truncate ${
                    selectedFolder === f
                      ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Folder size={12} className="shrink-0" />
                  <span className="truncate">{f}</span>
                </button>
              ))
            )}
          </div>

          {/* Tags Facet */}
          <div className="flex items-center justify-between font-bold text-gray-500 uppercase tracking-wider text-[10px] pt-2 border-t border-gray-200/50 dark:border-zinc-800">
            <span className="flex items-center gap-1.5">
              <Tag size={11} />
              {t('tags')}
            </span>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="text-purple-600 hover:underline cursor-pointer lowercase"
              >
                sıfırla
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {allTags.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  selectedTag === tag
                    ? 'bg-mac-accent text-white'
                    : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                <span>#{tag}</span>
                <span className="text-[9px] opacity-70">({count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Center Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 select-text border-r border-mac-borderLight dark:border-mac-borderDark">
          {filteredResults.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400 mb-3">
                <Search size={22} />
              </div>
              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-1">
                {t('searchNoResults')}
              </h4>
              <p className="text-xs text-gray-400 max-w-sm">
                {t('searchNoResultsDesc')}
              </p>
            </div>
          ) : (
            filteredResults.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const hasSimilarity = typeof item.similarityScore === 'number';
              const similarityPercent = hasSimilarity
                ? Math.round(item.similarityScore! * 100)
                : null;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  onDoubleClick={() => handleOpenNote(item)}
                  className={`p-3.5 rounded-2xl transition-all cursor-pointer flex flex-col gap-1.5 border ${
                    isSelected
                      ? 'bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/40 shadow-xs'
                      : 'bg-white/70 dark:bg-zinc-900/70 hover:bg-gray-50 dark:hover:bg-zinc-800/80 border-gray-200/60 dark:border-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
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
                          <CheckSquare size={14} />
                        ) : item.matchType === 'decision' ? (
                          <ShieldCheck size={14} />
                        ) : item.matchType === 'tag' ? (
                          <Tag size={14} />
                        ) : hasSimilarity ? (
                          <Sparkles size={14} />
                        ) : (
                          <FileText size={14} />
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono truncate">
                          {item.path}
                        </span>
                      </div>
                    </div>

                    {/* Similarity Badge & Open Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      {similarityPercent !== null && (
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                            similarityPercent >= 80
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : similarityPercent >= 60
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          <Sparkles size={10} />
                          %{similarityPercent}
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenNote(item);
                        }}
                        className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-mac-accent hover:text-white text-gray-500 transition-colors cursor-pointer"
                        title={t('searchHintOpen')}
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>

                  {item.heading && (
                    <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1 pl-9">
                      <ChevronRight size={11} className="shrink-0" />
                      <span>{item.heading}</span>
                    </div>
                  )}

                  {/* Snippet */}
                  {item.snippet && (
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 pl-9 line-clamp-2 leading-relaxed">
                      {item.snippet}
                    </p>
                  )}

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-9 mt-0.5">
                      {item.tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 font-medium"
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

        {/* Right Live Preview Panel */}
        <div className="w-[45%] p-4 overflow-y-auto hidden lg:flex flex-col gap-3 bg-white/40 dark:bg-zinc-950/40 select-text">
          {selectedItem ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-mac-borderLight dark:border-mac-borderDark">
                <div className="flex flex-col min-w-0">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {selectedItem.title}
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono truncate">
                    {selectedItem.path}
                  </span>
                </div>

                <button
                  onClick={() => handleOpenNote(selectedItem)}
                  className="px-3 py-1.5 rounded-xl bg-mac-accent hover:opacity-90 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <span>{t('searchHintOpen')}</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Note Rendered Preview */}
              <div className="flex-1 overflow-y-auto pr-1">
                {isLoadingPreview ? (
                  <div className="py-12 flex justify-center text-gray-400">
                    <span className="text-xs">Yükleniyor...</span>
                  </div>
                ) : (
                  <MarkdownMessage content={previewContent} />
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
              <FileText size={24} className="mb-2 opacity-50" />
              <p className="text-xs">{t('searchPreviewPrompt')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
