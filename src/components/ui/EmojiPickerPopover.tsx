/**
 * EmojiPickerPopover.tsx — Interactive, categorized and searchable emoji picker modal/popover.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EMOJI_CATEGORIES, EMOJI_LIST, searchEmojis } from '@/editor/emojiData';
import { Search, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  position?: { top: number; left: number };
}

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  position,
}) => {
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('frequent');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Filtered emojis
  const displayedEmojis = useMemo(() => {
    if (query.trim()) {
      return searchEmojis(query);
    }
    if (activeCategory === 'frequent') {
      return EMOJI_LIST.filter((e) => e.category === 'frequent');
    }
    return EMOJI_LIST.filter((e) => e.category === activeCategory);
  }, [query, activeCategory]);

  if (!isOpen) return null;

  const style: React.CSSProperties = position
    ? {
        position: 'fixed',
        top: Math.min(position.top, window.innerHeight - 340),
        left: Math.min(position.left, window.innerWidth - 320),
        zIndex: 60,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 60,
      };

  return (
    <div
      ref={containerRef}
      style={style}
      className="w-76 sm:w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200/80 dark:border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 select-none text-xs"
    >
      {/* 1. Header & Search Input */}
      <div className="p-2.5 border-b border-gray-100 dark:border-zinc-800 flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900 dark:text-gray-100">
            <Sparkles size={13} className="text-amber-500" />
            <span>{isEnglish ? 'Select Emoji' : 'Emoji Seç'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100/80 dark:bg-zinc-800/80 rounded-xl border border-gray-200/50 dark:border-zinc-700/50 focus-within:ring-2 focus-within:ring-mac-accent/30 focus-within:border-mac-accent transition-all">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isEnglish ? 'Search emoji or shortcode...' : 'Emoji veya etiket ara...'}
            className="w-full bg-transparent outline-none text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Category Tabs (if not searching) */}
      {!query.trim() && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 dark:border-zinc-800/60 overflow-x-auto scrollbar-none bg-gray-50/50 dark:bg-zinc-900/30 shrink-0">
          {EMOJI_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 shrink-0 transition-all cursor-pointer",
                  isSelected
                    ? "bg-mac-accent text-white shadow-2xs"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-zinc-800"
                )}
                title={isEnglish ? cat.nameEn : cat.nameTr}
              >
                <span>{cat.icon}</span>
                <span className="text-[10px]">{isEnglish ? cat.nameEn : cat.nameTr}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Emoji Grid */}
      <div className="p-2.5 max-h-56 overflow-y-auto grid grid-cols-7 sm:grid-cols-8 gap-1 scroll-smooth">
        {displayedEmojis.length === 0 ? (
          <div className="col-span-full py-6 text-center text-[11px] text-gray-400">
            {isEnglish ? 'No matching emoji found' : 'Eşleşen emoji bulunamadı'}
          </div>
        ) : (
          displayedEmojis.map((item) => (
            <button
              key={item.shortcode}
              type="button"
              onClick={() => {
                onSelectEmoji(item.emoji);
                onClose();
              }}
              title={`${item.name} (:${item.shortcode}:)`}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-zinc-800 hover:scale-115 active:scale-95 transition-all cursor-pointer"
            >
              {item.emoji}
            </button>
          ))
        )}
      </div>

      {/* 4. Footer Shortcode Hint */}
      <div className="p-2 border-t border-gray-100 dark:border-zinc-800 text-[10px] text-gray-400 flex items-center justify-between px-3 bg-gray-50/50 dark:bg-zinc-900/50">
        <span>{isEnglish ? 'Tip: Type `:rocket` in note' : 'İpucu: Notta `:roket` yazabilirsiniz'}</span>
        <span className="font-mono">:shortcode:</span>
      </div>
    </div>
  );
};
