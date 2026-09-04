import React from 'react';
import {
  Heading1,
  Heading2,
  Bold,
  Italic,
  CheckSquare,
  List,
  Image as ImageIcon,
  PenTool,
  Sparkles,
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
}) => {
  const { t } = useTranslation();

  return (
    <div className="sticky bottom-0 inset-x-0 z-20 flex md:hidden items-center justify-between px-2 py-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-200/80 dark:border-zinc-800/80 pb-safe shadow-md overflow-x-auto no-scrollbar gap-0.5 select-none shrink-0">
      <div className="flex items-center gap-0.5 min-w-max">
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

        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-800 mx-1 shrink-0" />

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

        {/* AI Assistant */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onToggleAi();
          }}
          className="p-2 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 active:scale-95 transition-all flex items-center gap-1 font-medium text-xs"
          title={t('aiAssistantTitle', 'Yapay Zeka')}
        >
          <Sparkles size={16} />
          <span className="text-[11px] font-semibold">AI</span>
        </button>
      </div>
    </div>
  );
};
