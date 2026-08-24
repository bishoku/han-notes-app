/**
 * FloatingBlockMenu.tsx — The floating UI elements that appear alongside
 * the editor: the (+) block menu, task edit button, decision edit button,
 * and inline AI assistant trigger.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteInfo } from '@/store/noteStore';
import type { BlockMenuState, FloatingButtonState } from '@/hooks/useEditorFloatingUI';
import {
  Plus,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  CheckSquare,
  Link2,
  FileText,
  SlidersHorizontal,
  Image as ImageIcon,
  FileCheck,
  ShieldCheck,
  Workflow,
  Sparkles,
  Search,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingBlockMenuProps {
  menuPos: BlockMenuState;
  showOptions: boolean;
  showNotePicker: boolean;
  taskEditBtn: FloatingButtonState;
  decisionEditBtn: FloatingButtonState;
  notes: NoteInfo[];
  onToggleOptions: () => void;
  onToggleNotePicker: () => void;
  onInsertText: (text: string) => void;
  onOpenTaskModal: () => void;
  onOpenDecisionModal: () => void;
  onOpenImagePicker: () => void;
  onOpenDiagramEditor?: () => void;
  onOpenExcalidrawEditor?: () => void;
  onOpenInlineAi?: () => void;
}

export const FloatingBlockMenu: React.FC<FloatingBlockMenuProps> = React.memo(({
  menuPos,
  showOptions,
  showNotePicker,
  taskEditBtn,
  decisionEditBtn,
  notes,
  onToggleOptions,
  onToggleNotePicker,
  onInsertText,
  onOpenTaskModal,
  onOpenDecisionModal,
  onOpenImagePicker,
  onOpenDiagramEditor,
  onOpenExcalidrawEditor,
  onOpenInlineAi,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Close options dropdown if user clicks outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (showOptions && menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        onToggleOptions();
      }
    };
    if (showOptions) {
      document.addEventListener('mousedown', handleMouseDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [showOptions, onToggleOptions]);

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q);
  });

  return (
    <>
      {/* Floating Task Edit Settings Button */}
      {taskEditBtn.show && (
        <div 
          className="absolute left-1 z-10 flex items-center justify-center h-7 transition-all duration-200"
          style={{ top: taskEditBtn.top - 2 }}
        >
          <button 
            onClick={onOpenTaskModal}
            className="p-1 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 shadow-sm rounded-full text-mac-accent hover:bg-mac-accent hover:text-white transition-all transform hover:scale-105"
            title={t('editTaskProps')}
          >
            <SlidersHorizontal size={13} />
          </button>
        </div>
      )}

      {/* Floating Decision Edit Settings Button */}
      {decisionEditBtn.show && (
        <div 
          className="absolute left-1 z-10 flex items-center justify-center h-7 transition-all duration-200"
          style={{ top: decisionEditBtn.top - 2 }}
        >
          <button 
            onClick={onOpenDecisionModal}
            className="p-1 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 shadow-sm rounded-full text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white transition-all transform hover:scale-105"
            title={t('editDecisionProps')}
          >
            <ShieldCheck size={14} />
          </button>
        </div>
      )}

      {/* Floating Block Menu (+ button on empty line) */}
      {menuPos.show && (
        <div 
          ref={menuContainerRef}
          className="absolute left-1 z-10 flex items-center justify-center h-7 gap-2 transition-all duration-200"
          style={{ top: menuPos.top - 2 }}
        >
          <button 
            onClick={onToggleOptions}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={t('addBlock')}
          >
            <Plus size={18} className={cn("transition-transform duration-200", showOptions && "rotate-45")} />
          </button>
          
          {showOptions && (
            <div className="relative flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-md shadow-mac border border-gray-100 dark:border-zinc-700 animate-in fade-in slide-in-from-left-2">
              {/* Inline AI Generator Option */}
              {onOpenInlineAi && (
                <>
                  <button 
                    onClick={() => {
                      onOpenInlineAi();
                      onToggleOptions();
                    }}
                    className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-md transition-all cursor-pointer group flex items-center"
                    title={t('aiInlineWrite')}
                  >
                    <Bot size={16} className="text-purple-500 group-hover:scale-110 transition-transform" />
                  </button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-0.5" />
                </>
              )}

              <button 
                onClick={() => onInsertText('# ')}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
                title={`${t('heading')} 1`}
              >
                <Heading1 size={16} />
              </button>
              <button 
                onClick={() => onInsertText('## ')}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
                title={`${t('heading')} 2`}
              >
                <Heading2 size={16} />
              </button>
              <button 
                onClick={() => onInsertText('### ')}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
                title={`${t('heading')} 3`}
              >
                <Heading3 size={16} />
              </button>
              <button 
                onClick={() => onInsertText('#### ')}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
                title={`${t('heading')} 4`}
              >
                <Heading4 size={16} />
              </button>
              <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-0.5" />
              <button 
                onClick={() => onInsertText('- [ ] ')}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
                title={t('task')}
              >
                <CheckSquare size={16} />
              </button>
              <button 
                onClick={() => onInsertText('- [D] ')}
                className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-md transition-colors cursor-pointer"
                title={t('decisionRecord')}
              >
                <FileCheck size={16} />
              </button>
              <button 
                onClick={onToggleNotePicker}
                className={cn(
                  "p-1.5 rounded-md transition-colors cursor-pointer",
                  showNotePicker
                    ? "bg-mac-accent/15 text-mac-accent"
                    : "text-gray-500 hover:text-mac-accent hover:bg-gray-100 dark:hover:bg-zinc-700"
                )}
                title={t('linkNote')}
              >
                <Link2 size={16} />
              </button>
              <button 
                onClick={onOpenImagePicker}
                className="p-1.5 text-gray-500 hover:text-mac-accent hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
                title={t('insertImage')}
              >
                <ImageIcon size={16} />
              </button>
              {onOpenDiagramEditor && (
                <button 
                  onClick={onOpenDiagramEditor}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors cursor-pointer"
                  title={t('insertDiagram')}
                >
                  <Workflow size={16} />
                </button>
              )}
              {onOpenExcalidrawEditor && (
                <button 
                  onClick={onOpenExcalidrawEditor}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-md transition-colors cursor-pointer"
                  title={t('insertExcalidraw')}
                >
                  <Sparkles size={16} />
                </button>
              )}

              {/* Dropdown list of existing other notes */}
              {showNotePicker && (
                <div className="absolute top-10 left-0 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {t('selectNoteToLink')}
                  </div>

                  {/* Search Input for fast filtering */}
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs">
                    <Search size={12} className="text-gray-400 shrink-0" />
                    <input
                      type="text"
                      placeholder={t('searchNotesPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent outline-none w-full text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Scrollable List of Notes */}
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 mt-1 scrollbar-thin">
                    {filteredNotes.length === 0 ? (
                      <div className="px-2 py-3 text-center text-xs text-gray-400">
                        {t('noResultsFound')}
                      </div>
                    ) : (
                      filteredNotes.map((note) => (
                        <button
                          key={note.id}
                          onClick={() => {
                            onInsertText(`[[${note.id}]]`);
                            onToggleNotePicker();
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-mac-accent/10 hover:text-mac-accent rounded-lg text-left transition-colors cursor-pointer group"
                        >
                          <FileText size={13} className="text-gray-400 group-hover:text-mac-accent shrink-0" />
                          <span className="truncate font-medium">{note.title}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
});

