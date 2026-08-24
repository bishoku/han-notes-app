import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiBadgeSelectProps {
  label: string;
  icon?: React.ReactNode;
  values: string[];
  onChange: (newValues: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  badgeStyle?: string;
}

export const MultiBadgeSelect: React.FC<MultiBadgeSelectProps> = ({
  label,
  icon,
  values,
  onChange,
  suggestions,
  placeholder,
  badgeStyle = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const addValue = (val: string) => {
    const clean = val.trim().replace(/^#/, '');
    if (clean && !values.includes(clean)) {
      onChange([...values, clean]);
    }
    setInputValue('');
    setIsOpen(false);
  };

  const removeValue = (valToRemove: string) => {
    onChange(values.filter(v => v !== valToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addValue(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
      removeValue(values[values.length - 1]);
    }
  };

  // Filter suggestions based on typed input and exclude already selected items
  const filteredSuggestions = suggestions.filter(s => 
    !values.includes(s) && 
    s.toLowerCase().includes(inputValue.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      {Boolean(label && label.trim().length > 0) && (
        <label className="font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
          {icon}
          {label}
        </label>
      )}

      {/* Input container with inline pill badges */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus-within:ring-2 focus-within:ring-mac-accent/40 min-h-[38px] transition-all">
        {values.map(val => (
          <span 
            key={val}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border animate-in fade-in zoom-in-95",
              badgeStyle
            )}
          >
            <span>{val}</span>
            <button
              type="button"
              onClick={() => removeValue(val)}
              className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X size={11} />
            </button>
          </span>
        ))}

        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? (placeholder || `${t('add')}...`) : `${t('add')}...`}
          className="flex-1 min-w-[90px] bg-transparent text-xs text-gray-800 dark:text-gray-200 focus:outline-none py-0.5"
        />
      </div>

      {/* Autocomplete Dropdown List */}
      {isOpen && (filteredSuggestions.length > 0 || (inputValue.trim() && !suggestions.includes(inputValue.trim()))) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl shadow-xl z-50 max-h-44 overflow-y-auto p-1 text-xs animate-in fade-in slide-in-from-top-1">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addValue(suggestion)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-mac-accent/10 hover:text-mac-accent text-left text-gray-700 dark:text-gray-300 font-medium transition-colors cursor-pointer"
            >
              <span>{suggestion}</span>
              <Check size={12} className="opacity-0 hover:opacity-100" />
            </button>
          ))}

          {/* Option to create a new custom item if typed string is not in suggestions */}
          {inputValue.trim() && !suggestions.includes(inputValue.trim()) && !values.includes(inputValue.trim()) && (
            <button
              type="button"
              onClick={() => addValue(inputValue)}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-mac-accent/10 text-mac-accent text-left font-semibold hover:bg-mac-accent hover:text-white transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>{t('createNew')}: "{inputValue.trim()}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
