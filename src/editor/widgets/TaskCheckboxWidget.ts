/**
 * TaskCheckboxWidget.ts — Interactive macOS/Notion style checkbox widget
 * for task lines (- [ ] and - [x]) in Live Preview mode.
 */
import { WidgetType, EditorView } from '@codemirror/view';

export class TaskCheckboxWidget extends WidgetType {
  checked: boolean;
  boxFrom: number;
  boxTo: number;

  constructor(checked: boolean, boxFrom: number, boxTo: number) {
    super();
    this.checked = checked;
    this.boxFrom = boxFrom;
    this.boxTo = boxTo;
  }

  toDOM(view: EditorView) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.tabIndex = -1;
    btn.className = `cm-task-checkbox inline-flex items-center justify-center w-4 h-4 rounded-[4.5px] mr-1.5 align-middle select-none transition-all cursor-pointer shrink-0 ${
      this.checked
        ? 'bg-mac-accent text-white border-2 border-mac-accent shadow-xs'
        : 'bg-white/90 dark:bg-zinc-800 border-2 border-gray-300 dark:border-zinc-500 hover:border-mac-accent hover:bg-mac-accent/10 shadow-2xs'
    }`;
    btn.title = this.checked ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle';

    if (this.checked) {
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;
    }

    btn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const doc = view.state.doc;
      if (this.boxFrom >= 0 && this.boxFrom <= doc.length) {
        const line = doc.lineAt(Math.min(this.boxFrom, doc.length));
        const match = line.text.match(/^(\s*(?:[-*+]\s+)?)\[([ xX])\]/);
        if (match) {
          const bracketIdx = line.text.indexOf('[');
          const from = line.from + bracketIdx;
          const to = from + 3;
          const currentIsChecked = match[2].toLowerCase() === 'x';
          const nextBoxText = currentIsChecked ? '[ ]' : '[x]';
          view.dispatch({
            changes: { from, to, insert: nextBoxText },
          });
          return;
        }
      }

      if (this.boxFrom >= 0 && this.boxTo <= doc.length) {
        const nextBoxText = this.checked ? '[ ]' : '[x]';
        view.dispatch({
          changes: { from: this.boxFrom, to: this.boxTo, insert: nextBoxText },
        });
      }
    };

    return btn;
  }

  eq(other: TaskCheckboxWidget) {
    return this.checked === other.checked && this.boxFrom === other.boxFrom && this.boxTo === other.boxTo;
  }
}
