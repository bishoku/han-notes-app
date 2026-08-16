import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { FormatType } from '@/components/SelectionBubbleMenu';

export interface ActiveFormats {
  isBold: boolean;
  isItalic: boolean;
  isStrikethrough: boolean;
  isHighlight: boolean;
  isCode: boolean;
  color?: string;
  headingLevel: number;
}

interface FormatSpan {
  from: number;
  to: number;
  innerFrom: number;
  innerTo: number;
}

/**
 * Finds all formatted spans of a given delimiter and syntax node name
 * within a search range.
 */
function findSpans(
  view: EditorView,
  searchFrom: number,
  searchTo: number,
  delim: string,
  nodeName?: string
): FormatSpan[] {
  const spans: FormatSpan[] = [];
  const doc = view.state.doc;
  const tree = syntaxTree(view.state);
  const delimLen = delim.length;

  if (nodeName) {
    tree.iterate({
      from: searchFrom,
      to: searchTo,
      enter: (node) => {
        if (node.name === nodeName) {
          spans.push({
            from: node.from,
            to: node.to,
            innerFrom: node.from + delimLen,
            innerTo: node.to - delimLen,
          });
        }
      },
    });
  }

  // Regex scanning as fallback / supplement
  const startLine = doc.lineAt(searchFrom);
  const endLine = doc.lineAt(searchTo);
  const escapedDelim = delim.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`${escapedDelim}(.*?)${escapedDelim}`, 'g');

  for (let l = startLine.number; l <= endLine.number; l++) {
    const line = doc.line(l);
    const text = line.text;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[1].length === 0) continue;
      const matchFrom = line.from + m.index;
      const matchTo = matchFrom + m[0].length;
      if (!spans.some((s) => s.from === matchFrom && s.to === matchTo)) {
        spans.push({
          from: matchFrom,
          to: matchTo,
          innerFrom: matchFrom + delimLen,
          innerTo: matchTo - delimLen,
        });
      }
    }
  }

  spans.sort((a, b) => a.from - b.from);
  return spans;
}

/**
 * Universal toggle formatting engine for inline markdown delimiters (**, *, ~~, ==, `).
 * Elegantly handles partial selections, mixed bold/non-bold selections, and nested spans
 * without producing broken or dangling markdown tokens.
 */
function toggleInlineFormat(
  view: EditorView,
  selection: { from: number; to: number },
  delim: string,
  nodeName: string
): void {
  const { from, to } = selection;
  if (from === to) return;

  const doc = view.state.doc;
  const selectedText = doc.sliceString(from, to);
  const delimLen = delim.length;

  const searchFrom = Math.max(0, from - 300);
  const searchTo = Math.min(doc.length, to + 300);
  const spans = findSpans(view, searchFrom, searchTo, delim, nodeName);

  // Check if selection is fully formatted (100% inside this format)
  const isDirectlyWrapped =
    (selectedText.startsWith(delim) && selectedText.endsWith(delim) && selectedText.length >= delimLen * 2) ||
    (from >= delimLen && doc.sliceString(from - delimLen, from) === delim && doc.sliceString(to, to + delimLen) === delim);

  const enclosingSpan = spans.find((s) => s.innerFrom <= from && s.innerTo >= to);
  const isFullyFormatted = isDirectlyWrapped || !!enclosingSpan;

  if (isFullyFormatted) {
    // ── UN-FORMAT ──
    if (selectedText.startsWith(delim) && selectedText.endsWith(delim) && selectedText.length >= delimLen * 2) {
      const rep = selectedText.slice(delimLen, -delimLen);
      view.dispatch({
        changes: { from, to, insert: rep },
        selection: { anchor: from, head: from + rep.length },
      });
      view.focus();
      return;
    }

    if (from >= delimLen && doc.sliceString(from - delimLen, from) === delim && doc.sliceString(to, to + delimLen) === delim) {
      view.dispatch({
        changes: { from: from - delimLen, to: to + delimLen, insert: selectedText },
        selection: { anchor: from - delimLen, head: from - delimLen + selectedText.length },
      });
      view.focus();
      return;
    }

    if (enclosingSpan) {
      const beforeText = doc.sliceString(enclosingSpan.innerFrom, from);
      const afterText = doc.sliceString(to, enclosingSpan.innerTo);
      const cleanSelected = selectedText.replaceAll(delim, '');

      let rep = '';
      if (beforeText.length > 0) {
        rep += `${delim}${beforeText}${delim}`;
      }
      rep += cleanSelected;
      if (afterText.length > 0) {
        rep += `${delim}${afterText}${delim}`;
      }

      view.dispatch({
        changes: { from: enclosingSpan.from, to: enclosingSpan.to, insert: rep },
        selection: {
          anchor: enclosingSpan.from + (beforeText.length > 0 ? beforeText.length + delimLen * 2 : 0),
          head: enclosingSpan.from + (beforeText.length > 0 ? beforeText.length + delimLen * 2 : 0) + cleanSelected.length,
        },
      });
      view.focus();
      return;
    }
  } else {
    // ── MAKE 100% FORMATTED (Merge & Clean internal/overlapping delimiters) ──
    const overlappingSpans = spans.filter((s) => s.from < to && s.to > from);

    let replaceFrom = from;
    let replaceTo = to;

    if (overlappingSpans.length > 0) {
      const first = overlappingSpans[0];
      const last = overlappingSpans[overlappingSpans.length - 1];
      replaceFrom = Math.min(from, first.from);
      replaceTo = Math.max(to, last.to);
    }

    const rawText = doc.sliceString(replaceFrom, replaceTo);
    const cleanText = rawText.replaceAll(delim, '');
    const rep = `${delim}${cleanText}${delim}`;

    view.dispatch({
      changes: { from: replaceFrom, to: replaceTo, insert: rep },
      selection: { anchor: replaceFrom, head: replaceFrom + rep.length },
    });
    view.focus();
    return;
  }
}

