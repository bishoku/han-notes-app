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
    toolbar.className = 'cm-image-toolbar absolute -top-3.5 right-2 flex items-center gap-1.5 p-1 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md border border-gray-200 dark:border-zinc-700 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 select-none';

    let handle: HTMLDivElement | null = null;
    let isSelected = false;
    const updateSelectionUI = () => {
      if (isSelected) {
        wrap.classList.add('is-active', 'ring-2', 'ring-purple-500/60', 'rounded-xl');
        toolbar.classList.remove('opacity-0', 'pointer-events-none');
        toolbar.classList.add('opacity-100', 'pointer-events-auto');
        if (handle) {
          handle.classList.remove('opacity-0', 'pointer-events-none');
          handle.classList.add('opacity-100', 'pointer-events-auto');
        }
      } else {
        wrap.classList.remove('is-active', 'ring-2', 'ring-purple-500/60', 'rounded-xl');
        toolbar.classList.remove('opacity-100', 'pointer-events-auto');
        toolbar.classList.add('opacity-0');
        if (handle) {
          handle.classList.remove('opacity-100', 'pointer-events-auto');
          handle.classList.add('opacity-0');
        }
      }
    };

    wrap.addEventListener('click', (e) => {
      if ((e.target as HTMLElement)?.closest?.('.cm-image-toolbar') || (e.target as HTMLElement)?.closest?.('.cm-image-resizer')) {
        return;
      }
      isSelected = !isSelected;
      updateSelectionUI();
    });

    const onDocClick = (e: Event) => {
      if (isSelected && !wrap.contains(e.target as Node)) {
        isSelected = false;
        updateSelectionUI();
      }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('touchstart', onDocClick, { passive: true });
    (wrap as any)._docClickCleanup = () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };

    const diagramMatch = this.relPath.match(/(diagram|sketch)-([a-z0-9-]+)\.png$/);
    const isDiagramOrSketch = !!diagramMatch;
    const isYadaDiagram = diagramMatch ? diagramMatch[1] === 'diagram' : false;

    let isSimulation = false;
    let iframe: HTMLIFrameElement | null = null;

    // Helper to generate the YADA Embed URL from embedded PNG metadata
    const getYadaEmbedUrl = async (): Promise<string> => {
      const YADA_URL = (import.meta as any).env?.VITE_YADA_URL || 'https://bishoku.github.io/yada/';
      const { theme, language } = useUiStore.getState();
      try {
        const bytes = await storage.getImageBytes(this.relPath);
        const projectData = extractPngMetadata(bytes, YADA_METADATA_KEYWORD);
        if (projectData) {
          const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(projectData));
          return `${YADA_URL}?embed=true&theme=${theme}&lang=${language}#share=${compressed}`;
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
      simBtn.className = 'w-8 h-8 sm:w-7 sm:h-7 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer active:scale-95';
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
          simBtn.className = 'w-8 h-8 sm:w-7 sm:h-7 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer ring-1 ring-emerald-500/30 active:scale-95';
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
          simBtn.className = 'w-8 h-8 sm:w-7 sm:h-7 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer active:scale-95';
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
      editBtn.className = `w-8 h-8 sm:w-7 sm:h-7 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full active:scale-95 ${
        isSketch
          ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/50'
          : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hidden md:flex'
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

    // Quick Width Toggle Button (for all images, diagrams, and sketches)
    const quickResizeBtn = document.createElement('button');
    quickResizeBtn.type = 'button';
    quickResizeBtn.title = "Genişliği Değiştir (50% / 100%)";
    quickResizeBtn.className = 'w-8 h-8 sm:w-7 sm:h-7 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer active:scale-95';
    quickResizeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12H3"/>
        <path d="m9 6-6 6 6 6"/>
        <path d="m15 18 6-6-6-6"/>
      </svg>
    `;
    quickResizeBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    quickResizeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentW = (isSimulation && iframe ? iframe.offsetWidth : img.offsetWidth) || this.width || 400;
      const targetW = currentW > 480 ? 360 : 760;
      applyWidthChange(targetW);
    };
    toolbar.appendChild(quickResizeBtn);

    // Fullscreen View Button (for all images, diagrams, and sketches)
    const fullBtn = document.createElement('button');
    fullBtn.type = 'button';
    fullBtn.title = "Tam Ekran Görünümü";
    fullBtn.className = 'w-8 h-8 sm:w-7 sm:h-7 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer active:scale-95';
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
    deleteBtn.className = 'w-8 h-8 sm:w-7 sm:h-7 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer active:scale-95';

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

          // If following lines contain a diagram-ai comment: <!-- diagram-ai:... -->
          if (i < doc.lines) {
            const nextLine = doc.line(i + 1);
            if (nextLine.text.trimStart().startsWith('<!-- diagram-ai:')) {
              for (let scanL = i + 1; scanL <= doc.lines; scanL++) {
                const scanLine = doc.line(scanL);
                deleteTo = scanLine.to;
                if (scanLine.text.includes('-->')) {
                  break;
                }
              }
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

    // Unified Width Update Helper
    const applyWidthChange = (finalWidth: number) => {
      const cleanAlt = this.alt.split('|')[0];
      const newMarkdown = `![${cleanAlt}|${finalWidth}](${this.relPath})`;

      const doc = view.state.doc;
      let matchFrom = -1;
      let matchTo = -1;

      const tryMatchLine = (lineNum: number): boolean => {
        if (lineNum < 1 || lineNum > doc.lines) return false;
        const line = doc.line(lineNum);
        if (!line.text.includes(this.relPath)) return false;
        const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let m;
        while ((m = imgRegex.exec(line.text)) !== null) {
          if (m[2].trim() === this.relPath.trim() || m[2].includes(this.relPath) || this.relPath.includes(m[2])) {
            matchFrom = line.from + m.index;
            matchTo = matchFrom + m[0].length;
            return true;
          }
        }
        return false;
      };

      const knownLineNum = this.from < doc.length ? doc.lineAt(this.from).number : 1;
      if (!tryMatchLine(knownLineNum)) {
        const scanStart = Math.max(1, knownLineNum - 50);
        const scanEnd = Math.min(doc.lines, knownLineNum + 50);
        for (let i = scanStart; i <= scanEnd; i++) {
          if (i === knownLineNum) continue;
          if (tryMatchLine(i)) break;
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

    // Resizable drag handle (bottom-right) — touch and mouse responsive
    handle = document.createElement('div');
    handle.className = 'cm-image-resizer absolute -bottom-2 -right-2 w-7 h-7 sm:w-5 sm:h-5 bg-mac-accent rounded-full opacity-0 group-hover:opacity-100 cursor-nwse-resize shadow-md transition-opacity duration-150 border-2 border-white flex items-center justify-center z-10 touch-none select-none';
    handle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21 15-6 6"/>
        <path d="m21 9-12 12"/>
      </svg>
    `;

    let startX = 0;
    let startWidth = 0;
    let targetWidth = 0;
    let rafId: number | null = null;

    const onPointerStart = (clientX: number) => {
      startX = clientX;
      const activeEl = isSimulation && iframe ? iframe : img;
      startWidth = activeEl.getBoundingClientRect().width;
      targetWidth = startWidth;
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';
      if (iframe) {
        iframe.style.pointerEvents = 'none';
      }
    };

    const onPointerMove = (clientX: number) => {
      const deltaX = clientX - startX;
      targetWidth = Math.max(120, Math.min(1600, startWidth + deltaX));
      
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

    const onPointerEnd = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (iframe) {
        iframe.style.pointerEvents = '';
      }
      const activeEl = isSimulation && iframe ? iframe : img;
      const finalWidth = Math.round(targetWidth || activeEl.getBoundingClientRect().width);
      applyWidthChange(finalWidth);
    };

    const onMouseMove = (e: MouseEvent) => {
      onPointerMove(e.clientX);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      onPointerEnd();
    };

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onPointerStart(e.clientX);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        onPointerMove(e.touches[0].clientX);
      }
    };

    const onTouchEnd = () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      onPointerEnd();
    };

    handle.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        onPointerStart(e.touches[0].clientX);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
      }
    }, { passive: false });

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
    if ((dom as any)._docClickCleanup) {
      (dom as any)._docClickCleanup();
    }
  }

  eq(other: ResizableImageWidget) {
    return this.relPath === other.relPath && this.width === other.width && this.alt === other.alt;
  }
}
