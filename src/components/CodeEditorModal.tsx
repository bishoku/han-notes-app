import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { useTranslation } from 'react-i18next';
import {
  X,
  Check,
  Copy,
  Code2,
  Search,
  ChevronDown,
  WrapText,
} from 'lucide-react';

import { useUiStore } from '@/store/uiStore';
import { hanHighlightStyle, hanHighlightStyleDark } from '@/editor/hanHighlightStyle';
import { POPULAR_LANGUAGES } from '@/editor/code/codeLanguages';
import { cn } from '@/lib/utils';

export interface CodeSavePayload {
  code: string;
  lang: string;
  from?: number;
  to?: number;
}

interface CodeEditorModalProps {
  isOpen: boolean;
  initialCode?: string;
  initialLang?: string;
  from?: number;
  to?: number;
  onClose: () => void;
  onSave: (payload: CodeSavePayload) => void;
}

export const CodeEditorModal: React.FC<CodeEditorModalProps> = ({
  isOpen,
  initialCode = '',
  initialLang = 'typescript',
  from,
  to,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = ['dark', 'dracula', 'synthwave'].includes(theme);

  const [code, setCode] = useState<string>(initialCode);
  const [selectedLang, setSelectedLang] = useState<string>(initialLang || 'typescript');
  const [langExtension, setLangExtension] = useState<any[]>([]);
  const [showLangDropdown, setShowLangDropdown] = useState<boolean>(false);
  const [langSearch, setLangSearch] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [lineWrap, setLineWrap] = useState<boolean>(true);
  const [stats, setStats] = useState<{ lines: number; chars: number; cursor: { line: number; col: number } }>({
    lines: 1,
    chars: 0,
    cursor: { line: 1, col: 1 },
  });

  const editorViewRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isEditing = from !== undefined && to !== undefined;

  // Sync initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCode(initialCode);
      const cleanLang = (initialLang || 'typescript').toLowerCase().trim();
      setSelectedLang(cleanLang || 'typescript');
      setShowLangDropdown(false);
      setLangSearch('');
    }
  }, [isOpen, initialCode, initialLang]);

  // Click outside listener for language dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowLangDropdown(false);
      }
    };
    if (showLangDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLangDropdown]);

  // Lazy-load active language parser from @codemirror/language-data
  useEffect(() => {
    let isMounted = true;
    const cleanLang = selectedLang.toLowerCase().trim();

    const langDesc = languages.find(
      (l) =>
        l.name.toLowerCase() === cleanLang ||
        l.alias.some((a) => a.toLowerCase() === cleanLang) ||
        l.extensions.some((ext) => ext.toLowerCase() === cleanLang)
    );

    if (langDesc) {
      langDesc.load().then((ext) => {
        if (isMounted) {
          setLangExtension([ext]);
        }
      }).catch((err) => {
        console.warn(`Failed to load CodeMirror parser for ${cleanLang}:`, err);
        if (isMounted) setLangExtension([]);
      });
    } else {
      setLangExtension([]);
    }

    return () => {
      isMounted = false;
    };
  }, [selectedLang]);

  // Update cursor & content stats
  const handleEditorUpdate = useCallback((viewUpdate: any) => {
    const view = viewUpdate.view;
    const doc = view.state.doc;
    const sel = view.state.selection.main;
    const line = doc.lineAt(sel.head);
    setStats({
      lines: doc.lines,
      chars: doc.length,
      cursor: {
        line: line.number,
        col: sel.head - line.from + 1,
      },
    });
  }, []);

  // Keyboard Shortcuts (Cmd+Enter to save, Esc to close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showLangDropdown) {
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleSave = () => {
    onSave({
      code,
      lang: selectedLang === 'plaintext' ? '' : selectedLang,
      from,
      to,
    });
    onClose();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const activeLangConfig = useMemo(() => {
    const match = POPULAR_LANGUAGES.find(
      (l) => l.id === selectedLang.toLowerCase() || l.name.toLowerCase() === selectedLang.toLowerCase()
    );
    return match || { id: selectedLang, name: selectedLang, abbr: '</>', color: '#6366f1' };
  }, [selectedLang]);

  const filteredLanguages = useMemo(() => {
    const query = langSearch.toLowerCase().trim();
    if (!query) return POPULAR_LANGUAGES;
    return POPULAR_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(query) ||
        l.id.toLowerCase().includes(query) ||
        l.abbr.toLowerCase().includes(query)
    );
  }, [langSearch]);

  const editorExtensions = useMemo(() => {
    const activeHighlight = isDark ? hanHighlightStyleDark : hanHighlightStyle;
    const exts = [
      syntaxHighlighting(activeHighlight),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ...langExtension,
    ];
    if (lineWrap) {
      exts.push(EditorView.lineWrapping);
    }
    return exts;
  }, [isDark, langExtension, lineWrap]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1100px] h-full sm:h-[86vh] max-h-none sm:max-h-[860px] bg-white dark:bg-[#131418] rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div className="pt-safe flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 bg-gray-50/95 dark:bg-[#18191f]/95 border-b border-gray-200 dark:border-zinc-800 shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center border shadow-xs shrink-0"
              style={{
                backgroundColor: `${activeLangConfig.color}15`,
                borderColor: `${activeLangConfig.color}30`,
                color: activeLangConfig.color,
              }}
            >
              <Code2 size={17} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-zinc-100 flex items-center gap-1.5 truncate">
                <span className="truncate">{t('codeEditorTitle', 'Kod Editörü')}</span>
                <span className="hidden sm:inline-block text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40 shrink-0">
                  {isEditing ? t('edit', 'Düzenle') : t('newCodeBlock', 'Yeni Kod')}
                </span>
              </h2>
            </div>
          </div>

          {/* Controls: Language Dropdown + Line Wrap + Close */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Language Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeLangConfig.color }}
                />
                <span>{activeLangConfig.name}</span>
                <ChevronDown size={13} className="text-gray-400" />
              </button>

              {showLangDropdown && (
                <div className="absolute top-10 right-0 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1.5 bg-gray-100 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs">
                    <Search size={13} className="text-gray-400 shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      placeholder={t('searchLanguage', 'Dil ara...')}
                      className="w-full bg-transparent focus:outline-none text-gray-800 dark:text-gray-200 text-xs placeholder:text-gray-400"
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {filteredLanguages.map((lang) => (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => {
                          setSelectedLang(lang.id);
                          setShowLangDropdown(false);
                          if (editorViewRef.current) {
                            editorViewRef.current.focus();
                          }
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-lg transition-colors cursor-pointer",
                          selectedLang.toLowerCase() === lang.id.toLowerCase()
                            ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                            style={{
                              backgroundColor: `${lang.color}15`,
                              borderColor: `${lang.color}30`,
                              color: lang.color,
                            }}
                          >
                            {lang.abbr}
                          </span>
                          <span>{lang.name}</span>
                        </div>
                        {selectedLang.toLowerCase() === lang.id.toLowerCase() && (
                          <Check size={13} className="text-blue-600 dark:text-blue-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Line Wrapping Toggle */}
            <button
              type="button"
              onClick={() => setLineWrap(!lineWrap)}
              className={cn(
                "hidden sm:flex p-1.5 rounded-lg border transition-colors cursor-pointer",
                lineWrap
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50"
                  : "bg-white dark:bg-zinc-800 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-200 border-gray-200 dark:border-zinc-700"
              )}
              title={lineWrap ? t('lineWrappingDisable') : t('lineWrappingEnable')}
            >
              <WrapText size={14} />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="min-w-[36px] min-h-[36px] w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl bg-gray-200/60 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-95 transition-all cursor-pointer shrink-0"
              title={t('close')}
              aria-label={t('close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── CodeMirror Workspace ─── */}
        <div className="flex-1 overflow-y-auto font-mono text-[13px] bg-slate-50/50 dark:bg-[#0e0f12]">
          <CodeMirror
            value={code}
            onChange={(val) => setCode(val)}
            onCreateEditor={(view) => {
              editorViewRef.current = view;
              view.focus();
            }}
            onUpdate={handleEditorUpdate}
            theme={isDark ? 'dark' : 'light'}
            extensions={editorExtensions}
            className="h-full cm-code-modal-editor"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              indentOnInput: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
            }}
          />
        </div>

        {/* ─── Status Bar & Footer ─── */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-gray-50 dark:bg-[#18191f] border-t border-gray-200 dark:border-zinc-800 text-xs shrink-0 select-none pb-safe gap-2">
          {/* Status info */}
          <div className="hidden sm:flex items-center gap-4 text-gray-500 dark:text-gray-400 font-mono text-[11px]">
            <span>
              {t('lineColStats', { line: stats.cursor.line, col: stats.cursor.col })}
            </span>
            <span className="text-gray-300 dark:text-zinc-700">•</span>
            <span>{stats.lines} {t('linesCount')}</span>
            <span className="text-gray-300 dark:text-zinc-700">•</span>
            <span>{stats.chars} {t('charsCount')}</span>
            <span className="text-gray-300 dark:text-zinc-700">•</span>
            <span className="capitalize">{activeLangConfig.name}</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleCopyCode}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 transition-colors cursor-pointer"
            >
              <Copy size={13} />
              <span>{copied ? t('copied') : t('copyCode')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] px-3.5 sm:px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer active:scale-95"
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="min-h-[36px] flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Check size={14} />
              <span>{isEditing ? t('updateCodeBlock') : t('insertCodeBlock')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
