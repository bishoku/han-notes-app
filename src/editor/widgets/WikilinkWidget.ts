/**
 * WikilinkWidget.ts — Atomic inline widget for rendering [[Note Title]] links
 * in Live Preview mode. Replaces the entire [[...]] range so cursor cannot get
 * trapped inside brackets, preventing syntax corruption on Enter, Space, or typing.
 */
import { WidgetType, EditorView } from '@codemirror/view';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';

export class WikilinkWidget extends WidgetType {
  target: string;
  display: string;
  from: number;
  to: number;

  constructor(target: string, display: string, from: number, to: number) {
    super();
    this.target = target;
    this.display = display;
    this.from = from;
    this.to = to;
  }

  toDOM(_view: EditorView) {
    const span = document.createElement('span');
    span.className = 'cm-wikilink inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-mac-accent/10 hover:bg-mac-accent/20 text-mac-accent font-semibold text-xs border border-mac-accent/25 cursor-pointer select-none transition-colors align-baseline';
    span.dataset.target = this.target;
    const isPdf = this.target.toLowerCase().includes('.pdf');
    span.title = isPdf
      ? `PDF Dokümanı: ${this.target} (Bölünmüş Okuyucuda Aç)`
      : `Not Bağlantısı: ${this.target} (Açmak için tıkla)`;

    const iconSvg = isPdf
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-red-500 dark:text-red-400">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 opacity-80">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
          <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
        </svg>`;

    span.innerHTML = `
      ${iconSvg}
      <span class="truncate max-w-[240px]">${this.display}</span>
    `;

    span.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    span.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const cleanTitle = this.target.trim();

      // If Wikilink targets a PDF, open in side-by-side Split Reader
      if (cleanTitle.toLowerCase().includes('.pdf')) {
        useUiStore.getState().openPdfSplitReader(cleanTitle);
        return;
      }

      const { notes, selectNote, createNote } = useNoteStore.getState();

      const targetNote = notes.find((n) =>
        n.id.toLowerCase() === cleanTitle.toLowerCase() ||
        n.title.toLowerCase() === cleanTitle.toLowerCase() ||
        n.id.toLowerCase().endsWith(`/${cleanTitle.toLowerCase()}`)
      );

      if (targetNote) {
        selectNote(targetNote.id);
        window.location.hash = `/notes/${encodeURIComponent(targetNote.id)}`;
      } else {
        createNote(cleanTitle).then((newId) => {
          window.location.hash = `/notes/${encodeURIComponent(newId)}`;
        });
      }
      useUiStore.getState().setViewMode('notes');
    };

    return span;
  }

  eq(other: WikilinkWidget) {
    return this.target === other.target && this.display === other.display;
  }
}

export class WebLinkWidget extends WidgetType {
  label: string;
  url: string;
  from: number;
  to: number;

  constructor(label: string, url: string, from: number, to: number) {
    super();
    this.label = label;
    this.url = url;
    this.from = from;
    this.to = to;
  }

  toDOM(_view: EditorView) {
    const a = document.createElement('a');
    a.className = 'cm-weblink inline-flex items-center gap-1 text-mac-accent hover:underline font-medium text-xs cursor-pointer select-none transition-colors align-baseline';
    a.href = this.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = `Web Bağlantısı: ${this.url}`;
    a.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 opacity-80">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
      <span>${this.label || this.url}</span>
    `;

    a.onmouseenter = () => {
      const rect = a.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent('show-link-preview', {
          detail: {
            url: this.url,
            label: this.label,
            rect: {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height,
            },
          },
        })
      );
    };

    a.onmouseleave = () => {
      window.dispatchEvent(new CustomEvent('hide-link-preview'));
    };

    a.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    a.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(this.url, '_blank', 'noopener,noreferrer');
    };

    return a;
  }

  eq(other: WebLinkWidget) {
    return this.url === other.url && this.label === other.label;
  }
}

