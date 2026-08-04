/**
 * useEditorFloatingUI.ts — Custom hook for managing all floating UI elements
 * in the CodeMirror editor: block menu (+), task edit button, decision edit button,
 * slash command menu, and related popover states.
 *
 * Extracts the entire `onUpdate` callback logic from MainEditor, eliminating
 * duplicated coordinate calculations and reducing the component's complexity.
 */
import { useState, useRef, useCallback } from 'react';
import type { ViewUpdate } from '@codemirror/view';

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
   * Hides all floating buttons/menus. Called when cursor moves to an unrecognized line type.
   */
  const hideAll = useCallback(() => {
    setMenuPos(prev => prev.show ? { ...prev, show: false } : prev);
    setTaskEditBtn(prev => prev.show ? { ...prev, show: false } : prev);
    setDecisionEditBtn(prev => prev.show ? { ...prev, show: false } : prev);
    setShowOptions(false);
    setShowNotePicker(false);
  }, []);

  /**
   * Main CodeMirror `onUpdate` handler. Detects the current line type and shows
   * the appropriate floating UI element.
   */
  const handleEditorUpdate = useCallback((update: ViewUpdate) => {
    if (!update.selectionSet && !update.docChanged && !update.geometryChanged) return;

    const head = update.state.selection.main.head;
    const line = update.state.doc.lineAt(head);
    const lineNumber = line.number - 1;

    // ── 1. Slash Command Trigger ──
    const textBeforeHead = line.text.slice(0, head - line.from);
    const slashMatch = textBeforeHead.match(SLASH_TRIGGER_RE);

    if (slashMatch) {
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

    // ── 2. Line-type detection for floating buttons ──
    const lineText = line.text;

    if (lineText.trim() === '') {
      // Empty line → show block menu (+)
      const top = getRelativeTop(update, line.from);
      if (top !== null) {
        setMenuPos({ top, show: true, lineFrom: line.from });
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
  }, [getRelativeTop, hideAll]);

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

    // Slash menu
    slashMenuState,
    setSlashMenuState,
    slashStateRef,

    // onUpdate handler
    handleEditorUpdate,
  };
}
