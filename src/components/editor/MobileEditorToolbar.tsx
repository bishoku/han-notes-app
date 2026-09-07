import React, { useState } from 'react';
import {
  Heading1,
  Heading2,
  Bold,
  Italic,
  CheckSquare,
  List,
  Image as ImageIcon,
  PenTool,
  SlidersHorizontal,
  ShieldCheck,
  Undo2,
  Redo2,
  Indent,
  Outdent,
  Search,
  Code2,
  Bot,
  TextSelect,
  CaseSensitive,
  Rows,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MobileEditorToolbarProps {
  onInsertHeading: (level: 1 | 2) => void;
  onInsertBold: () => void;
  onInsertItalic: () => void;
  onInsertTask: () => void;
  onInsertBullet: () => void;
  onOpenImagePicker: () => void;
  onOpenExcalidraw: () => void;
  onToggleAi: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  onInsertSymbol?: (symbol: string) => void;
  onToggleSearch?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  taskEditActive?: boolean;
  onEditTask?: () => void;
  decisionEditActive?: boolean;
  onEditDecision?: () => void;
  hasSelection?: boolean;
  onSelectWord?: () => void;
  onSelectLine?: () => void;
  onExpandSelection?: () => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onStepCursor?: (direction: 'left' | 'right', extend?: boolean) => void;
}

export const MobileEditorToolbar: React.FC<MobileEditorToolbarProps> = ({
  onInsertHeading,
  onInsertBold,
  onInsertItalic,
  onInsertTask,
  onInsertBullet,
  onOpenImagePicker,
  onOpenExcalidraw,
  onToggleAi,
  onUndo,
  onRedo,
  onIndent,
  onOutdent,
  onInsertSymbol,
  onToggleSearch,
  canUndo = true,
  canRedo = true,
  taskEditActive,
  onEditTask,
  decisionEditActive,
  onEditDecision,
  hasSelection,
  onSelectWord,
  onSelectLine,
  onExpandSelection,
  onSelectAll,
  onClearSelection,
  onStepCursor,
}) => {
  const { t } = useTranslation();
  const [showSymbols, setShowSymbols] = useState(false);
  const [showSelectionTools, setShowSelectionTools] = useState(false);

  const QUICK_SYMBOLS = ['#', '*', '`', '~', '==', '|', '-', '>', '[ ]', '---'];

  return (
    <div className="sticky bottom-0 inset-x-0 z-20 flex flex-col md:hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-200/80 dark:border-zinc-800/80 shadow-md select-none shrink-0">
      {/* Quick Text Selection & Navigation Strip */}
      {(showSelectionTools || hasSelection) && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50/90 dark:bg-purple-950/40 border-b border-purple-200/60 dark:border-purple-800/50 overflow-x-auto no-scrollbar animate-in slide-in-from-bottom-1 duration-150">
          <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider shrink-0 mr-0.5">
            {t('selectionTools', 'Seçim')}:
          </span>

          {/* Select Word */}
          {onSelectWord && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectWord();
              }}
              className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 text-xs font-medium shrink-0 active:scale-95 transition-transform flex items-center gap-1"
              title={t('selectWord', 'Kelime Seç')}
            >
              <CaseSensitive size={13} />
              <span>{t('selectWord', 'Kelime')}</span>
            </button>
          )}

          {/* Select Line */}
          {onSelectLine && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectLine();
              }}
              className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 text-xs font-medium shrink-0 active:scale-95 transition-transform flex items-center gap-1"
              title={t('selectLine', 'Satır Seç')}
            >
              <Rows size={13} />
              <span>{t('selectLine', 'Satır')}</span>
            </button>
          )}

          {/* Expand Selection */}
          {onExpandSelection && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onExpandSelection();
              }}
              className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 text-xs font-medium shrink-0 active:scale-95 transition-transform flex items-center gap-1"
              title={t('expandSelection', 'Genişlet')}
            >
              <Maximize2 size={11} />
              <span>{t('expandSelection', 'Genişlet')}</span>
            </button>
          )}

          <div className="w-px h-3.5 bg-purple-200 dark:bg-purple-800 mx-0.5 shrink-0" />

          {/* Step Cursor Left / Right */}
          {onStepCursor && (
            <>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onStepCursor('left', false);
                }}
                className="p-1 rounded bg-white dark:bg-zinc-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 text-xs shrink-0 active:scale-95 transition-transform"
                title={t('stepLeft', 'Sola Adımla')}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onStepCursor('right', false);
                }}
                className="p-1 rounded bg-white dark:bg-zinc-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 text-xs shrink-0 active:scale-95 transition-transform"
                title={t('stepRight', 'Sağa Adımla')}
              >
                <ChevronRight size={14} />
              </button>
            </>
          )}

          {/* Select All */}
          {onSelectAll && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectAll();
              }}
              className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 text-xs font-medium shrink-0 active:scale-95 transition-transform"
              title={t('selectAll', 'Tümünü Seç')}
            >
              {t('selectAll', 'Tümü')}
            </button>
          )}

          {/* Clear Selection */}
          {hasSelection && onClearSelection && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onClearSelection();
              }}
              className="p-1 rounded bg-white dark:bg-zinc-800 hover:bg-red-50 text-red-500 border border-red-200 dark:border-red-900/50 text-xs shrink-0 active:scale-95 transition-transform"
              title={t('clearSelection', 'Seçimi Bırak')}
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Quick Markdown Symbols Strip (collapsible or toggleable) */}
      {showSymbols && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50/90 dark:bg-zinc-950/80 border-b border-gray-200/50 dark:border-zinc-800/60 overflow-x-auto no-scrollbar animate-in slide-in-from-bottom-1 duration-150">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1">
            {t('symbols', 'Semboller')}:
          </span>
          {QUICK_SYMBOLS.map((sym) => (
            <button
              key={sym}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onInsertSymbol?.(sym);
              }}
              className="px-2.5 py-0.5 rounded bg-white dark:bg-zinc-800 hover:bg-mac-accent/10 hover:text-mac-accent text-gray-700 dark:text-gray-300 border border-gray-200/80 dark:border-zinc-700 text-xs font-mono font-medium shrink-0 active:scale-95 transition-transform"
            >
              {sym}
            </button>
          ))}
        </div>
      )}

      {/* Main Docked Toolbar */}
      <div className="flex items-center justify-between px-2 pt-1 pb-safe-area overflow-x-auto no-scrollbar gap-0.5 min-h-[44px]">
        <div className="flex items-center gap-0.5 min-w-max">
          {/* Undo */}
          {onUndo && (
            <button
              type="button"
              disabled={!canUndo}
              onMouseDown={(e) => {
                e.preventDefault();
                onUndo();
              }}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all"
              title={t('undo', 'Geri Al')}
            >
              <Undo2 size={16} />
            </button>
          )}

          {/* Redo */}
          {onRedo && (
            <button
              type="button"
              disabled={!canRedo}
              onMouseDown={(e) => {
                e.preventDefault();
                onRedo();
              }}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all"
              title={t('redo', 'İleri Al')}
            >
              <Redo2 size={16} />
            </button>
          )}

          <div className="w-px h-4 bg-gray-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* H1 */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onInsertHeading(1);
            }}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
            title={t('heading1', 'Başlık 1')}
          >
            <Heading1 size={17} />
          </button>

          {/* H2 */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onInsertHeading(2);
            }}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
            title={t('heading2', 'Başlık 2')}
          >
            <Heading2 size={17} />
          </button>

          {/* Bold */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onInsertBold();
            }}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
            title={t('bold', 'Kalın')}
          >
            <Bold size={16} />
          </button>

          {/* Italic */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onInsertItalic();
            }}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
            title={t('italic', 'İtalik')}
          >
            <Italic size={16} />
          </button>

          <div className="w-px h-4 bg-gray-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Task Checkbox */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onInsertTask();
            }}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
            title={t('task', 'Görev')}
          >
            <CheckSquare size={16} className="text-emerald-500" />
          </button>

          {/* Dynamic Task Edit Button */}
          {taskEditActive && onEditTask && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onEditTask();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-mac-accent/15 text-mac-accent hover:bg-mac-accent/25 active:scale-95 transition-all flex items-center gap-1.5 font-semibold text-xs animate-in zoom-in-95 shrink-0"
              title={t('editTaskProps', 'Görevi Düzenle')}
            >
              <SlidersHorizontal size={14} />
              <span>{t('editTaskProps', 'Görevi Düzenle')}</span>
            </button>
          )}

          {/* Dynamic Decision Edit Button */}
          {decisionEditActive && onEditDecision && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onEditDecision();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25 active:scale-95 transition-all flex items-center gap-1.5 font-semibold text-xs animate-in zoom-in-95 shrink-0"
              title={t('editDecisionProps', 'Kararı Düzenle')}
            >
              <ShieldCheck size={14} />
              <span>{t('editDecisionProps', 'Kararı Düzenle')}</span>
            </button>
          )}

          {/* Bullet List */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onInsertBullet();
            }}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
            title={t('bulletList', 'Madde Listesi')}
          >
            <List size={16} />
          </button>

          {/* Indent / Outdent (Mobile Tab / Shift-Tab) */}
          {onIndent && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onIndent();
              }}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
              title={t('indent', 'Girintiyi Artır (Tab)')}
            >
              <Indent size={16} />
            </button>
          )}
          {onOutdent && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onOutdent();
              }}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
              title={t('outdent', 'Girintiyi Azalt (Shift+Tab)')}
            >
              <Outdent size={16} />
            </button>
          )}

          <div className="w-px h-4 bg-gray-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Quick Selection Tools Toggle */}
          {(onSelectWord || onSelectLine || onExpandSelection) && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowSelectionTools(!showSelectionTools);
                if (!showSelectionTools) setShowSymbols(false);
              }}
              className={`p-2 rounded-lg transition-all active:scale-95 flex items-center gap-0.5 ${
                showSelectionTools || hasSelection
                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={t('selectionTools', 'Seçim Araçları')}
            >
              <TextSelect size={16} />
            </button>
          )}

          {/* Quick Markdown Symbols Strip Toggle */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowSymbols(!showSymbols);
              if (!showSymbols) setShowSelectionTools(false);
            }}
            className={`p-2 rounded-lg transition-all active:scale-95 ${
              showSymbols
                ? 'bg-mac-accent/15 text-mac-accent font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title={t('quickSymbols', 'Hızlı Semboller')}
          >
            <Code2 size={16} />
          </button>

          {/* Insert Image */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onOpenImagePicker();
            }}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
            title={t('image', 'Görsel')}
          >
            <ImageIcon size={16} className="text-blue-500" />
          </button>

          {/* Freehand Drawing (Excalidraw) */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onOpenExcalidraw();
            }}
            className="p-2 rounded-lg text-orange-500 hover:bg-orange-500/10 active:scale-95 transition-all"
            title={t('freehandSketch', 'Serbest Çizim')}
          >
            <PenTool size={16} />
          </button>

          {/* In-Note Search */}
          {onToggleSearch && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onToggleSearch();
              }}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
              title={t('searchInNote', 'Notta Ara')}
            >
              <Search size={16} />
            </button>
          )}

          {/* AI Ghostwriter / Paragraph Generator */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onToggleAi();
            }}
            className="p-2 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-500/15 active:scale-95 transition-all flex items-center gap-1 font-semibold text-xs"
            title={t('aiInlineTitle', 'AI Paragraf & İçerik Üretici')}
          >
            <Bot size={16} className="text-purple-600 dark:text-purple-400" />
            <span className="text-[11px] font-bold">AI</span>
          </button>
        </div>
      </div>
    </div>
  );
};
