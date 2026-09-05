/**
 * MermaidWidget.ts — CodeMirror 6 Widget for rendering interactive Mermaid diagrams with:
 * - 60/120 FPS hardware-accelerated drag-to-resize handle (bottom-right)
 * - Custom width persistence in Markdown: ```mermaid|650
 * - Live dynamic SVG rendering & theme synchronization
 * - Floating action toolbar (Edit, Fullscreen, Copy Code, Delete)
 * - Safe async rendering & DOM isolation
 * - Graceful syntax error handling with 1-click edit
 */
import { WidgetType, EditorView } from "@codemirror/view";
import { renderMermaidSvg } from "@/editor/mermaid/mermaidService";
import { clearLivePreviewCaches } from "@/editor/LivePreviewPlugin";
import { useUiStore } from "@/store/uiStore";

export class MermaidWidget extends WidgetType {
  code: string;
  width: number | null;
  from: number;
  to: number;

  constructor(code: string, width: number | null, from: number, to: number) {
    super();
    this.code = code;
    this.width = width;
    this.from = from;
    this.to = to;
  }

  get estimatedHeight(): number {
    return 240;
  }

  ignoreEvent(_event: Event): boolean {
    return true;
  }

  eq(other: MermaidWidget): boolean {
    return (
      this.code === other.code &&
      this.width === other.width &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "my-4 inline-block relative group/mermaid max-w-full select-none";
    if (this.width) {
      wrap.style.width = `${this.width}px`;
    } else {
      wrap.style.width = "100%";
    }
    wrap.style.maxWidth = "100%";

    const card = document.createElement("div");
    card.className = "rounded-xl shadow-md border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 overflow-x-auto transition-all flex flex-col items-center justify-center min-h-[120px] w-full max-w-full";
    if (this.width) {
      card.style.width = `${this.width}px`;
    } else {
      card.style.width = "100%";
    }
    card.style.maxWidth = "100%";

    // Inner render area
    const renderArea = document.createElement("div");
    renderArea.className = "w-full flex items-center justify-center transition-opacity duration-200";
    renderArea.innerHTML = `
      <div class="flex items-center gap-2 text-xs text-gray-400 py-4">
        <svg class="animate-spin h-4 w-4 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Mermaid çiziliyor...</span>
      </div>
    `;
    card.appendChild(renderArea);

    let lastRenderedSvg = "";

    // ─── Floating Action Toolbar (top-right) ───
    const toolbar = document.createElement("div");
    toolbar.className = "absolute -top-3.5 right-3 flex items-center gap-1 p-0.5 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md border border-gray-200 dark:border-zinc-700 rounded-full shadow-md opacity-0 group-hover/mermaid:opacity-100 transition-opacity duration-150 z-20 select-none";

    // 1. Edit Button
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.title = "Mermaid Diyagramını Düzenle";
    editBtn.className = "w-7 h-7 flex items-center justify-center rounded-full text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors cursor-pointer";
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
      window.dispatchEvent(
        new CustomEvent("edit-mermaid", {
          detail: {
            code: this.code,
            width: this.width,
            from: this.from,
            to: this.to,
          },
        })
      );
    };

    toolbar.appendChild(editBtn);

    // 2. Fullscreen Button
    const fullBtn = document.createElement("button");
    fullBtn.type = "button";
    fullBtn.title = "Tam Ekran Görünümü";
    fullBtn.className = "w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer";
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

    fullBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("open-image-fullscreen", {
          detail: {
            svgContent: lastRenderedSvg,
            alt: "Mermaid Diyagramı",
            mermaidCode: this.code,
          },
        })
      );
    };

    toolbar.appendChild(fullBtn);

    // 3. Copy Code Button
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.title = "Mermaid Kodunu Kopyala";
    copyBtn.className = "w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer";
    copyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
      </svg>
    `;

    copyBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    copyBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(this.code);
        copyBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          `;
        }, 1800);
      } catch (err) {
        console.error("Failed to copy mermaid code:", err);
      }
    };

    toolbar.appendChild(copyBtn);

    // 4. Delete Button
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.title = "Diyagramı Not'tan Kaldır";
    deleteBtn.className = "w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer";
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
      window.dispatchEvent(
        new CustomEvent("request-delete-mermaid", {
          detail: {
            from: this.from,
            to: this.to,
          },
        })
      );
    };

    toolbar.appendChild(deleteBtn);
    wrap.appendChild(toolbar);

    // Double-click/tap diagram card to open in fullscreen lightbox
    card.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fullBtn.click();
    });

    wrap.appendChild(card);

    // ─── Resizable Drag Handle (bottom-right) ───
    const handle = document.createElement("div");
    handle.className = "absolute -bottom-1 -right-1 w-4 h-4 bg-teal-500 rounded-full opacity-0 group-hover/mermaid:opacity-100 cursor-nwse-resize shadow-md transition-opacity duration-150 border-2 border-white dark:border-zinc-800 z-10";

    let startX = 0;
    let startWidth = 0;
    let targetWidth = 0;
    let rafId: number | null = null;

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      targetWidth = Math.max(220, Math.min(1600, startWidth + deltaX));

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          wrap.style.width = `${targetWidth}px`;
          card.style.width = `${targetWidth}px`;
          rafId = null;
        });
      }
    };

    const onMouseUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      const finalWidth = Math.round(targetWidth || card.getBoundingClientRect().width);
      const doc = view.state.doc;

      // Find the exact fenced code range in the live document
      let replaceFrom = this.from;
      let replaceTo = this.to;

      if (replaceFrom < doc.length) {
        const line = doc.lineAt(replaceFrom);
        if (line.text.startsWith("```mermaid")) {
          replaceFrom = line.from;
          for (let l = line.number + 1; l <= doc.lines; l++) {
            const curLine = doc.line(l);
            if (curLine.text.trim().startsWith("```")) {
              replaceTo = curLine.to;
              break;
            }
          }
        }
      }

      const newMarkdown = `\`\`\`mermaid|${finalWidth}\n${this.code}\n\`\`\``;

      clearLivePreviewCaches();
      view.dispatch({
        changes: { from: replaceFrom, to: replaceTo, insert: newMarkdown },
      });
    };

    handle.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startWidth = card.getBoundingClientRect().width;
      targetWidth = startWidth;
      document.body.style.cursor = "nwse-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    wrap.appendChild(handle);

    // Perform async SVG rendering
    const isDark = ["dark", "dracula", "synthwave"].includes(useUiStore.getState().theme);
    renderMermaidSvg(`w-${this.from}`, this.code, isDark).then((res) => {
      if (res.error) {
        renderArea.innerHTML = `
          <div class="flex flex-col items-center justify-center p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl text-center max-w-lg w-full">
            <div class="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
              <span>Mermaid Sözdizimi Hatası</span>
            </div>
            <p class="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">${res.error}</p>
            <button type="button" class="px-3 py-1 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs">
              Diyagramı Düzenle
            </button>
          </div>
        `;
        const editFixBtn = renderArea.querySelector("button");
        if (editFixBtn) {
          editFixBtn.onclick = () => {
            window.dispatchEvent(
              new CustomEvent("edit-mermaid", {
                detail: { code: this.code, width: this.width, from: this.from, to: this.to },
              })
            );
          };
        }
      } else {
        lastRenderedSvg = res.svg;
        renderArea.innerHTML = res.svg;
        const svgEl = renderArea.querySelector("svg");
        if (svgEl) {
          svgEl.style.maxWidth = "100%";
          svgEl.style.height = "auto";
        }
      }
      view.requestMeasure();
    });

    return wrap;
  }
}
