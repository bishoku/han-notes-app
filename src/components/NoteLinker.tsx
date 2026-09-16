import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, Link2 } from 'lucide-react';
import { useNoteStore } from '@/store/noteStore';

interface NoteLinkerProps {
  values: string[];
  onChange: (notes: string[]) => void;
}

export const NoteLinker: React.FC<NoteLinkerProps> = ({ values, onChange }) => {
  const { t } = useTranslation();
  const notes = useNoteStore(s => s.notes);
  
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
    const clean = val.trim();
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

  const search = inputValue.toLowerCase().trim();
  const filteredNotes = notes.filter(n => 
    !values.includes(n.id) &&
    (n.id.toLowerCase().includes(search) || (n.title && n.title.toLowerCase().includes(search)))
  ).slice(0, 20);

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      <label className="font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
        <Link2 size={12} />
        {t('relatedNotes', 'Related Notes')}
      </label>

      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus-within:ring-2 focus-within:ring-mac-accent/40 min-h-[38px] transition-all">
        {values.map(val => (
          <span 
            key={val}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border animate-in fade-in zoom-in-95 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
          >
            <Link2 size={10} />
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
          placeholder={values.length === 0 ? t('searchNotes', 'Search notes...') : t('add', 'Add...')}
          className="flex-1 min-w-[90px] bg-transparent text-xs text-gray-800 dark:text-gray-200 focus:outline-none py-0.5"
        />
      </div>

      {isOpen && filteredNotes.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl shadow-xl z-50 max-h-44 overflow-y-auto p-1 text-xs animate-in fade-in slide-in-from-top-1">
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => addValue(note.id)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-mac-accent/10 hover:text-mac-accent text-left text-gray-700 dark:text-gray-300 font-medium transition-colors cursor-pointer"
            >
              <div className="flex flex-col truncate">
                <span className="truncate">{note.title || note.id}</span>
                {note.title && note.title !== note.id && (
                  <span className="text-[10px] text-gray-400 truncate">{note.id}</span>
                )}
              </div>
              <Check size={12} className="opacity-0 hover:opacity-100 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
