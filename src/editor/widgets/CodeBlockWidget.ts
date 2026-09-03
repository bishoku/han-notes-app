/**
 * CodeBlockWidget.ts — Compact & Syntax-Highlighted CodeMirror 6 Widget for Code Blocks:
 * - Language-aware syntax highlighting via @lezer/highlight & language parsers
 * - Selectable & copyable code text in Preview Mode (partial line/snippet selection supported)
 * - Ultra-compact 26px header bar with language badge and line count
 * - Action buttons: ✏️ Edit (Modal), 📋 Copy Code (full block), 🗑️ Delete (ConfirmModal)
 * - Double-click to quick-edit in CodeEditorModal
 * - Line numbers gutter & horizontal scrolling
 */
import { WidgetType, EditorView } from "@codemirror/view";
import { getLanguageConfig } from "@/editor/code/codeLanguages";
import { highlightCodeToHtml, escapeHtml } from "@/editor/code/codeHighlighter";

export class CodeBlockWidget extends WidgetType {
  codeText: string;
  lang: string;
  from: number;
  to: number;

  constructor(codeText: string, lang: string, from: number, to: number) {
    super();
    this.codeText = codeText;
    this.lang = lang;
    this.from = from;
    this.to = to;
  }

  get estimatedHeight(): number {
    const lines = this.codeText.replace(/\n+$/, '').split('\n');
    const lineCount = lines.length;
    if (lineCount > 28) {
      return 516;
    }
    return Math.max(50, lineCount * 20 + 36);
  }

  ignoreEvent(_event: Event): boolean {
    // Return true so CodeMirror allows normal native DOM mouse selection & copy
    return true;
  }

  eq(other: CodeBlockWidget): boolean {
    return (
      this.codeText === other.codeText &&
      this.lang === other.lang &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-codeblock-wrap my-2.5 rounded-lg border border-gray-200/80 dark:border-zinc-800/80 bg-[#f8fafc] dark:bg-[#111215] shadow-xs overflow-hidden group/codeblock relative w-full max-w-full min-w-0 box-border transition-all";
    wrap.style.lineHeight = "normal";
    wrap.style.boxSizing = "border-box";
    wrap.style.maxWidth = "100%";
    wrap.setAttribute("contenteditable", "false");
    wrap.setAttribute("tabindex", "-1");
    wrap.style.userSelect = "text";
    (wrap.style as any).WebkitUserSelect = "text";

    // Handle clipboard copy inside code block so selected text/snippets copy cleanly
    wrap.addEventListener("copy", (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const text = selection.toString();
        if (text) {
          e.clipboardData?.setData("text/plain", text);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      }
    });

    const badge = getLanguageConfig(this.lang);
    // Strip trailing newlines for clean rendering and accurate line counts
    const cleanCode = this.codeText.replace(/\n+$/, '');
    const lines = cleanCode ? cleanCode.split('\n') : [''];
    const isLong = lines.length > 28;

    // ─── Compact Header Bar (26px height, unselectable) ───
    const header = document.createElement("div");
    header.className = "flex items-center justify-between px-2.5 py-1 bg-gray-100/70 dark:bg-[#16171b]/90 border-b border-gray-200/70 dark:border-zinc-800/70 text-[11px] select-none leading-none min-h-[26px] cursor-default w-full max-w-full box-border";
    header.style.userSelect = "none";
    (header.style as any).WebkitUserSelect = "none";

    // Double-click on header bar opens edit modal
    header.ondblclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("edit-code-block", {
          detail: {
            code: this.codeText,
            lang: this.lang,
            from: this.from,
            to: this.to,
          },
        })
      );
    };

    // Left: Language badge & line count
    const leftInfo = document.createElement("div");
    leftInfo.className = "flex items-center gap-1.5 leading-none";

    const pill = document.createElement("span");
    pill.className = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border leading-none select-none";
    pill.style.backgroundColor = `${badge.color}15`;
    pill.style.borderColor = `${badge.color}30`;
    pill.style.color = badge.color;
    pill.innerHTML = `
      <span class="font-mono text-[9.5px] uppercase">${badge.abbr}</span>
      <span>${badge.name}</span>
    `;

    const lineCountBadge = document.createElement("span");
    lineCountBadge.className = "text-[10px] text-gray-400 dark:text-gray-500 font-mono leading-none select-none";
    lineCountBadge.textContent = `${lines.length} satır`;

    leftInfo.appendChild(pill);
    leftInfo.appendChild(lineCountBadge);

    let isExpanded = false;
    if (isLong) {
      const expandBtn = document.createElement("button");
      expandBtn.type = "button";
      expandBtn.className = "text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer select-none";
      expandBtn.textContent = "Tümünü Göster";
      expandBtn.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
      expandBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isExpanded = !isExpanded;
        if (isExpanded) {
          body.style.maxHeight = "none";
          body.style.overflowY = "visible";
          expandBtn.textContent = "Daralt";
        } else {
          body.style.maxHeight = "520px";
          body.style.overflowY = "auto";
          expandBtn.textContent = "Tümünü Göster";
        }
        view.requestMeasure();
      };
      leftInfo.appendChild(expandBtn);
    }

