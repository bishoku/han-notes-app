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
    const lineCount = this.codeText.split('\n').length;
    return Math.min(500, Math.max(50, lineCount * 19 + 28));
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
    wrap.className = "my-2.5 rounded-lg border border-gray-200/80 dark:border-zinc-800/80 bg-[#f8fafc] dark:bg-[#111215] shadow-xs overflow-hidden group/codeblock relative max-w-full transition-all";
    wrap.style.lineHeight = "normal";

    const badge = getLanguageConfig(this.lang);
    const lines = this.codeText.split('\n');
    const isLong = lines.length > 35;

    // ─── Compact Header Bar (26px height, unselectable) ───
    const header = document.createElement("div");
    header.className = "flex items-center justify-between px-2.5 py-1 bg-gray-100/70 dark:bg-[#16171b]/90 border-b border-gray-200/70 dark:border-zinc-800/70 text-[11px] select-none leading-none min-h-[26px]";

    // Left: Language badge & line count
    const leftInfo = document.createElement("div");
    leftInfo.className = "flex items-center gap-1.5 leading-none";

    const pill = document.createElement("span");
    pill.className = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border leading-none";
    pill.style.backgroundColor = `${badge.color}15`;
    pill.style.borderColor = `${badge.color}30`;
    pill.style.color = badge.color;
    pill.innerHTML = `
      <span class="font-mono text-[9.5px] uppercase">${badge.abbr}</span>
      <span>${badge.name}</span>
    `;

    const lineCountBadge = document.createElement("span");
    lineCountBadge.className = "text-[10px] text-gray-400 dark:text-gray-500 font-mono leading-none";
    lineCountBadge.textContent = `${lines.length} satır`;

    leftInfo.appendChild(pill);
    leftInfo.appendChild(lineCountBadge);
    header.appendChild(leftInfo);

    // Right: Action toolbar buttons
    const actions = document.createElement("div");
    actions.className = "flex items-center gap-0.5 leading-none";

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
    body.className = "flex overflow-x-auto p-2.5 font-mono text-[12px] leading-relaxed cursor-text";
    body.style.userSelect = "text";
    (body.style as any).WebkitUserSelect = "text";
    if (isLong) {
      body.style.maxHeight = "520px";
    }

    // Double-click to edit modal
    body.ondblclick = (e) => {
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

    // Line Numbers Gutter (Unselectable)
    const gutter = document.createElement("div");
    gutter.className = "flex flex-col text-right pr-2.5 select-none text-gray-300 dark:text-zinc-600 font-mono text-[10.5px] border-r border-gray-200/50 dark:border-zinc-800/60 shrink-0";
    gutter.style.lineHeight = "1.55";
    gutter.style.userSelect = "none";
    (gutter.style as any).WebkitUserSelect = "none";

    for (let i = 1; i <= lines.length; i++) {
      const numSpan = document.createElement("span");
      numSpan.textContent = String(i);
      gutter.appendChild(numSpan);
    }
    body.appendChild(gutter);

    // Code Content Area (Fully Selectable & Copyable)
    const codeArea = document.createElement("pre");
    codeArea.className = "pl-2.5 flex-1 overflow-x-auto text-gray-800 dark:text-zinc-200";
    codeArea.style.lineHeight = "1.55";
    codeArea.style.margin = "0";
    codeArea.style.userSelect = "text";
    (codeArea.style as any).WebkitUserSelect = "text";

    const codeEl = document.createElement("code");
    codeEl.style.userSelect = "text";
    (codeEl.style as any).WebkitUserSelect = "text";
    // Synchronous initial fallback
    codeEl.innerHTML = lines.map((l) => escapeHtml(l) || "&nbsp;").join("<br/>");
    codeArea.appendChild(codeEl);
    body.appendChild(codeArea);

    wrap.appendChild(body);

    // Perform asynchronous syntax highlighting
    highlightCodeToHtml(this.codeText, this.lang).then((highlightedHtml) => {
      if (highlightedHtml && codeEl.isConnected) {
        codeEl.innerHTML = highlightedHtml;
        view.requestMeasure();
      }
    });

    return wrap;
  }
}
