import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface SlashCommand {
  id: string;
  label: string;
  command: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  category: string;
  execute: () => void;
  /** Optional sub-commands for nested menus (e.g., language selection) */
  subCommands?: SlashCommand[];
}

interface SlashCommandMenuProps {
  query: string;
  /** Viewport-relative coordinates (from coordsAtPos) */
  anchorRect: { top: number; left: number; bottom: number };
  commands: SlashCommand[];
  onClose: () => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  query,
  anchorRect,
  commands,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeSubMenu, setActiveSubMenu] = useState<SlashCommand | null>(null);
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter commands by query — sub-menus show all items (query belongs to parent)
  const filteredCommands = activeSubMenu
    ? (activeSubMenu.subCommands || [])
    : commands.filter((cmd) =>
        cmd.command.toLowerCase().includes(query.toLowerCase()) ||
        cmd.label.toLowerCase().includes(query.toLowerCase())
      );

  // Reset selected index when query changes or sub-menu opens/closes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeSubMenu]);

  // Scroll selected item into view
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const selected = menu.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation - use capture phase to intercept before CodeMirror
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (filteredCommands.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        break;
      case 'ArrowRight': {
        // Open sub-menu if the selected command has sub-commands
        const cmd = filteredCommands[selectedIndex];
        if (cmd?.subCommands && cmd.subCommands.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setActiveSubMenu(cmd);
        }
        break;
      }
      case 'ArrowLeft':
      case 'Backspace':
        // Go back to main menu from sub-menu
        if (activeSubMenu && (e.key === 'ArrowLeft' || (e.key === 'Backspace' && !query))) {
          e.preventDefault();
          e.stopPropagation();
          setActiveSubMenu(null);
        }
        break;
      case 'Enter':
      case 'Tab': {
        e.preventDefault();
        e.stopPropagation();
        const cmd = filteredCommands[selectedIndex];
        if (cmd?.subCommands && cmd.subCommands.length > 0 && !activeSubMenu) {
          // Open sub-menu instead of executing
          setActiveSubMenu(cmd);
        } else {
          cmd?.execute();
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        if (activeSubMenu) {
          setActiveSubMenu(null);
        } else {
          onClose();
        }
        break;
    }
  }, [filteredCommands, selectedIndex, onClose, activeSubMenu, query]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleKeyDown]);

  if (filteredCommands.length === 0 && !activeSubMenu) {
    return null;
  }

  // Best practice positioning: anchor menu BOTTOM edge near the cursor, grow upward.
  const MENU_WIDTH = 288;
  const GAP = 6;
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: typeof window !== 'undefined' ? window.innerHeight - anchorRect.top + GAP : GAP,
    left: anchorRect.left,
    zIndex: 9999,
  };

  if (typeof window !== 'undefined') {
    if (anchorRect.left + MENU_WIDTH > window.innerWidth) {
      menuStyle.left = window.innerWidth - MENU_WIDTH - 8;
    }
    if (anchorRect.top < 340) {
      delete menuStyle.bottom;
      menuStyle.top = anchorRect.bottom + GAP;
    }
  }

  const displayCommands = filteredCommands;
  const headerLabel = activeSubMenu ? activeSubMenu.label : t('slashMenuCommands');

  return (
    <div
      ref={menuRef}
      className="w-72 bg-white/98 dark:bg-zinc-900/98 backdrop-blur-xl border border-gray-200/70 dark:border-zinc-700/70 rounded-xl shadow-2xl p-1 flex flex-col select-none"
      style={menuStyle}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="px-2.5 py-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        <div className="flex items-center gap-1.5">
          {activeSubMenu && (
            <button
              onClick={() => setActiveSubMenu(null)}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft size={10} />
            </button>
          )}
          <span>{headerLabel}</span>
        </div>
        <span className="font-mono text-[9px] normal-case opacity-60">
          {activeSubMenu ? '← geri' : t('slashMenuHint')}
        </span>
      </div>

      {/* Command List */}
      <div className="flex flex-col max-h-[280px] overflow-y-auto">
        {displayCommands.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-400 text-center italic">
            Sonuç bulunamadı
          </div>
        ) : (
          displayCommands.map((cmd, idx) => {
            const isSelected = idx === selectedIndex;
            const hasSubMenu = !activeSubMenu && cmd.subCommands && cmd.subCommands.length > 0;

            return (
              <button
                key={cmd.id}
                data-index={idx}
                onClick={() => {
                  if (hasSubMenu) {
                    setActiveSubMenu(cmd);
                  } else {
                    cmd.execute();
                  }
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2 py-[7px] rounded-lg text-left transition-colors duration-100 group cursor-default",
                  isSelected
                    ? "bg-purple-600 text-white"
                    : "text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800/60"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                    isSelected
                      ? "bg-white/20 text-white"
                      : cmd.colorClass
                  )}
                >
                  {cmd.icon}
                </div>

                {/* Label & Description */}
                <div className="flex flex-col min-w-0 flex-1 gap-px">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[13px] font-semibold truncate leading-tight", isSelected ? "text-white" : "text-gray-900 dark:text-gray-100")}>
                      {cmd.label}
                    </span>
                    <span className={cn("text-[10px] font-mono shrink-0 ml-2", isSelected ? "text-purple-200" : "text-gray-400 dark:text-gray-500")}>
                      {cmd.command}
                    </span>
                  </div>
                  <span className={cn("text-[11px] truncate leading-tight", isSelected ? "text-purple-200" : "text-gray-400 dark:text-gray-500")}>
                    {cmd.description}
                  </span>
                </div>

                <ChevronRight
                  size={12}
                  className={cn(
                    "shrink-0 transition-all",
                    hasSubMenu
                      ? (isSelected ? "opacity-80 text-white translate-x-0.5" : "opacity-40")
                      : (isSelected ? "opacity-80 text-white translate-x-0.5" : "opacity-0")
                  )}
                />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
