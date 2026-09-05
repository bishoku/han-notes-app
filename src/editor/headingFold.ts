/**
 * headingFold.ts — High-performance heading fold service for CodeMirror 6.
 * Folds from the end of a heading line down to the next heading of equal or higher level.
 * Operates without gutter overhead (0 reflow cost).
 */
import { foldService, codeFolding, foldEffect, unfoldEffect, foldedRanges } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';

export const markdownHeadingFoldService = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart);
  const match = line.text.match(/^(#{1,6})\s+/);
  if (!match) return null;
  const level = match[1].length;
  let endPos = state.doc.length;
  for (let l = line.number + 1; l <= state.doc.lines; l++) {
    const nextLine = state.doc.line(l);
    const nextMatch = nextLine.text.match(/^(#{1,6})\s+/);
    if (nextMatch && nextMatch[1].length <= level) {
      endPos = nextLine.from - 1;
      break;
    }
  }
  if (endPos > line.to) {
    return { from: line.to, to: endPos };
  }
  return null;
});

/**
 * Toggles fold state for a heading line at targetPos.
 */
export function toggleHeadingFoldAt(view: EditorView, pos: number): boolean {
  const line = view.state.doc.lineAt(pos);
  const match = line.text.match(/^(#{1,6})\s+/);
  if (!match) return false;

  const folds = foldedRanges(view.state);
  let isFolded = false;
  folds.between(line.to, line.to + 1, (from, _to) => {
    if (from === line.to) {
      isFolded = true;
    }
  });

  if (isFolded) {
    view.dispatch({
      effects: unfoldEffect.of({ from: line.to, to: view.state.doc.length }),
    });
    return true;
  } else {
    // Calculate fold range
    const level = match[1].length;
    let endPos = view.state.doc.length;
    for (let l = line.number + 1; l <= view.state.doc.lines; l++) {
      const nextLine = view.state.doc.line(l);
      const nextMatch = nextLine.text.match(/^(#{1,6})\s+/);
      if (nextMatch && nextMatch[1].length <= level) {
        endPos = nextLine.from - 1;
        break;
      }
    }
    if (endPos > line.to) {
      view.dispatch({
        effects: foldEffect.of({ from: line.to, to: endPos }),
      });
      return true;
    }
  }
  return false;
}

export const headingFolding = () => [codeFolding(), markdownHeadingFoldService];
