import { WidgetType } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

export interface ParsedTable {
  headers: string[];
  alignments: Array<'left' | 'center' | 'right'>;
  rows: string[][];
}

export function parseMarkdownTable(text: string): ParsedTable | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return null;

  // Check if second line is separator like |---|---| or | :--- | ---: |
  const separatorLine = lines[1];
  if (!/^\|?(\s*:?-+:?\s*\|)+(\s*:?-+:?\s*)?\|?$/.test(separatorLine)) {
    return null;
  }

  const parseLine = (line: string) => {
    let content = line;
    if (content.startsWith('|')) content = content.slice(1);
    if (content.endsWith('|')) content = content.slice(0, -1);
    return content.split('|').map(cell => cell.trim());
  };

  const headers = parseLine(lines[0]);
  const sepCells = parseLine(separatorLine);

  const alignments: Array<'left' | 'center' | 'right'> = sepCells.map(cell => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
    if (cell.endsWith(':')) return 'right';
    return 'left';
  });

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].includes('|')) continue;
    rows.push(parseLine(lines[i]));
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

  eq(other: TableWidget): boolean {
    return this.tableText === other.tableText && this.from === other.from && this.to === other.to;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("div");
    container.className = "my-4 select-none group/table relative";

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

    // Header
    const thead = document.createElement("thead");
    thead.className = "bg-gray-50/90 dark:bg-zinc-800/90 border-b border-gray-200 dark:border-zinc-700/80 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider";
    const headerRow = document.createElement("tr");

    parsed.headers.forEach((h, colIdx) => {
      const th = document.createElement("th");
      th.className = "px-3 py-2 border-r last:border-r-0 border-gray-200/60 dark:border-zinc-700/60 relative group/col";
      th.style.textAlign = parsed.alignments[colIdx] || "left";

      // Editable span inside TH
      const span = document.createElement("span");
      span.contentEditable = "true";
      span.className = "outline-none focus:ring-1 focus:ring-mac-accent/50 rounded px-1 py-0.5 inline-block w-full min-w-[40px]";
      span.textContent = h;

      span.addEventListener("blur", () => {
        const val = span.textContent?.trim() || `Kolon ${colIdx + 1}`;
        if (val !== parsed.headers[colIdx]) {
          parsed.headers[colIdx] = val;
          updateDoc(parsed);
        }
      });

      span.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          span.blur();
        }
      });

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

    const allEditableCells: HTMLSpanElement[] = [];

    parsed.rows.forEach((row, rowIdx) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition-colors group/row relative";

      parsed.headers.forEach((_, colIdx) => {
        const td = document.createElement("td");
        td.className = "px-3 py-1.5 border-r last:border-r-0 border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-gray-200 font-normal relative";
        td.style.textAlign = parsed.alignments[colIdx] || "left";

        const span = document.createElement("span");
        span.contentEditable = "true";
        span.className = "outline-none focus:ring-1 focus:ring-mac-accent/50 rounded px-1 py-0.5 inline-block w-full min-w-[40px]";
        span.textContent = row[colIdx] || "";

        allEditableCells.push(span);

        span.addEventListener("blur", () => {
          const val = span.textContent || "";
          if (val !== (parsed.rows[rowIdx][colIdx] || "")) {
            parsed.rows[rowIdx][colIdx] = val;
            updateDoc(parsed);
          }
        });

        span.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const currentCellIndex = allEditableCells.indexOf(span);
            const isLastRow = rowIdx === parsed.rows.length - 1;
            
            if (isLastRow) {
              // On last row Enter, save and add a new row
              parsed.rows[rowIdx][colIdx] = span.textContent || "";
              parsed.rows.push(new Array(parsed.headers.length).fill(""));
              updateDoc(parsed);
            } else {
              // Move focus to same column in next row
              const nextRowCellIndex = currentCellIndex + parsed.headers.length;
              if (allEditableCells[nextRowCellIndex]) {
                allEditableCells[nextRowCellIndex].focus();
              }
            }
          } else if (e.key === "Tab") {
            e.preventDefault();
            const currentCellIndex = allEditableCells.indexOf(span);
            if (e.shiftKey) {
              if (currentCellIndex > 0) {
                allEditableCells[currentCellIndex - 1].focus();
              }
            } else {
              if (currentCellIndex < allEditableCells.length - 1) {
                allEditableCells[currentCellIndex + 1].focus();
              } else {
                // Add new row on Tab from last cell
                parsed.rows[rowIdx][colIdx] = span.textContent || "";
                parsed.rows.push(new Array(parsed.headers.length).fill(""));
                updateDoc(parsed);
              }
            }
          }
        });

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
    controls.className = "mt-1.5 flex items-center justify-between text-xs text-gray-500 opacity-0 group-hover/table:opacity-100 group-focus-within/table:opacity-100 transition-opacity duration-200";

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
