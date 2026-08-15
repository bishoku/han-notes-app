/**
 * ResizableImageWidget.ts — Ultra-performant CodeMirror WidgetType for rendering
 * images, diagrams, and sketches with 60/120 FPS hardware-accelerated drag-to-resize,
 * DOM reuse (updateDOM), and floating action toolbar (Edit / Delete).
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
    wrap.dataset.relPath = this.relPath;

    const img = document.createElement('img');
    img.alt = this.alt;
    // Note: Never add transition-all/transition-width to img, as it fights drag events and causes heavy stutter
    img.className = 'rounded-xl shadow-md border border-gray-200 dark:border-zinc-800 object-cover block bg-gray-100 dark:bg-zinc-800 min-h-[50px] will-change-transform';
    img.style.width = this.width ? `${this.width}px` : '400px';

    if (this.relPath.startsWith('http') || this.relPath.startsWith('data:')) {
      img.src = this.relPath;
    } else {
      storage.getImageDataUrl(this.relPath)
        .then((dataUrl) => { img.src = dataUrl; })
        .catch((err) => { console.error('Failed to load image data URL:', err); });
    }

    // Floating Action Toolbar (top-right)
    const toolbar = document.createElement('div');
    toolbar.className = 'absolute -top-3.5 right-2 flex items-center gap-1 p-0.5 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md border border-gray-200 dark:border-zinc-700 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 select-none';

    const diagramMatch = this.relPath.match(/(diagram|sketch)-([a-z0-9\-]+)\.png$/);
    const isDiagramOrSketch = !!diagramMatch;

    // Edit Button (for diagrams & sketches)
    if (diagramMatch) {
      const isSketch = diagramMatch[1] === 'sketch';
      const diagramId = `${diagramMatch[1]}-${diagramMatch[2]}`;

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.title = isSketch ? "Serbest Çizimi Düzenle (Excalidraw)" : "Diyagramı Düzenle (YADA)";
      editBtn.className = `w-7 h-7 flex items-center justify-center rounded-full ${
        isSketch
          ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/50'
          : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
      } transition-colors cursor-pointer`;

      editBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          <path d="m15 5 4 4"/>
        </svg>
      `;

      editBtn.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };

      editBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('edit-diagram', {
          detail: { id: diagramId, relPath: this.relPath }
        }));
      };

      toolbar.appendChild(editBtn);

      const onRefresh = (e: Event) => {
        const customEvt = e as CustomEvent<{ diagramId: string; dataUrl?: string }>;
        if (customEvt.detail && (customEvt.detail.diagramId === diagramId || customEvt.detail.diagramId === diagramMatch[2])) {
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

    // Delete Button (for all images, diagrams, and sketches)
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.title = isDiagramOrSketch ? "Çizimi Not'tan Kaldır" : "Görseli Kaldır";
    deleteBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer';

    deleteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"/>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        <line x1="10" x2="10" y1="11" y2="17"/>
        <line x1="14" x2="14" y1="11" y2="17"/>
      </svg>
    `;

    deleteBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const doc = view.state.doc;
      let deleteFrom = -1;
      let deleteTo = -1;

      // Find the exact line in the live document containing this relative path
      for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        if (line.text.includes(this.relPath)) {
          deleteFrom = line.from;
          deleteTo = line.to;

          // If preceding line is a legacy diagram comment: <!-- diagram:... -->
          if (i > 1) {
            const prevLine = doc.line(i - 1);
            if (/<!--\s*diagram:.*-->/.test(prevLine.text.trim())) {
              deleteFrom = prevLine.from;
            }
          }

          // Clean up newline
          if (deleteTo < doc.length) {
            deleteTo += 1;
          } else if (deleteFrom > 0) {
            deleteFrom -= 1;
          }
          break;
        }
      }

      // Fallback to widget offsets
      if (deleteFrom === -1) {
        deleteFrom = this.from;
        deleteTo = this.to;
      }

      window.dispatchEvent(
        new CustomEvent('request-delete-image', {
          detail: {
            from: deleteFrom,
            to: deleteTo,
            isDiagram: isDiagramOrSketch,
            relPath: this.relPath,
            alt: this.alt,
          },
        })
      );
    };

    toolbar.appendChild(deleteBtn);
    wrap.appendChild(toolbar);

    // Resizable drag handle (bottom-right)
    const handle = document.createElement('div');
    handle.className = 'absolute -bottom-1 -right-1 w-4 h-4 bg-mac-accent rounded-full opacity-0 group-hover:opacity-100 cursor-nwse-resize shadow-md transition-opacity duration-150 border-2 border-white z-10';

    let startX = 0;
    let startWidth = 0;
    let targetWidth = 0;
    let rafId: number | null = null;

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      targetWidth = Math.max(80, Math.min(1600, startWidth + deltaX));
      
      // Use requestAnimationFrame to eliminate lag and synchronize with screen refresh
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          img.style.width = `${targetWidth}px`;
          rafId = null;
        });
      }
    };

    const onMouseUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      const finalWidth = Math.round(targetWidth || img.getBoundingClientRect().width);
      const cleanAlt = this.alt.split('|')[0];
      const newMarkdown = `![${cleanAlt}|${finalWidth}](${this.relPath})`;

      // Scan live document for exact matching markdown image syntax
      const doc = view.state.doc;
      let matchFrom = -1;
      let matchTo = -1;
      for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        if (line.text.includes(this.relPath)) {
          const lineText = line.text;
          const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
          let m;
          while ((m = imgRegex.exec(lineText)) !== null) {
            if (m[2].trim() === this.relPath.trim() || m[2].includes(this.relPath) || this.relPath.includes(m[2])) {
              matchFrom = line.from + m.index;
              matchTo = matchFrom + m[0].length;
              break;
            }
          }
          if (matchFrom !== -1) break;
        }
      }

      if (matchFrom === -1) {
        matchFrom = this.from;
        matchTo = this.to;
      }

      view.dispatch({
        changes: { from: matchFrom, to: matchTo, insert: newMarkdown },
      });
    };

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startWidth = img.getBoundingClientRect().width;
      targetWidth = startWidth;
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    wrap.appendChild(img);
    wrap.appendChild(handle);
    return wrap;
  }

  /**
   * CodeMirror optimization: update existing DOM node instead of destroying
   * and recreating it when widget width or attributes update.
   */
  updateDOM(dom: HTMLElement, _view: EditorView): boolean {
    if (dom.dataset.relPath !== this.relPath) {
      return false;
    }
    const img = dom.querySelector('img');
    if (img) {
      img.style.width = this.width ? `${this.width}px` : '400px';
      img.alt = this.alt;
      return true;
    }
    return false;
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
