/**
 * pastePlugin.ts — CodeMirror 6 plugin for smart rich-text paste handling.
 * Automatically converts pasted HTML (Medium articles, web pages, Google Docs) into Markdown.
 */
import { EditorView } from '@codemirror/view';
import { htmlToMarkdown, isMeaningfulHtml } from './htmlToMarkdown';

export const smartPastePlugin = EditorView.domEventHandlers({
  paste(event: ClipboardEvent, view: EditorView) {
    // If Shift key is pressed (e.g. Cmd+Shift+V / Ctrl+Shift+V), allow default plain text paste
    if ((event as any).shiftKey) {
      return false;
    }

    const clipboardData = event.clipboardData;
    if (!clipboardData) return false;

    const html = clipboardData.getData('text/html');

    // If there is no rich HTML or it doesn't contain structural tags, let CodeMirror handle it
    if (!html || !isMeaningfulHtml(html)) {
      return false;
    }

    try {
      const markdown = htmlToMarkdown(html);
      if (!markdown) {
        return false;
      }

      // Insert converted Markdown into CodeMirror at current cursor/selection
      const selection = view.state.selection.main;
      view.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: markdown,
        },
        selection: { anchor: selection.from + markdown.length },
        scrollIntoView: true,
      });

      event.preventDefault();
      return true;
    } catch (err) {
      console.warn('Smart paste conversion failed, falling back to default paste:', err);
      return false;
    }
  },
});
