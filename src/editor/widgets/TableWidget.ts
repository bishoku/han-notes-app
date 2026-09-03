import { WidgetType } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import { marked } from "marked";
import { storage } from "@/services/storage";
import { useNoteStore } from "@/store/noteStore";

export interface ParsedTable {
  headers: string[];
  alignments: Array<'left' | 'center' | 'right'>;
  rows: string[][];
}

/**
 * Safely splits a Markdown table row by pipe `|` characters,
 * respecting escaped pipes `\|`, code spans `` `...` ``, and link wrappers `[...]`.
 */
export function splitTableRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  let inBacktick = false;
  let inLink = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '\\' && i + 1 < text.length) {
      // Escaped character, e.g. \|
      current += char + text[++i];
      continue;
    }

    if (char === '`') {
      inBacktick = !inBacktick;
      current += char;
    } else if (!inBacktick && (char === '[' || char === '(')) {
      inLink++;
      current += char;
    } else if (!inBacktick && (char === ']' || char === ')')) {
      if (inLink > 0) inLink--;
      current += char;
    } else if (char === '|' && !inBacktick && inLink === 0) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

export function parseMarkdownTable(text: string): ParsedTable | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return null;

  // Check if second line is separator like |---|---| or | :--- | ---: |
  const separatorLine = lines[1];
  if (!/^\|?(\s*:?-+:?\s*\|)+(\s*:?-+:?\s*)?\|?$/.test(separatorLine)) {
    return null;
  }

  const headers = splitTableRow(lines[0]);
  const sepCells = splitTableRow(separatorLine);

  const alignments: Array<'left' | 'center' | 'right'> = sepCells.map(cell => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
    if (cell.endsWith(':')) return 'right';
    return 'left';
  });

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].includes('|')) continue;
    rows.push(splitTableRow(lines[i]));
  }

  return { headers, alignments, rows };
}

export function formatTableToMarkdown(parsed: ParsedTable): string {
  const { headers, alignments, rows } = parsed;

  const headerLine = `| ${headers.map(h => h.trim() || ' ').join(' | ')} |`;
  
  const sepLine = `| ${alignments.map(a => {
    if (a === 'center') return ':---:';
    if (a === 'right') return '---:';
    return '---';
  }).join(' | ')} |`;

  const rowLines = rows.map(r => 
    `| ${headers.map((_, i) => (r[i] !== undefined ? r[i].trim() : '') || ' ').join(' | ')} |`
  );

  return [headerLine, sepLine, ...rowLines].join('\n');
}

/**
 * Renders inline Markdown (images, links, bold/italic, code, wikilinks) for table cell preview.
 */
function renderCellMarkdown(md: string): string {
  if (!md || !md.trim()) return '&nbsp;';

  // Handle wikilinks [[Target|Display]] or [[Target]]
  const withWikilinks = md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => {
    const display = alias || target;
    return `<span class="cm-wikilink text-mac-accent font-medium hover:underline cursor-pointer" data-target="${target}">${display}</span>`;
  });

  try {
    return marked.parseInline(withWikilinks) as string;
  } catch {
    return withWikilinks;
  }
}

export class TableWidget extends WidgetType {
  tableText: string;
  from: number;
  to: number;

  constructor(tableText: string, from: number, to: number) {
    super();
    this.tableText = tableText;
    this.from = from;
    this.to = to;
  }

  get estimatedHeight(): number {
    return 120;
  }

  ignoreEvent(_event: Event): boolean {
    return true;
  }

