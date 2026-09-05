import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { EditorView } from '@codemirror/view';
import { SearchQuery, setSearchQuery, findNext, findPrevious } from '@codemirror/search';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MobileSearchPanelProps {
  view: EditorView | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MobileSearchPanel: React.FC<MobileSearchPanelProps> = ({
  view,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
      setMatchCount(0);
      setCurrentMatchIndex(0);
      if (view) {
        view.dispatch({
          effects: setSearchQuery.of(new SearchQuery({ search: '' })),
        });
      }
    }
  }, [isOpen, view]);

  // Debounced search query update to avoid CPU load
  useEffect(() => {
    if (!view || !isOpen) return;

    const timer = setTimeout(() => {
      const trimmed = searchTerm.trim();
      if (!trimmed) {
        setMatchCount(0);
        setCurrentMatchIndex(0);
        view.dispatch({
          effects: setSearchQuery.of(new SearchQuery({ search: '' })),
        });
        return;
      }

      const query = new SearchQuery({ search: trimmed, caseSensitive: false });
      view.dispatch({
        effects: setSearchQuery.of(query),
      });

      // Count matches
      let count = 0;
      let curIndex = 0;
      const cursor = query.getCursor(view.state);
      const head = view.state.selection.main.head;
      let step = cursor.next();

      while (!step.done) {
        count++;
        if (step.value.from <= head && step.value.to >= head) {
          curIndex = count;
        }
        step = cursor.next();
      }

      setMatchCount(count);
      setCurrentMatchIndex(curIndex > 0 ? curIndex : count > 0 ? 1 : 0);
    }, 120);

    return () => clearTimeout(timer);
  }, [searchTerm, view, isOpen]);

  const handleNext = useCallback(() => {
    if (!view) return;
    findNext(view);
    setCurrentMatchIndex((prev) => (matchCount > 0 ? (prev % matchCount) + 1 : 0));
  }, [view, matchCount]);

  const handlePrev = useCallback(() => {
    if (!view) return;
    findPrevious(view);
    setCurrentMatchIndex((prev) => (matchCount > 0 ? (prev - 2 + matchCount) % matchCount + 1 : 0));
  }, [view, matchCount]);

  if (!isOpen) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-gray-200/80 dark:border-zinc-800/80 shadow-md z-30 animate-in slide-in-from-top duration-150">
      <Search size={15} className="text-gray-400 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) handlePrev();
            else handleNext();
          } else if (e.key === 'Escape') {
            onClose();
          }
        }}
        placeholder={t('searchInNote', 'Notta ara...')}
        className="flex-1 min-w-0 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none"
      />

      {searchTerm.trim() && (
        <span className="text-xs text-gray-400 font-mono shrink-0 px-1">
          {matchCount > 0 ? `${currentMatchIndex}/${matchCount}` : '0/0'}
        </span>
      )}

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={handlePrev}
          disabled={matchCount === 0}
          className="p-1 rounded text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title={t('previous', 'Önceki')}
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={matchCount === 0}
          className="p-1 rounded text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title={t('next', 'Sonraki')}
        >
          <ChevronDown size={16} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors ml-1"
          title={t('close', 'Kapat')}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
