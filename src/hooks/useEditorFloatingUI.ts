/**
 * useEditorFloatingUI.ts — Custom hook for managing all floating UI elements
 * in the CodeMirror editor: block menu (+), task edit button, decision edit button,
 * slash command menu, and selection bubble menu (Medium / Notion style).
 */
import { useState, useRef, useCallback } from 'react';
import type { ViewUpdate } from '@codemirror/view';
import type { SelectionBubbleState } from '@/components/SelectionBubbleMenu';
import { getActiveFormats } from '@/editor/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FloatingButtonState {
  top: number;
  show: boolean;
  lineNumber: number;
  lineText: string;
}

export interface BlockMenuState {
  top: number;
  show: boolean;
  lineFrom: number;
}

export interface SlashMenuState {
  show: boolean;
  query: string;
  slashFrom: number;
  slashTo: number;
  anchorRect: { top: number; left: number; bottom: number };
}

const INITIAL_BUTTON: FloatingButtonState = { top: 0, show: false, lineNumber: 0, lineText: '' };
const INITIAL_BLOCK_MENU: BlockMenuState = { top: 0, show: false, lineFrom: 0 };
const INITIAL_SLASH: SlashMenuState = {
  show: false,
  query: '',
  slashFrom: 0,
  slashTo: 0,
  anchorRect: { top: 0, left: 0, bottom: 0 },
};
const INITIAL_BUBBLE: SelectionBubbleState = {
  show: false,
  top: 0,
  left: 0,
  from: 0,
  to: 0,
  selectedText: '',
};

// ─── Line type detection regexes (hoisted for performance) ───────────────────

