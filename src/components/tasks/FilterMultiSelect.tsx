import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterMultiSelectProps {
  label: string;
  icon?: React.ReactNode;
  selectedValues: string[];
  onChange: (newValues: string[]) => void;
  options: FilterOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  badgeStyle?: string;
  className?: string;
  align?: 'left' | 'right';
}

export const FilterMultiSelect: React.FC<FilterMultiSelectProps> = ({
  label,
  icon,
  selectedValues,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  badgeStyle = "bg-mac-accent/10 text-mac-accent border-mac-accent/20",
  className,
  align = 'left',
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(opt =>
      opt.label.toLowerCase().includes(q) || opt.id.toLowerCase().includes(q)
    );
  }, [options, searchQuery]);

  const toggleOption = (id: string) => {
    if (selectedValues.includes(id)) {
      onChange(selectedValues.filter(v => v !== id));
    } else {
      onChange([...selectedValues, id]);
    }
  };

  const clearAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange([]);
  };

  const selectedCount = selectedValues.length;

  return (
    <div className={cn("relative inline-block text-xs", className)} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer select-none",
          selectedCount > 0
            ? "border-mac-accent/40 bg-mac-accent/5 text-gray-900 dark:text-gray-100 shadow-2xs"
            : "border-gray-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-zinc-600",
          isOpen && "ring-2 ring-mac-accent/20 border-mac-accent"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
          <span className="font-semibold text-gray-700 dark:text-gray-200 shrink-0">{label}:</span>
          
          {selectedCount === 0 ? (
            <span className="text-gray-400 italic shrink-0">
              {placeholder || t('taskAll', 'Hepsi')}
            </span>
          ) : selectedCount === 1 ? (
            <span className={cn("px-1.5 py-0.2 rounded font-medium truncate max-w-[120px] text-[11px]", badgeStyle)}>
              {options.find(o => o.id === selectedValues[0])?.label || selectedValues[0]}
            </span>
          ) : (
            <span className={cn("px-1.5 py-0.2 rounded font-bold text-[10px]", badgeStyle)}>
              {selectedCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {selectedCount > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={clearAll}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') clearAll(); }}
              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              title={t('clearFilters', 'Temizle')}
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={13}
            className={cn(
              "text-gray-400 transition-transform duration-150",
              isOpen && "transform rotate-180 text-mac-accent"
            )}
          />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className={cn(
          "absolute top-full mt-1 w-64 max-w-[calc(100vw-24px)] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 flex flex-col gap-1.5",
          align === 'right' ? "right-0" : "left-0"
        )}>
          {/* Search bar */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder || `${label} ${t('search', 'ara')}...`}
              className="w-full bg-transparent text-xs text-gray-800 dark:text-gray-200 focus:outline-none placeholder-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Action Header */}
          <div className="flex items-center justify-between px-1 text-[11px] text-gray-400 border-b border-gray-100 dark:border-zinc-800 pb-1">
            <span>{filteredOptions.length} {t('options', 'seçenek')}</span>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-mac-accent hover:underline font-medium cursor-pointer"
              >
                {t('clearFilters', 'Temizle')} ({selectedCount})
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-400 italic">
                {t('noResultsFound', 'Sonuç bulunamadı')}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleOption(opt.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer text-xs group",
                      isSelected
                        ? "bg-mac-accent/10 text-mac-accent font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                          isSelected
                            ? "bg-mac-accent border-mac-accent text-white"
                            : "border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 group-hover:border-gray-400"
                        )}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                      <span className="truncate">{opt.label}</span>
                    </div>

                    {opt.count !== undefined && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full shrink-0 ml-1",
                        isSelected
                          ? "bg-mac-accent/20 text-mac-accent font-semibold"
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-400"
                      )}>
                        {opt.count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
