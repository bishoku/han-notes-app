/**
 * FloatingBlockMenu.tsx — The floating UI elements that appear alongside
 * the editor: the (+) block menu, task edit button, and decision edit button.
 */
import React from 'react';
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
}

export const FloatingBlockMenu: React.FC<FloatingBlockMenuProps> = ({
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
}) => {
  const { t } = useTranslation();

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
          className="absolute left-1 z-10 flex items-center justify-center h-7 gap-2 transition-all duration-200"
          style={{ top: menuPos.top - 2 }}
        >
          <button 
            onClick={onToggleOptions}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            title="Add Block"
          >
            <Plus size={18} className={cn("transition-transform duration-200", showOptions && "rotate-45")} />
          </button>
          
          {showOptions && (
            <div className="relative flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-md shadow-mac border border-gray-100 dark:border-zinc-700 animate-in fade-in slide-in-from-left-2">
              <button 
                onClick={() => onInsertText('# ')}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                title="Heading 1"
              >
                <Heading1 size={16} />
              </button>
              <button 
                onClick={() => onInsertText('## ')}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                title="Heading 2"
              >
                <Heading2 size={16} />
              </button>
              <button 
                onClick={() => onInsertText('### ')}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                title="Heading 3"
              >
                <Heading3 size={16} />
              </button>
              <button 
                onClick={() => onInsertText('#### ')}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                title="Heading 4"
              >
                <Heading4 size={16} />
              </button>
              <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-0.5" />
              <button 
                onClick={() => onInsertText('- [ ] ')}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                title={t('task')}
              >
                <CheckSquare size={16} />
              </button>
              <button 
                onClick={() => onInsertText('- [D] ')}
                className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-md transition-colors"
                title={t('decisionRecord')}
              >
                <FileCheck size={16} />
              </button>
              <button 
                onClick={onToggleNotePicker}
                className="p-1.5 text-gray-500 hover:text-mac-accent hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                title="Link Note"
              >
                <Link2 size={16} />
              </button>
              <button 
                onClick={onOpenImagePicker}
                className="p-1.5 text-gray-500 hover:text-mac-accent hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                title="Insert Image/GIF"
              >
                <ImageIcon size={16} />
              </button>
              {onOpenDiagramEditor && (
                <button 
                  onClick={onOpenDiagramEditor}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors"
                  title="YADA Diyagramı Ekle"
                >
                  <Workflow size={16} />
                </button>
              )}
              {onOpenExcalidrawEditor && (
                <button 
                  onClick={onOpenExcalidrawEditor}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-md transition-colors"
                  title="Excalidraw Serbest Çizim Ekle"
                >
                  <Sparkles size={16} />
                </button>
              )}

              {/* Dropdown list of existing notes (max 10) */}
              {showNotePicker && (
                <div className="absolute top-10 left-0 w-52 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5 z-20 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Select Note to Link</div>
                  {notes.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-gray-400 italic">No notes found</div>
                  ) : (
                    notes.slice(0, 10).map((note: NoteInfo) => (
                      <button
                        key={note.id}
                        onClick={() => onInsertText(`[[${note.id}]]`)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-mac-accent/10 hover:text-mac-accent text-xs text-gray-700 dark:text-gray-300 transition-colors text-left truncate justify-between"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText size={12} className="shrink-0 text-mac-accent" />
                          <span className="truncate font-medium">{note.title}</span>
                        </div>
                        {note.id.includes('/') && (
                          <span className="text-[9px] text-gray-400 font-mono shrink-0 ml-1">
                            {note.id.split('/')[0]}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
