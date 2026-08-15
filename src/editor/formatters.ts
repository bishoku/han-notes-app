import { EditorView } from '@codemirror/view';
import type { FormatType } from '@/components/SelectionBubbleMenu';

/**
 * Applies Markdown text formatting or inline styling transformations
 * to the currently selected text range in the CodeMirror view.
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

  let replacement = '';

  switch (type) {
    case 'bold': {
      if (selectedText.startsWith('**') && selectedText.endsWith('**') && selectedText.length >= 4) {
        replacement = selectedText.slice(2, -2);
      } else {
        replacement = `**${selectedText}**`;
      }
      break;
    }
    case 'italic': {
      if (selectedText.startsWith('*') && selectedText.endsWith('*') && !selectedText.startsWith('**') && selectedText.length >= 2) {
        replacement = selectedText.slice(1, -1);
      } else {
        replacement = `*${selectedText}*`;
      }
      break;
    }
    case 'strikethrough': {
      if (selectedText.startsWith('~~') && selectedText.endsWith('~~') && selectedText.length >= 4) {
        replacement = selectedText.slice(2, -2);
      } else {
        replacement = `~~${selectedText}~~`;
      }
      break;
    }
    case 'highlight': {
      if (selectedText.startsWith('==') && selectedText.endsWith('==') && selectedText.length >= 4) {
        replacement = selectedText.slice(2, -2);
      } else {
        replacement = `==${selectedText}==`;
      }
      break;
    }
    case 'code': {
      if (selectedText.startsWith('`') && selectedText.endsWith('`') && selectedText.length >= 2) {
        replacement = selectedText.slice(1, -1);
      } else {
        replacement = `\`${selectedText}\``;
      }
      break;
    }
    case 'color': {
      if (!payload) {
        const spanMatch = selectedText.match(/^<span[^>]*style="color:\s*[^"]*"[^>]*>([\s\S]*?)<\/span>$/i);
        if (spanMatch) {
          replacement = spanMatch[1];
        } else {
          replacement = selectedText;
        }
      } else {
        replacement = `<span style="color: ${payload}">${selectedText}</span>`;
      }
      break;
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
      const cleanLineText = line.text.replace(/^>\s*\[\![A-Z]+\]\s*|^>\s*|^#{1,6}\s*/i, '');
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
      replacement = `[${selectedText}](${url})`;
      break;
    }
    case 'wikilink': {
      if (selectedText.startsWith('[[') && selectedText.endsWith(']]')) {
        replacement = selectedText.slice(2, -2);
      } else {
        replacement = `[[${selectedText}]]`;
      }
      break;
    }
    default:
      return;
  }

  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: { anchor: from, head: from + replacement.length },
  });
  view.focus();
}