const TASK_LINE_RE = /^\s*-\s*\[([ xX])\]\s+/;
const DECISION_LINE_RE = /^\s*-\s*\[[Dd]\]\s+/;
const SLASH_TRIGGER_RE = /(?:^|\s)\/([a-zA-Z0-9_-]*)$/;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useEditorFloatingUI(wrapperRef: React.RefObject<HTMLDivElement | null>) {
  // Block menu (+) button
  const [menuPos, setMenuPos] = useState<BlockMenuState>(INITIAL_BLOCK_MENU);
  const [showOptions, setShowOptions] = useState(false);
  const [showNotePicker, setShowNotePicker] = useState(false);

  // Task & Decision floating edit buttons
  const [taskEditBtn, setTaskEditBtn] = useState<FloatingButtonState>(INITIAL_BUTTON);
  const [decisionEditBtn, setDecisionEditBtn] = useState<FloatingButtonState>(INITIAL_BUTTON);

  // Selection Bubble Menu (Medium / Notion style)
  const [selectionBubble, setSelectionBubble] = useState<SelectionBubbleState>(INITIAL_BUBBLE);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slash command menu
  const [slashMenuState, setSlashMenuState] = useState<SlashMenuState>(INITIAL_SLASH);
  const slashStateRef = useRef<SlashMenuState>(INITIAL_SLASH);
  slashStateRef.current = slashMenuState;

  /**
   * Calculates position relative to the editor wrapper for absolute-positioned elements.
   * Returns null if coordinates can't be determined.
   */
  const getRelativeTop = useCallback((update: ViewUpdate, pos: number): number | null => {
    const coords = update.view.coordsAtPos(pos);
    const wrapperDOM = wrapperRef.current?.getBoundingClientRect();
    if (!coords || !wrapperDOM) return null;
    return coords.top - wrapperDOM.top + 4;
  }, [wrapperRef]);

  /**
   * Hides all line-based floating buttons/menus.
   */
  const hideAll = useCallback(() => {
    setMenuPos(prev => prev.show ? { ...prev, show: false } : prev);
    setTaskEditBtn(prev => prev.show ? { ...prev, show: false } : prev);
    setDecisionEditBtn(prev => prev.show ? { ...prev, show: false } : prev);
    setShowOptions(false);
    setShowNotePicker(false);
  }, []);

  /**
   * Main CodeMirror `onUpdate` handler. Detects current selection and line type.
   */
  const handleEditorUpdate = useCallback((update: ViewUpdate) => {
    if (!update.selectionSet && !update.docChanged && !update.geometryChanged) return;

    const sel = update.state.selection.main;

    // ── 1. Selection Bubble Menu (Medium / Notion Style with 60ms debounce) ──
    if (bubbleTimerRef.current) {
      clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = null;
    }

    if (!sel.empty) {
      const from = sel.from;
      const to = sel.to;
      const selectedText = update.state.sliceDoc(from, to);

      if (selectedText.trim().length > 0) {
        // Wait 60ms after selection finishes moving before displaying bubble menu
        bubbleTimerRef.current = setTimeout(() => {
          const coordsFrom = update.view.coordsAtPos(from);
          const coordsTo = update.view.coordsAtPos(to);
          const wrapperDOM = wrapperRef.current?.getBoundingClientRect();

          if (coordsFrom && coordsTo && wrapperDOM) {
            const top = Math.min(coordsFrom.top, coordsTo.top) - wrapperDOM.top;
            const left = (coordsFrom.left + coordsTo.right) / 2 - wrapperDOM.left;
            const activeFormats = getActiveFormats(update.view, from, to);
            setSelectionBubble({
              show: true,
              top,
              left,
              from,
              to,
              selectedText,
              activeFormats,
            });
          }
        }, 60);
      } else {
        setSelectionBubble(prev => prev.show ? { ...prev, show: false } : prev);
      }
    } else {
      setSelectionBubble(prev => prev.show ? { ...prev, show: false } : prev);
    }

    const head = sel.head;
    const line = update.state.doc.lineAt(head);
    const lineNumber = line.number - 1;

    // ── 2. Slash Command Trigger ──
    const textBeforeHead = line.text.slice(0, head - line.from);
    const slashMatch = textBeforeHead.match(SLASH_TRIGGER_RE);

    if (slashMatch && sel.empty) {
      const slashOffset = textBeforeHead.lastIndexOf('/');
      const slashPos = line.from + slashOffset;
      const coords = update.view.coordsAtPos(slashPos);
      if (coords && coords.left > 0 && coords.top > 0) {
        setSlashMenuState({
          show: true,
          query: slashMatch[1],
          slashFrom: slashPos,
          slashTo: head,
          anchorRect: { top: coords.top, left: coords.left, bottom: coords.bottom },
        });
      }
    } else if (slashStateRef.current.show) {
      setSlashMenuState(prev => ({ ...prev, show: false }));
    }

    // ── 3. Line-type detection for floating buttons (+, Task, Decision) ──
    if (!sel.empty) {
      hideAll();
      return;
    }

    const lineText = line.text;

    if (lineText.trim() === '') {
      // Empty line → show block menu (+)
      const top = getRelativeTop(update, line.from);
      if (top !== null) {
        setMenuPos(prev => {
          if (prev.lineFrom !== line.from) {
            setShowOptions(false);
            setShowNotePicker(false);
          }
          return { top, show: true, lineFrom: line.from };
        });
        setTaskEditBtn(prev => prev.show ? { ...prev, show: false } : prev);
        setDecisionEditBtn(prev => prev.show ? { ...prev, show: false } : prev);
        return;
      }
    } else if (TASK_LINE_RE.test(lineText)) {
      // Task line → show task edit button
      const top = getRelativeTop(update, line.from);
      if (top !== null) {
        setTaskEditBtn({ top, show: true, lineNumber, lineText });
        setDecisionEditBtn(prev => prev.show ? { ...prev, show: false } : prev);
        setMenuPos(prev => prev.show ? { ...prev, show: false } : prev);
        return;
      }
    } else if (DECISION_LINE_RE.test(lineText) || lineText.includes('<!-- decision:')) {
      // Decision line → show decision edit button
      const top = getRelativeTop(update, line.from);
      if (top !== null) {
        setDecisionEditBtn({ top, show: true, lineNumber, lineText });
        setTaskEditBtn(prev => prev.show ? { ...prev, show: false } : prev);
        setMenuPos(prev => prev.show ? { ...prev, show: false } : prev);
        return;
      }
    }

    // No match → hide everything
    hideAll();
  }, [getRelativeTop, hideAll, wrapperRef]);

  return {
    // Block menu
    menuPos,
    showOptions,
    setShowOptions,
    showNotePicker,
    setShowNotePicker,

    // Floating buttons
    taskEditBtn,
    decisionEditBtn,

    // Selection bubble menu
    selectionBubble,
    setSelectionBubble,

    // Slash menu
    slashMenuState,
    setSlashMenuState,
    slashStateRef,

    // onUpdate handler
    handleEditorUpdate,
  };
}