    header.appendChild(leftInfo);

    // Right: Action toolbar buttons
    const actions = document.createElement("div");
    actions.className = "flex items-center gap-0.5 leading-none select-none";

    // 1. Edit Button
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.title = "Kodu Düzenle (Modal)";
    editBtn.className = "w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-200/60 dark:hover:bg-zinc-700/60 rounded transition-colors cursor-pointer";
    editBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="11.5" height="11.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        <path d="m15 5 4 4"/>
      </svg>
    `;
    editBtn.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
    editBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("edit-code-block", {
          detail: {
            code: this.codeText,
            lang: this.lang,
            from: this.from,
            to: this.to,
          },
        })
      );
    };
    actions.appendChild(editBtn);

    // 2. Copy Code Button
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.title = "Tüm Kodu Kopyala";
    copyBtn.className = "w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-200/60 dark:hover:bg-zinc-700/60 rounded transition-colors cursor-pointer";
    copyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="11.5" height="11.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
      </svg>
    `;
    copyBtn.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
    copyBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(this.codeText);
        copyBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="11.5" height="11.5" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="11.5" height="11.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          `;
        }, 1800);
      } catch (err) {
        console.error("Failed to copy code:", err);
      }
    };
    actions.appendChild(copyBtn);

    // 3. Delete Button
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.title = "Kod Bloğunu Sil";
    deleteBtn.className = "w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-colors cursor-pointer";
    deleteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="11.5" height="11.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"/>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      </svg>
    `;
    deleteBtn.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("request-delete-code-block", {
          detail: {
            from: this.from,
            to: this.to,
          },
        })
      );
    };
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    wrap.appendChild(header);

    // ─── Code Content Body (Selectable text) ───
    const body = document.createElement("div");
    body.className = "cm-codeblock-body flex w-full max-w-full min-w-0 font-mono text-[12px] cursor-text select-text relative box-border";
    body.style.userSelect = "text";
    (body.style as any).WebkitUserSelect = "text";
    body.style.overflowX = "hidden"; // Body NEVER scrolls horizontally; codeArea does
    body.style.boxSizing = "border-box";
    if (isLong) {
      body.style.maxHeight = "520px";
      body.style.overflowY = "auto"; // Single vertical scrollbar on body
    } else {
      body.style.maxHeight = "none";
      body.style.overflowY = "visible";
    }

    // Line Numbers Gutter (Unselectable)
    const gutter = document.createElement("div");
    gutter.className = "cm-codeblock-gutter flex flex-col text-right py-2.5 pl-2 pr-2.5 select-none text-gray-400 dark:text-zinc-500 font-mono text-[11px] border-r border-gray-200/60 dark:border-zinc-800/60 shrink-0 pointer-events-none";
    gutter.style.lineHeight = "20px";
    gutter.style.userSelect = "none";
    (gutter.style as any).WebkitUserSelect = "none";
    gutter.style.overflow = "hidden";

    for (let i = 1; i <= lines.length; i++) {
      const numSpan = document.createElement("span");
      numSpan.className = "block h-[20px] leading-[20px]";
      numSpan.textContent = String(i);
      gutter.appendChild(numSpan);
    }
    body.appendChild(gutter);

    // Code Content Area (Fully Selectable & Copyable)
    const codeArea = document.createElement("pre");
    codeArea.className = "cm-codeblock-pre py-2.5 pl-3 pr-4 flex-1 min-w-0 overflow-x-auto text-gray-800 dark:text-zinc-200 select-text font-mono outline-none";
    codeArea.setAttribute("tabindex", "-1");
    codeArea.style.lineHeight = "20px";
    codeArea.style.fontSize = "12px";
    codeArea.style.margin = "0";
    codeArea.style.userSelect = "text";
    (codeArea.style as any).WebkitUserSelect = "text";
    codeArea.style.overflowY = "hidden"; // Strictly no vertical scrollbar on pre!

    // Forward vertical wheel scroll to body so mouse-wheel / trackpad scrolling over code lines ALWAYS scrolls body
    codeArea.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        if (!isExpanded && body.scrollHeight > body.clientHeight) {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            body.scrollTop += e.deltaY;
          }
        }
      },
      { passive: true }
    );

    const codeEl = document.createElement("code");
    codeEl.className = "cm-codeblock-code select-text block font-mono text-[12px]";
    codeEl.style.lineHeight = "20px";
    codeEl.style.userSelect = "text";
    (codeEl.style as any).WebkitUserSelect = "text";
    // Synchronous initial fallback
    codeEl.innerHTML = lines.map((l) => escapeHtml(l) || "&nbsp;").join("<br/>");
    codeArea.appendChild(codeEl);
    body.appendChild(codeArea);

    wrap.appendChild(body);

    // Perform asynchronous syntax highlighting using cleanCode
    highlightCodeToHtml(cleanCode, this.lang).then((highlightedHtml) => {
      if (highlightedHtml && codeEl.isConnected) {
        codeEl.innerHTML = highlightedHtml;
        view.requestMeasure();
      }
    });

    return wrap;
  }
}
