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

    // Diagram Edit Button (top-right) if it's a diagram
    let editBtn: HTMLDivElement | null = null;
    const diagramMatch = this.relPath.match(/diagram-([a-z0-9\-]+)\.png$/);
    if (diagramMatch) {
      const diagramId = diagramMatch[1];
      
      editBtn = document.createElement('div');
      editBtn.title = "Diyagramı Düzenle";
      editBtn.className = "absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-zinc-700 shadow-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all hover:scale-105 select-none z-20";
      
      editBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      `;

      editBtn.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };

      editBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('edit-diagram', { detail: diagramId }));
      };

      const onRefresh = (e: Event) => {
        const customEvt = e as CustomEvent<{ diagramId: string; dataUrl?: string }>;
        if (customEvt.detail && customEvt.detail.diagramId === diagramId) {
          if (customEvt.detail.dataUrl) {
            img.src = customEvt.detail.dataUrl;
          } else {
            storage.getImageDataUrl(this.relPath)
              .then((dataUrl) => { img.src = dataUrl; })
              .catch((err) => { console.error('Failed to reload diagram image:', err); });
          }
        }
      };

      window.addEventListener('refresh-diagram-image', onRefresh);
      (wrap as any)._onRefreshCleanup = () => {
        window.removeEventListener('refresh-diagram-image', onRefresh);
      };
    }

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
    if (editBtn) {
      wrap.appendChild(editBtn);
    }
    wrap.appendChild(handle);
    return wrap;
  }

  destroy(dom: HTMLElement) {
    if ((dom as any)._onRefreshCleanup) {
      (dom as any)._onRefreshCleanup();
    }
  }

  eq(other: ResizableImageWidget) {
    return this.relPath === other.relPath && this.width === other.width && this.alt === other.alt;
  }
}
