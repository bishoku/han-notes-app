/**
 * ResizableImageWidget.ts — Ultra-performant CodeMirror WidgetType for rendering
 * images, diagrams, and sketches with:
 * - 60/120 FPS hardware-accelerated drag-to-resize
 * - DOM reuse (updateDOM)
 * - Live Interactive YADA Simulation toggle (Embed Mode with auto-play)
 * - Floating action toolbar (Play / Edit / Delete)
 */
import { WidgetType, EditorView } from '@codemirror/view';
import LZString from 'lz-string';
import { storage } from '@/services/storage';
import { extractPngMetadata, YADA_METADATA_KEYWORD } from '@/utils/pngMetadata';
import { useUiStore } from '@/store/uiStore';

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

  get estimatedHeight(): number {
    const w = this.width || 400;
    return Math.min(650, Math.max(180, Math.round(w * 0.62)));
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = 'my-4 inline-block relative group max-w-full select-none';
    wrap.dataset.relPath = this.relPath;

    const img = document.createElement('img');
    img.alt = this.alt;
    img.className = 'rounded-xl shadow-md border border-gray-200 dark:border-zinc-800 block bg-gray-100 dark:bg-zinc-800 will-change-transform max-w-full h-auto';
    img.style.width = this.width ? `${this.width}px` : '400px';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';

    img.onload = () => {
      view.requestMeasure();
    };

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

    const diagramMatch = this.relPath.match(/(diagram|sketch)-([a-z0-9-]+)\.png$/);
    const isDiagramOrSketch = !!diagramMatch;
    const isYadaDiagram = diagramMatch ? diagramMatch[1] === 'diagram' : false;

    let isSimulation = false;
    let iframe: HTMLIFrameElement | null = null;

    // Helper to generate the YADA Embed URL from embedded PNG metadatata
    const getYadaEmbedUrl = async (): Promise<string> => {
      const YADA_URL = (import.meta as any).env?.VITE_YADA_URL || 'https://bishoku.github.io/yada/';
      const { theme, language } = useUiStore.getState();
      try {
        const dataUrl = await storage.getImageDataUrl(this.relPath);
        if (dataUrl && dataUrl.includes('base64,')) {
          const base64 = dataUrl.split('base64,')[1];
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const projectData = extractPngMetadata(bytes.buffer, YADA_METADATA_KEYWORD);
          if (projectData) {
            const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(projectData));
            return `${YADA_URL}?embed=true&theme=${theme}&lang=${language}#share=${compressed}`;
          }
        }
      } catch (err) {
        console.warn('Failed to extract embedded YADA diagram for simulation:', err);
      }
      return `${YADA_URL}?embed=true&theme=${theme}&lang=${language}`;
    };

    // Live Simulation Mode Toggle (for YADA diagrams)
    if (isYadaDiagram) {
      const simBtn = document.createElement('button');
      simBtn.type = 'button';
      simBtn.title = "Canlı Simülasyonu Başlat (Interactive Mode)";
      simBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer';
      simBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <polygon points="6 3 20 12 6 21 6 3"/>
        </svg>
      `;

      simBtn.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };

      simBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        isSimulation = !isSimulation;
        (wrap as any)._isSimulation = isSimulation;

        if (isSimulation) {
          // Measure current exact rendered dimensions of img before hiding it
          const imgRect = img.getBoundingClientRect();
          const exactW = Math.round(imgRect.width) || img.offsetWidth || this.width || 400;
          const exactH = Math.round(imgRect.height) || img.offsetHeight || (img.naturalWidth ? Math.round(exactW * (img.naturalHeight / img.naturalWidth)) : Math.round(exactW * 0.6));

          // Switch to Live Simulation Mode
          if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.className = 'rounded-xl shadow-md border border-gray-200 dark:border-zinc-800 block bg-slate-50 dark:bg-slate-950 transition-all';
            iframe.setAttribute('allow', 'fullscreen');
            wrap.appendChild(iframe);
          }
          iframe.style.width = `${exactW}px`;
          iframe.style.height = `${exactH}px`;
          iframe.style.maxWidth = '100%';
          iframe.style.display = 'block';

          img.style.display = 'none';

          const embedUrl = await getYadaEmbedUrl();
          if (iframe.src !== embedUrl) {
            iframe.src = embedUrl;
          }

          simBtn.title = "Statik Görsel Moduna Dön";
          simBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer ring-1 ring-emerald-500/30';
          simBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          `;
        } else {
          // Switch back to Static Image Mode
          if (iframe) {
            iframe.style.display = 'none';
          }
          img.style.display = 'block';

          simBtn.title = "Canlı Simülasyonu Başlat (Interactive Mode)";
          simBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer';
          simBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="6 3 20 12 6 21 6 3"/>
            </svg>
          `;
        }
      };

      toolbar.appendChild(simBtn);
    }

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

      const onRefresh = async (e: Event) => {
        const customEvt = e as CustomEvent<{ diagramId: string; dataUrl?: string }>;
        if (customEvt.detail && (customEvt.detail.diagramId === diagramId || customEvt.detail.diagramId === diagramMatch[2])) {
          if (customEvt.detail.dataUrl) {
            img.src = customEvt.detail.dataUrl;
          } else {
            storage.getImageDataUrl(this.relPath)
              .then((dataUrl) => { img.src = dataUrl; })
              .catch((err) => { console.error('Failed to reload diagram image:', err); });
          }

          // If iframe is currently visible in simulation mode, refresh its content
          if (iframe && isSimulation) {
            const embedUrl = await getYadaEmbedUrl();
            iframe.src = embedUrl;
          }
        }
      };

      window.addEventListener('refresh-diagram-image', onRefresh);
      (wrap as any)._onRefreshCleanup = () => {
        window.removeEventListener('refresh-diagram-image', onRefresh);
      };
    }

    // Fullscreen View Button (for all images, diagrams, and sketches)
    const fullBtn = document.createElement('button');
    fullBtn.type = 'button';
    fullBtn.title = "Tam Ekran Görünümü";
    fullBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer';
    fullBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
        <line x1="21" x2="14" y1="3" y2="10"/>
        <line x1="3" x2="10" y1="21" y2="14"/>
      </svg>
    `;

    fullBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    fullBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      let embedUrl: string | undefined;
      if (isSimulation) {
        embedUrl = await getYadaEmbedUrl();
      }

      window.dispatchEvent(
        new CustomEvent('open-image-fullscreen', {
          detail: {
            src: img.src,
            alt: this.alt,
            isSimulation,
            embedUrl,
            relPath: this.relPath,
          },
        })
      );
    };

    toolbar.appendChild(fullBtn);

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
      targetWidth = Math.max(120, Math.min(1600, startWidth + deltaX));
      
      // Use requestAnimationFrame to eliminate lag and synchronize with screen refresh
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          img.style.width = `${targetWidth}px`;
          if (iframe) {
            iframe.style.width = `${targetWidth}px`;
            const ratio = (img.naturalWidth && img.naturalHeight) ? (img.naturalHeight / img.naturalWidth) : 0.6;
            iframe.style.height = `${Math.round(targetWidth * ratio)}px`;
          }
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

      if (iframe) {
        iframe.style.pointerEvents = '';
      }

      const activeEl = isSimulation && iframe ? iframe : img;
      const finalWidth = Math.round(targetWidth || activeEl.getBoundingClientRect().width);
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
      const activeEl = isSimulation && iframe ? iframe : img;
      startWidth = activeEl.getBoundingClientRect().width;
      targetWidth = startWidth;
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';

      if (iframe) {
        iframe.style.pointerEvents = 'none';
      }

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
    const widthStr = this.width ? `${this.width}px` : '400px';
    const img = dom.querySelector('img');
    const iframe = dom.querySelector('iframe');

    if (img) {
      img.style.width = widthStr;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.alt = this.alt;
    }
    if (iframe) {
      iframe.style.width = widthStr;
      const ratio = (img && img.naturalWidth && img.naturalHeight) ? (img.naturalHeight / img.naturalWidth) : 0.6;
      iframe.style.height = `${Math.round((this.width || 400) * ratio)}px`;
    }
    return true;
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
