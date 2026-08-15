import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Code,
  Palette,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Link,
  Link2,
  ChevronDown,
  Info,
  Lightbulb,
  AlertTriangle,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectionBubbleState {
  show: boolean;
  top: number;
  left: number;
  from: number;
  to: number;
  selectedText: string;
}

export type FormatType =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'highlight'
  | 'code'
  | 'color'
  | 'heading'
  | 'quote'
  | 'callout'
  | 'link'
  | 'wikilink';

interface SelectionBubbleMenuProps {
  bubbleState: SelectionBubbleState;
  onFormat: (type: FormatType, payload?: string) => void;
}

const PRESET_COLORS = [
  { name: 'Kırmızı', value: '#ef4444', bg: 'bg-red-500' },
  { name: 'Turuncu', value: '#f97316', bg: 'bg-orange-500' },
  { name: 'Sarı / Amber', value: '#f59e0b', bg: 'bg-amber-500' },
  { name: 'Yeşil', value: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Mavi', value: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Mor', value: '#8b5cf6', bg: 'bg-purple-500' },
  { name: 'Pembe', value: '#ec4899', bg: 'bg-pink-500' },
  { name: 'Gri', value: '#6b7280', bg: 'bg-gray-500' },
];

export const SelectionBubbleMenu: React.FC<SelectionBubbleMenuProps> = ({
  bubbleState,
  onFormat,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showCalloutMenu, setShowCalloutMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Close submenus when selection changes or hides
  useEffect(() => {
    if (!bubbleState.show) {
      setShowColorPicker(false);
      setShowHeadingMenu(false);
      setShowCalloutMenu(false);
      setShowLinkInput(false);
      setLinkUrl('');
    }
  }, [bubbleState.show, bubbleState.from, bubbleState.to]);

  useEffect(() => {
    if (showLinkInput) {
      setTimeout(() => linkInputRef.current?.focus(), 50);
    }
  }, [showLinkInput]);

  if (!bubbleState.show) return null;

  const handleApplyLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (linkUrl.trim()) {
      onFormat('link', linkUrl.trim());
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  // Smart boundary clamping: keep toolbar visible inside the editor content area
  const menuWidth = menuRef.current?.offsetWidth || 380;
  const minLeft = Math.floor(menuWidth / 2) + 20;
  const clampedLeft = Math.max(minLeft, bubbleState.left);
  const caretOffset = Math.max(
    -menuWidth / 2 + 20,
    Math.min(menuWidth / 2 - 20, bubbleState.left - clampedLeft)
  );

  const isTopCutoff = bubbleState.top - 46 < 10;
  const menuTop = isTopCutoff ? bubbleState.top + 28 : bubbleState.top - 46;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 select-none animate-in fade-in zoom-in-95 duration-150 -translate-x-1/2 pointer-events-auto"
      style={{
        top: Math.max(10, menuTop),
        left: clampedLeft,
      }}
      onMouseDown={(e) => {
        // Prevent losing editor focus on menu interaction
        e.preventDefault();
      }}
    >
      {/* Top caret indicator if rendered below selection */}
      {!showLinkInput && isTopCutoff && (
        <div
          className="w-0 h-0 border-x-4 border-x-transparent border-b-4 border-b-white dark:border-b-zinc-900 mx-auto drop-shadow-xs mb-0.5"
          style={{ transform: `translateX(${caretOffset}px)` }}
        />
      )}
      <div className="flex items-center gap-0.5 p-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-gray-200/90 dark:border-zinc-700/90 rounded-xl shadow-2xl text-gray-700 dark:text-gray-200 text-xs">
        {showLinkInput ? (
          <form onSubmit={handleApplyLink} className="flex items-center gap-1.5 px-2 py-0.5">
            <Link size={13} className="text-mac-accent shrink-0" />
            <input
              ref={linkInputRef}
              type="text"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-md text-xs text-gray-900 dark:text-gray-100 outline-none w-44 border border-gray-200 dark:border-zinc-700 font-mono"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-mac-accent text-white font-semibold rounded-md text-xs hover:opacity-90"
            >
              Ekle
            </button>
            <button
              type="button"
              onClick={() => setShowLinkInput(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
            >
              ✕
            </button>
          </form>
        ) : (
          <>
            {/* Bold */}
            <button
              onClick={() => onFormat('bold')}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              title="Kalın (Cmd+B)"
            >
              <Bold size={14} />
            </button>

            {/* Italic */}
            <button
              onClick={() => onFormat('italic')}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              title="İtalik (Cmd+I)"
            >
              <Italic size={14} />
            </button>

            {/* Strikethrough */}
            <button
              onClick={() => onFormat('strikethrough')}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              title="Üstü Çizili (~~text~~)"
            >
              <Strikethrough size={14} />
            </button>

            {/* Highlight */}
            <button
              onClick={() => onFormat('highlight')}
              className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              title="Vurgula (==text==)"
            >
              <Highlighter size={14} />
            </button>

            {/* Inline Code */}
            <button
              onClick={() => onFormat('code')}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors font-mono"
              title="Satır İçi Kod (`code`)"
            >
              <Code size={14} />
            </button>

            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-0.5" />

            {/* Color Picker Toggle */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowHeadingMenu(false);
                  setShowCalloutMenu(false);
                }}
                className={cn(
                  "flex items-center gap-0.5 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors",
                  showColorPicker && "bg-gray-100 dark:bg-zinc-800 text-mac-accent"
                )}
                title="Yazı Rengi"
              >
                <Palette size={14} />
                <ChevronDown size={10} className="opacity-60" />
              </button>

              {showColorPicker && (
                <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 p-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl flex flex-wrap gap-1.5 w-36 z-50">
                  <div className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 px-0.5">
                    Renk Seçimi
                  </div>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => {
                        onFormat('color', c.value);
                        setShowColorPicker(false);
                      }}
                      className="group relative flex items-center justify-center w-6 h-6 rounded-lg hover:scale-110 transition-transform"
                      title={c.name}
                    >
                      <span className={cn("w-4 h-4 rounded-full shadow-2xs", c.bg)} />
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      onFormat('color', '');
                      setShowColorPicker(false);
                    }}
                    className="w-full mt-1 py-0.5 text-[10px] text-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                  >
                    Rengi Temizle
                  </button>
                </div>
              )}
            </div>

            {/* Heading Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowHeadingMenu(!showHeadingMenu);
                  setShowColorPicker(false);
                  setShowCalloutMenu(false);
                }}
                className={cn(
                  "flex items-center gap-0.5 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors",
                  showHeadingMenu && "bg-gray-100 dark:bg-zinc-800 text-mac-accent"
                )}
                title="Başlık Seviyesi"
              >
                <Heading size={14} />
                <ChevronDown size={10} className="opacity-60" />
              </button>

              {showHeadingMenu && (
                <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 p-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl flex flex-col gap-0.5 w-32 z-50">
                  <button
                    onClick={() => {
                      onFormat('heading', '1');
                      setShowHeadingMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Heading1 size={13} className="text-mac-accent" />
                    <span className="font-bold">Başlık 1</span>
                  </button>
                  <button
                    onClick={() => {
                      onFormat('heading', '2');
                      setShowHeadingMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Heading2 size={13} className="text-mac-accent" />
                    <span className="font-semibold">Başlık 2</span>
                  </button>
                  <button
                    onClick={() => {
                      onFormat('heading', '3');
                      setShowHeadingMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Heading3 size={13} className="text-mac-accent" />
                    <span className="font-medium">Başlık 3</span>
                  </button>
                  <button
                    onClick={() => {
                      onFormat('heading', '0');
                      setShowHeadingMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left text-gray-500"
                  >
                    <span>Paragraf</span>
                  </button>
                </div>
              )}
            </div>

            {/* Callout / Quote Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowCalloutMenu(!showCalloutMenu);
                  setShowColorPicker(false);
                  setShowHeadingMenu(false);
                }}
                className={cn(
                  "flex items-center gap-0.5 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors",
                  showCalloutMenu && "bg-gray-100 dark:bg-zinc-800 text-mac-accent"
                )}
                title="Alıntı / Callout Kutusu"
              >
                <Quote size={14} />
                <ChevronDown size={10} className="opacity-60" />
              </button>

              {showCalloutMenu && (
                <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 p-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl flex flex-col gap-0.5 w-36 z-50">
                  <button
                    onClick={() => {
                      onFormat('quote');
                      setShowCalloutMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Quote size={13} />
                    <span>Alıntı Metni</span>
                  </button>
                  <div className="w-full h-px bg-gray-100 dark:bg-zinc-800 my-0.5" />
                  <button
                    onClick={() => {
                      onFormat('callout', 'NOTE');
                      setShowCalloutMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1 text-xs rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 transition-colors text-left"
                  >
                    <Info size={12} />
                    <span>Bilgi (NOTE)</span>
                  </button>
                  <button
                    onClick={() => {
                      onFormat('callout', 'TIP');
                      setShowCalloutMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1 text-xs rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 transition-colors text-left"
                  >
                    <Lightbulb size={12} />
                    <span>İpucu (TIP)</span>
                  </button>
                  <button
                    onClick={() => {
                      onFormat('callout', 'IMPORTANT');
                      setShowCalloutMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1 text-xs rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-600 dark:text-purple-400 transition-colors text-left"
                  >
                    <Flame size={12} />
                    <span>Önemli</span>
                  </button>
                  <button
                    onClick={() => {
                      onFormat('callout', 'WARNING');
                      setShowCalloutMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1 text-xs rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400 transition-colors text-left"
                  >
                    <AlertTriangle size={12} />
                    <span>Uyarı</span>
                  </button>
                  <button
                    onClick={() => {
                      onFormat('callout', 'CAUTION');
                      setShowCalloutMenu(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1 text-xs rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-colors text-left"
                  >
                    <ShieldAlert size={12} />
                    <span>Dikkat</span>
                  </button>
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-0.5" />

            {/* Standard Link */}
            <button
              onClick={() => setShowLinkInput(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              title="Web Bağlantısı Ekle"
            >
              <Link size={14} />
            </button>

            {/* Wikilink */}
            <button
              onClick={() => onFormat('wikilink')}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-mac-accent"
              title="Not Bağlantısı [[WikiLink]]"
            >
              <Link2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* Downward triangle caret indicator */}
      {!showLinkInput && !isTopCutoff && (
        <div
          className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-white dark:border-t-zinc-900 mx-auto drop-shadow-xs mt-0.5"
          style={{ transform: `translateX(${caretOffset}px)` }}
        />
      )}
    </div>
  );
};
