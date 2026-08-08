/**
 * ResizableImageWidget.ts — CodeMirror WidgetType for rendering images
 * with drag-to-resize functionality inside the editor.
 */
import { WidgetType, EditorView } from '@codemirror/view';
import { storage } from '@/services/storage';

export class ResizableImageWidget extends WidgetType {
  alt: string;
  width: number | null;
  relPath: string;
  from: number;
  to: number;

  constructor(alt: string, width: number | null, relPath: string, from: number, to: number) {
    super();
    this.alt = alt;
    this.width = width;
    this.relPath = relPath;
    this.from = from;
    this.to = to;
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = 'my-4 inline-block relative group max-w-full select-none';

    const img = document.createElement('img');
    img.alt = this.alt;
    img.className = 'rounded-xl shadow-md border border-gray-200 dark:border-zinc-800 transition-all object-cover block bg-gray-100 dark:bg-zinc-800 min-h-[50px]';
    img.style.width = this.width ? `${this.width}px` : '400px';

    if (this.relPath.startsWith('http') || this.relPath.startsWith('data:')) {
      img.src = this.relPath;
    } else {
      storage.getImageDataUrl(this.relPath)
        .then((dataUrl) => { img.src = dataUrl; })
        .catch((err) => { console.error('Failed to load image data URL:', err); });
    }

    // Resizable drag handle (bottom-right)
    const handle = document.createElement('div');
    handle.className = 'absolute -bottom-1 -right-1 w-4 h-4 bg-mac-accent rounded-full opacity-0 group-hover:opacity-100 cursor-nwse-resize shadow-md transition-opacity border-2 border-white z-10';

    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(100, Math.min(1200, startWidth + deltaX));
      img.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const currentWidth = Math.round(img.getBoundingClientRect().width);
      const cleanAlt = this.alt.split('|')[0];
      const newMarkdown = `![${cleanAlt}|${currentWidth}](${this.relPath})`;

      view.dispatch({
        changes: { from: this.from, to: this.to, insert: newMarkdown },
      });
    };

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startWidth = img.getBoundingClientRect().width;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    wrap.appendChild(img);
    wrap.appendChild(handle);
    return wrap;
  }

  eq(other: ResizableImageWidget) {
    return this.relPath === other.relPath && this.width === other.width && this.alt === other.alt;
  }
}