  eq(other: TableWidget): boolean {
    return this.tableText === other.tableText && this.from === other.from && this.to === other.to;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("div");
    container.className = "my-2 select-text group/table relative max-w-full inline-block w-full";

    const parsed = parseMarkdownTable(this.tableText);
    if (!parsed) {
      container.textContent = this.tableText;
      return container;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-700/80 shadow-xs bg-white dark:bg-zinc-900/90";

    const table = document.createElement("table");
    table.className = "w-full text-sm text-left border-collapse";

    const updateDoc = (newParsed: ParsedTable) => {
      const newMarkdown = formatTableToMarkdown(newParsed);
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: newMarkdown },
      });
    };

    const allEditableCells: HTMLSpanElement[] = [];

    // Helper to create a live editable/previewable cell span
    const createCellSpan = (
      initialText: string,
      isHeader: boolean,
      colIdx: number,
      rowIdx?: number
    ): HTMLSpanElement => {
      const span = document.createElement("span");
      span.contentEditable = "true";
      span.className =
        "outline-none focus:ring-1 focus:ring-mac-accent/50 rounded px-1.5 py-0.5 inline-block w-full min-w-[40px] break-words align-middle text-sm transition-all";

      let currentVal = initialText || "";

      const renderPreview = () => {
        span.innerHTML = renderCellMarkdown(currentVal);

        // Format and resolve images
        const imgs = span.querySelectorAll("img");
        imgs.forEach((img) => {
          img.className =
            "max-h-24 max-w-full object-contain rounded my-1 inline-block align-middle border border-gray-200/60 dark:border-zinc-700/60 shadow-2xs";
          img.setAttribute("loading", "lazy");

          const src = img.getAttribute("src");
          if (src && !src.startsWith("http") && !src.startsWith("data:")) {
            storage
              .getImageDataUrl(src)
              .then((dataUrl) => {
                img.src = dataUrl;
              })
              .catch(() => {});
          }
        });

        // Format and hook links
        const links = span.querySelectorAll("a");
        links.forEach((a) => {
          a.className =
            "text-mac-accent hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer";
          a.target = "_blank";
          a.rel = "noopener noreferrer";

          a.onmouseenter = () => {
            const href = a.getAttribute("href");
            if (!href) return;
            const rect = a.getBoundingClientRect();
            window.dispatchEvent(
              new CustomEvent("show-link-preview", {
                detail: {
                  url: href,
                  label: a.textContent || href,
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
        });
      };

      // Initial render as rich preview
      renderPreview();

      // Intercept clicks on links and wikilinks so they open instead of just entering edit mode
      span.addEventListener("click", (e) => {
        const link = (e.target as HTMLElement)?.closest("a");
        if (link && link.getAttribute("href")) {
          e.preventDefault();
          e.stopPropagation();
          window.open(link.getAttribute("href")!, "_blank", "noopener,noreferrer");
          return;
        }

        const wikilink = (e.target as HTMLElement)?.closest(".cm-wikilink");
        if (wikilink) {
          e.preventDefault();
          e.stopPropagation();
          const target = wikilink.getAttribute("data-target") || wikilink.textContent?.trim();
          if (target) {
            const cleanTitle = target.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
            const { notes, selectNote, createNote } = useNoteStore.getState();
            const targetNote = notes.find(
              (n) =>
                n.id.toLowerCase() === cleanTitle.toLowerCase() ||
                n.title.toLowerCase() === cleanTitle.toLowerCase() ||
                n.id.toLowerCase().endsWith(`/${cleanTitle.toLowerCase()}`)
            );
            if (targetNote) {
              selectNote(targetNote.id);
              window.location.hash = `/notes/${encodeURIComponent(targetNote.id)}`;
            } else {
              createNote(cleanTitle).then((newId) => {
                selectNote(newId);
                window.location.hash = `/notes/${encodeURIComponent(newId)}`;
              });
            }
          }
          return;
        }
      });

      // On focus: switch to raw Markdown text so user can edit cleanly
      span.addEventListener("focus", () => {
        span.textContent = currentVal;
        try {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(span);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch {
          // Ignore selection positioning error on focus
        }
      });

      // On blur: save changes and re-render preview
      span.addEventListener("blur", () => {
        const raw = isHeader
          ? span.textContent?.trim() || `Kolon ${colIdx + 1}`
          : span.textContent || "";
        if (raw !== currentVal) {
          currentVal = raw;
          if (isHeader) {
            parsed.headers[colIdx] = raw;
          } else if (rowIdx !== undefined && parsed.rows[rowIdx]) {
            parsed.rows[rowIdx][colIdx] = raw;
          }
          updateDoc(parsed);
        }
        renderPreview();
      });

      // Keyboard navigation
      span.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (isHeader) {
            span.blur();
          } else if (rowIdx !== undefined) {
            span.blur();
            const isLastRow = rowIdx === parsed.rows.length - 1;
            if (isLastRow) {
              parsed.rows.push(new Array(parsed.headers.length).fill(""));
              updateDoc(parsed);
            } else {
              const currentCellIndex = allEditableCells.indexOf(span);
              const nextRowCellIndex = currentCellIndex + parsed.headers.length;
              if (allEditableCells[nextRowCellIndex]) {
                allEditableCells[nextRowCellIndex].focus();
              }
            }
          }
        } else if (e.key === "Tab") {
          e.preventDefault();
          span.blur();
          const currentCellIndex = allEditableCells.indexOf(span);
          if (e.shiftKey) {
            if (currentCellIndex > 0) {
              allEditableCells[currentCellIndex - 1].focus();
            }
          } else {
            if (currentCellIndex < allEditableCells.length - 1) {
              allEditableCells[currentCellIndex + 1].focus();
            } else {
              parsed.rows.push(new Array(parsed.headers.length).fill(""));
              updateDoc(parsed);
            }
          }
        } else if (e.key === "Escape") {
          span.blur();
        }
      });

      return span;
    };

    // Header
    const thead = document.createElement("thead");
    thead.className = "bg-gray-50/90 dark:bg-zinc-800/90 border-b border-gray-200 dark:border-zinc-700/80 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider";
    const headerRow = document.createElement("tr");

    parsed.headers.forEach((h, colIdx) => {
      const th = document.createElement("th");
      th.className = "px-3 py-2 border-r last:border-r-0 border-gray-200/60 dark:border-zinc-700/60 relative group/col";
      th.style.textAlign = parsed.alignments[colIdx] || "left";

      const span = createCellSpan(h, true, colIdx);
      th.appendChild(span);

      // Delete Column Button (if > 1 columns)
      if (parsed.headers.length > 1) {
        const delColBtn = document.createElement("button");
        delColBtn.className = "opacity-0 group-hover/col:opacity-100 absolute top-1 right-1 p-0.5 text-gray-400 hover:text-red-500 rounded transition-opacity text-[10px]";
        delColBtn.title = "Sütunu Sil";
        delColBtn.textContent = "✕";
        delColBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          parsed.headers.splice(colIdx, 1);
          parsed.alignments.splice(colIdx, 1);
          parsed.rows.forEach(r => r.splice(colIdx, 1));
          updateDoc(parsed);
        });
        th.appendChild(delColBtn);
      }

      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement("tbody");
    tbody.className = "divide-y divide-gray-100 dark:divide-zinc-800/80";

    parsed.rows.forEach((row, rowIdx) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition-colors group/row relative";

      parsed.headers.forEach((_, colIdx) => {
        const td = document.createElement("td");
        td.className = "px-3 py-1.5 border-r last:border-r-0 border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-gray-200 font-normal relative";
        td.style.textAlign = parsed.alignments[colIdx] || "left";

        const span = createCellSpan(row[colIdx] || "", false, colIdx, rowIdx);
        allEditableCells.push(span);

        td.appendChild(span);
        tr.appendChild(td);
      });

      // Delete Row Button (on hover)
      const delRowTd = document.createElement("td");
      delRowTd.className = "w-6 px-1 py-1.5 text-center border-l-0";
      const delRowBtn = document.createElement("button");
      delRowBtn.className = "opacity-0 group-hover/row:opacity-100 p-0.5 text-gray-400 hover:text-red-500 rounded transition-opacity text-[10px]";
      delRowBtn.title = "Satırı Sil";
      delRowBtn.textContent = "✕";
      delRowBtn.addEventListener("click", () => {
        parsed.rows.splice(rowIdx, 1);
        updateDoc(parsed);
      });
      delRowTd.appendChild(delRowBtn);
      tr.appendChild(delRowTd);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);

    // Footer Controls Bar (+ Satır Ekle, + Sütun Ekle) — Only visible on table hover or focus
    const controls = document.createElement("div");
    controls.className = "mt-1 flex items-center justify-between text-xs text-gray-500 hidden group-hover/table:flex group-focus-within/table:flex";

    const leftControls = document.createElement("div");
    leftControls.className = "flex items-center gap-2";

    // Add Row Button
    const addRowBtn = document.createElement("button");
    addRowBtn.className = "flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-mac-accent/10 hover:text-mac-accent text-gray-600 dark:text-gray-300 rounded-lg font-medium transition-colors border border-gray-200/60 dark:border-zinc-700/60";
    addRowBtn.innerHTML = `<span class="font-bold">+</span> Satır Ekle`;
    addRowBtn.addEventListener("click", () => {
      parsed.rows.push(new Array(parsed.headers.length).fill(""));
      updateDoc(parsed);
    });
    leftControls.appendChild(addRowBtn);

    // Add Column Button
    const addColBtn = document.createElement("button");
    addColBtn.className = "flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-mac-accent/10 hover:text-mac-accent text-gray-600 dark:text-gray-300 rounded-lg font-medium transition-colors border border-gray-200/60 dark:border-zinc-700/60";
    addColBtn.innerHTML = `<span class="font-bold">+</span> Sütun Ekle`;
    addColBtn.addEventListener("click", () => {
      parsed.headers.push(`Kolon ${parsed.headers.length + 1}`);
      parsed.alignments.push("left");
      parsed.rows.forEach(r => r.push(""));
      updateDoc(parsed);
    });
    leftControls.appendChild(addColBtn);

    controls.appendChild(leftControls);
    container.appendChild(controls);

    return container;
  }
}