/**
 * Inspects the current selection in the CodeMirror editor to determine
 * which text formats (bold, italic, strike, highlight, code, color, heading)
 * are currently active across the selection.
 */
export function getActiveFormats(
  view: EditorView,
  from: number,
  to: number
): ActiveFormats {
  const doc = view.state.doc;
  const selectedText = doc.sliceString(from, to);

  const checkFormatActive = (delim: string, nodeName: string): boolean => {
    const delimLen = delim.length;
    if (selectedText.startsWith(delim) && selectedText.endsWith(delim) && selectedText.length >= delimLen * 2) {
      return true;
    }
    if (from >= delimLen && doc.sliceString(from - delimLen, from) === delim && doc.sliceString(to, to + delimLen) === delim) {
      return true;
    }
    const spans = findSpans(view, Math.max(0, from - 200), Math.min(doc.length, to + 200), delim, nodeName);
    return spans.some((s) => s.innerFrom <= from && s.innerTo >= to);
  };

  const isBold = checkFormatActive('**', 'StrongEmphasis');
  const isItalic = checkFormatActive('*', 'Emphasis');
  const isStrikethrough = checkFormatActive('~~', 'Strikethrough');
  const isHighlight = checkFormatActive('==', 'Highlight');
  const isCode = checkFormatActive('`', 'InlineCode');

  // Heading detection on current line
  const line = doc.lineAt(from);
  const hMatch = line.text.match(/^(#{1,4})\s+/);
  const headingLevel = hMatch ? hMatch[1].length : 0;

  // Color span check
  let color: string | undefined;
  const spanMatch = selectedText.match(/<span\s+style=["']color:\s*([^"';]+)[^"']*["']>([\s\S]*?)<\/span>/i);
  if (spanMatch) {
    color = spanMatch[1].trim();
  } else {
    const lineText = line.text;
    const offsetInLine = from - line.from;
    const beforeText = lineText.slice(0, offsetInLine);
    const afterText = lineText.slice(to - line.from);
    const openSpanMatch = beforeText.match(/<span\s+style=["']color:\s*([^"';]+)[^"']*["']>[^<]*$/i);
    const closeSpanMatch = afterText.match(/^[^<]*<\/span>/i);
    if (openSpanMatch && closeSpanMatch) {
      color = openSpanMatch[1].trim();
    }
  }

  return {
    isBold,
    isItalic,
    isStrikethrough,
    isHighlight,
    isCode,
    color,
    headingLevel,
  };
}

/**
 * Applies Markdown text formatting or inline styling transformations
 * to the currently selected text range in the CodeMirror view with
 * intelligent toggle (Word-like WYSIWYG un-formatting).
 */
export function applyTextFormat(
  view: EditorView,
  selection: { from: number; to: number },
  type: FormatType,
  payload?: string
): void {
  const { from, to } = selection;
  if (from === to) return;

  const doc = view.state.doc;
  const selectedText = doc.sliceString(from, to);

  switch (type) {
    case 'bold': {
      toggleInlineFormat(view, selection, '**', 'StrongEmphasis');
      return;
    }

    case 'italic': {
      toggleInlineFormat(view, selection, '*', 'Emphasis');
      return;
    }

    case 'strikethrough': {
      toggleInlineFormat(view, selection, '~~', 'Strikethrough');
      return;
    }

    case 'highlight': {
      toggleInlineFormat(view, selection, '==', 'Highlight');
      return;
    }

    case 'code': {
      toggleInlineFormat(view, selection, '`', 'InlineCode');
      return;
    }

    case 'color': {
      const cleanText = selectedText.replace(/<\/?span[^>]*>/gi, '');
      if (!payload) {
        // Clear color
        view.dispatch({
          changes: { from, to, insert: cleanText },
          selection: { anchor: from, head: from + cleanText.length },
        });
      } else {
        const replacement = `<span style="color: ${payload}">${cleanText}</span>`;
        view.dispatch({
          changes: { from, to, insert: replacement },
          selection: { anchor: from, head: from + replacement.length },
        });
      }
      view.focus();
      return;
    }

    case 'heading': {
      const line = doc.lineAt(from);
      const level = parseInt(payload || '1', 10);
      const cleanLineText = line.text.replace(/^(#{1,6}\s+|>\s*)/, '');
      const newPrefix = level > 0 ? '#'.repeat(level) + ' ' : '';
      const newLineText = newPrefix + cleanLineText;

      view.dispatch({
        changes: { from: line.from, to: line.to, insert: newLineText },
        selection: { anchor: line.from + newLineText.length },
      });
      view.focus();
      return;
    }

    case 'quote': {
      const line = doc.lineAt(from);
      if (line.text.startsWith('> ')) {
        const newLineText = line.text.slice(2);
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: newLineText },
          selection: { anchor: line.from + newLineText.length },
        });
      } else {
        const newLineText = `> ${line.text}`;
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: newLineText },
          selection: { anchor: line.from + newLineText.length },
        });
      }
      view.focus();
      return;
    }

    case 'callout': {
      const line = doc.lineAt(from);
      const typeTag = payload || 'NOTE';
      const cleanLineText = line.text.replace(/^>\s*\[![A-Z]+\]\s*|^>\s*|^#{1,6}\s*/i, '');
      const newLineText = `> [!${typeTag}] ${cleanLineText || selectedText}\n> `;

      view.dispatch({
        changes: { from: line.from, to: line.to, insert: newLineText },
        selection: { anchor: line.from + newLineText.length },
      });
      view.focus();
      return;
    }

    case 'link': {
      const url = payload || 'https://';
      const replacement = `[${selectedText}](${url})`;
      view.dispatch({
        changes: { from, to, insert: replacement },
        selection: { anchor: from, head: from + replacement.length },
      });
      view.focus();
      return;
    }

    case 'wikilink': {
      if (selectedText.startsWith('[[') && selectedText.endsWith(']]')) {
        const replacement = selectedText.slice(2, -2);
        view.dispatch({
          changes: { from, to, insert: replacement },
          selection: { anchor: from, head: from + replacement.length },
        });
      } else if (from >= 2 && doc.sliceString(from - 2, from) === '[[' && doc.sliceString(to, to + 2) === ']]') {
        view.dispatch({
          changes: { from: from - 2, to: to + 2, insert: selectedText },
          selection: { anchor: from - 2, head: from - 2 + selectedText.length },
        });
      } else {
        const replacement = `[[${selectedText}]]`;
        view.dispatch({
          changes: { from, to, insert: replacement },
          selection: { anchor: from, head: from + replacement.length },
        });
      }
      view.focus();
      return;
    }

    default:
      return;
  }
}


