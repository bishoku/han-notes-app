/**
 * DecisionPrefixWidget.ts — Decorative decision badge/icon widget for
 * decision lines (- [D]) in Live Preview mode.
 */
import { WidgetType, EditorView } from '@codemirror/view';

export class DecisionPrefixWidget extends WidgetType {
  toDOM(_view: EditorView) {
    const span = document.createElement('span');
    span.className = 'cm-decision-prefix inline-flex items-center justify-center w-5 h-5 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 mr-1.5 align-middle select-none shadow-2xs shrink-0';
    span.title = 'Karar Kaydı (Decision Record)';

    span.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>
        <path d="m9 12 2 2 4-4"/>
      </svg>
    `;

    span.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    return span;
  }

  eq(_other: DecisionPrefixWidget) {
    return true;
  }
}
