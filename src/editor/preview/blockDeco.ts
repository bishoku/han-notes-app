import { Decoration } from "@codemirror/view";
import type { Text } from "@codemirror/state";
import type { DecCollector, FencedRange } from "./types";
import { hiddenMark, applyInlineDecorations } from "./inlineDeco";
import { getCachedWidget } from "./cache";
import { CALLOUT_ICONS, calloutLineDecs, IconWidget } from "./calloutDeco";
import { TableWidget, parseMarkdownTable } from "../widgets/TableWidget";
import { MermaidWidget } from "../widgets/MermaidWidget";
import { CodeBlockWidget } from "../widgets/CodeBlockWidget";

// Hoisted line decorations
export const lineDecH1 = Decoration.line({ attributes: { class: "cm-h1" } });
export const lineDecH2 = Decoration.line({ attributes: { class: "cm-h2" } });
export const lineDecH3 = Decoration.line({ attributes: { class: "cm-h3" } });
export const lineDecH4 = Decoration.line({ attributes: { class: "cm-h4" } });
export const lineDecHidden = Decoration.line({ attributes: { class: "cm-hidden-frontmatter" } });
export const lineDecHiddenTable = Decoration.line({ attributes: { class: "cm-hidden-table-line" } });
export const lineDecCodeBlock = Decoration.line({ attributes: { class: "cm-codeblock-line" } });
export const lineDecCodeFooter = Decoration.line({ attributes: { class: "cm-codeblock-line cm-codeblock-footer" } });
export const lineDecBlockquote = Decoration.line({ attributes: { class: "cm-blockquote-line" } });
export const lineDecHR = Decoration.line({ attributes: { class: "cm-hr-line" } });

/**
 * Hides YAML frontmatter if within or near the top of the document.
 * Returns the ending line number of the frontmatter, or -1 if none found.
 */
export function hideFrontmatter(
  doc: Text,
  startLineNum: number,
  collect: DecCollector
): number {
  if (startLineNum > 2 || doc.lines === 0) return -1;

  const firstLine = doc.line(1);
  if (!firstLine.text.trim().startsWith("---")) return -1;

  let closingLineNum = 0;
  const maxScan = Math.min(doc.lines, 40);
  for (let l = 2; l <= maxScan; l++) {
    const line = doc.line(l);
    if (line.text.trim().startsWith("---")) {
      closingLineNum = l;
      break;
    }
  }

  if (closingLineNum === 0) return -1;

  let frontmatterEndLine = closingLineNum;
  if (closingLineNum < doc.lines && doc.line(closingLineNum + 1).text.trim() === '') {
    frontmatterEndLine = closingLineNum + 1;
  }

  for (let l = 1; l <= frontmatterEndLine; l++) {
    const fLine = doc.line(l);
    collect({ from: fLine.from, to: fLine.from, dec: lineDecHidden });
  }

  return frontmatterEndLine;
}

/**
 * Detects and completely hides multi-line diagram comments (<!-- diagram: or <!-- diagram-ai:).
 * Returns the next line number to process, or null if not a diagram comment.
 */
export function processDiagramCommentBlock(
  doc: Text,
  l: number,
  lineText: string,
  collect: DecCollector
): number | null {
  const trimmedLine = lineText.trimStart();
  if (!trimmedLine.startsWith("<!-- diagram-ai:") && !trimmedLine.startsWith("<!-- diagram:")) {
    return null;
  }

  let commentEndLine = l;
  for (let nextL = l; nextL <= doc.lines; nextL++) {
    const nextLine = doc.line(nextL);
    if (nextLine.text.includes("-->")) {
      commentEndLine = nextL;
      break;
    }
  }

  for (let hideL = l; hideL <= commentEndLine; hideL++) {
    const hLine = doc.line(hideL);
    collect({ from: hLine.from, to: hLine.from, dec: lineDecHidden });
  }

  return commentEndLine + 1;
}

/**
 * Detects and renders Callout blocks (> [!NOTE] / > [!TIP] etc.).
 * Returns the next line number to process, or null if not a callout header.
 */
export function processCalloutBlock(
  doc: Text,
  l: number,
  line: { from: number; to: number; text: string },
  isInsideFencedCode: (pos: number) => boolean,
  collect: DecCollector
): number | null {
  const text = line.text;
  const calloutMatch = text.match(/^(?:>\s*)?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|QUOTE|INFO)\]\s*(.*)$/i);
  if (!calloutMatch) return null;

  const type = calloutMatch[1].toUpperCase();
  const calloutDecs = calloutLineDecs[type] || calloutLineDecs.NOTE;
  const icon = CALLOUT_ICONS[type] || "ℹ️";

  let calloutEndLine = l;
  for (let nextL = l + 1; nextL <= doc.lines; nextL++) {
    const nextLine = doc.line(nextL);
    if (nextLine.text.trimStart().startsWith('>')) {
      calloutEndLine = nextL;
    } else {
      break;
    }
  }

  const isSingleLine = calloutEndLine === l;

  // Header line decoration
  collect({
    from: line.from,
    to: line.from,
    dec: isSingleLine ? calloutDecs.single : calloutDecs.header,
  });

  // Replace prefix `> [!NOTE] ` or `[!NOTE] ` with atomic IconWidget
  const prefixMatch = text.match(/^(?:>\s*)?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|QUOTE|INFO)\]\s*/i);
  let headerPrefixEnd = line.from;
  if (prefixMatch) {
    const prefixFrom = line.from;
    const prefixTo = line.from + prefixMatch[0].length;
    headerPrefixEnd = prefixTo;
    const widgetDec = Decoration.replace({
      widget: new IconWidget(icon, type, prefixFrom),
    });
    collect({ from: prefixFrom, to: prefixTo, dec: widgetDec });
  }

  // Format inline elements on header line after prefix
  applyInlineDecorations(line, headerPrefixEnd, isInsideFencedCode, collect);

  // Line decorations for Body Lines 2..N
  for (let bL = l + 1; bL <= calloutEndLine; bL++) {
    const bLine = doc.line(bL);
    const isLast = bL === calloutEndLine;
    const bodyDec = isLast
      ? Decoration.line({ attributes: { class: `cm-callout-body cm-callout-last cm-callout-${type.toLowerCase()}` } })
      : calloutDecs.body;

    collect({ from: bLine.from, to: bLine.from, dec: bodyDec });

    let contentStart = bLine.from;
    const leadMatch = bLine.text.match(/^>\s?/);
    if (leadMatch) {
      const leadFrom = bLine.from;
      const leadTo = bLine.from + leadMatch[0].length;
      contentStart = leadTo;
      collect({ from: leadFrom, to: leadTo, dec: hiddenMark });
    }

    applyInlineDecorations(bLine, contentStart, isInsideFencedCode, collect);
  }

  return calloutEndLine + 1;
}

/**
 * Detects Markdown table blocks and renders the interactive TableWidget.
 * Returns the next line number to process, or null if not a table.
 */
export function processTableBlock(
  doc: Text,
  l: number,
  startLineNum: number,
  endLineNum: number,
  collect: DecCollector
): number | null {
  const line = doc.line(l);
  const text = line.text;

  if (!text.trim().startsWith('|') && !text.includes('|')) {
    return null;
  }

  // Find beginning of table if scan started mid-table
  let tableStartLine = l;
  while (tableStartLine > startLineNum) {
    const prevText = doc.line(tableStartLine - 1).text;
    if (prevText.trim().startsWith('|') || (prevText.includes('|') && !prevText.trim().startsWith('```'))) {
      tableStartLine--;
    } else {
      break;
    }
  }

  let tableEndLine = l;
  const tableLines: string[] = [];
  for (let tL = tableStartLine; tL <= endLineNum; tL++) {
    const tText = doc.line(tL).text;
    if (tText.trim().startsWith('|') || (tText.includes('|') && !tText.trim().startsWith('```'))) {
      tableEndLine = tL;
      tableLines.push(tText);
    } else {
      break;
    }
  }

  const tableText = tableLines.join('\n');
  const parsed = parseMarkdownTable(tableText);

  if (!parsed || tableLines.length < 2) {
    return null;
  }

  const firstLine = doc.line(tableStartLine);
  const lastLine = doc.line(tableEndLine);

  // Replace first line with interactive TableWidget
  collect({
    from: firstLine.from,
    to: firstLine.to,
    dec: Decoration.replace({
      widget: getCachedWidget(
        `tbl:${firstLine.from}:${lastLine.to}:${tableText.length}`,
        () => new TableWidget(tableText, firstLine.from, lastLine.to)
      ),
    }),
  });

  // Hide lines 2..N cleanly within their own line boundaries
  for (let hideL = tableStartLine + 1; hideL <= tableEndLine; hideL++) {
    const hLine = doc.line(hideL);
    collect({
      from: hLine.from,
      to: hLine.from,
      dec: lineDecHiddenTable,
    });
    if (hLine.from < hLine.to) {
      collect({
        from: hLine.from,
        to: hLine.to,
        dec: hiddenMark,
      });
    }
  }

  return tableEndLine + 1;
}

/**
 * Handles fenced code block lines, Mermaid diagrams, and standard CodeBlockWidgets.
 * Returns the next line number to process, or null if line is not a multi-line replacement.
 */
export function processFencedCodeLine(
  doc: Text,
  _l: number,
  line: { from: number; to: number; text: string },
  fencedRanges: FencedRange[],
  collect: DecCollector
): number | null {
  const text = line.text;
  const trimmed = text.trimStart();
  const isFenceLine = trimmed.startsWith('```');

  if (!isFenceLine) {
    collect({ from: line.from, to: line.from, dec: lineDecCodeBlock });
    return null;
  }

  const targetRange = fencedRanges.find((r) => line.from >= r.from && line.from <= r.to);
  const isOpeningFence = targetRange ? Math.abs(line.from - targetRange.from) < 5 : true;

  if (isOpeningFence && targetRange) {
    const langText = text.replace(/^```/, '').trim();
    const mermaidMatch = langText.match(/^mermaid(?:\|(\d+))?$/i);

    const openingLineNum = doc.lineAt(targetRange.from).number;
    const closingLineNum = doc.lineAt(targetRange.to).number;

    const codeLines: string[] = [];
    for (let cL = openingLineNum + 1; cL < closingLineNum; cL++) {
      codeLines.push(doc.line(cL).text);
    }
    const codeContent = codeLines.join('\n');

    // ─── Special Render for Mermaid Diagrams ───
    if (mermaidMatch) {
      const customWidth = mermaidMatch[1] ? parseInt(mermaidMatch[1], 10) : null;

      collect({
        from: line.from,
        to: line.to,
        dec: Decoration.replace({
          widget: getCachedWidget(
            `mermaid:${targetRange.from}:${targetRange.to}:${customWidth}:${codeContent}`,
            () => new MermaidWidget(codeContent, customWidth, targetRange.from, targetRange.to)
          ),
        }),
      });

      for (let hideL = openingLineNum + 1; hideL <= closingLineNum; hideL++) {
        const hLine = doc.line(hideL);
        collect({ from: hLine.from, to: hLine.from, dec: lineDecHiddenTable });
        if (hLine.from < hLine.to) {
          collect({ from: hLine.from, to: hLine.to, dec: hiddenMark });
        }
      }

      return closingLineNum + 1;
    }

    // ─── Standard CodeBlockWidget ───
    collect({
      from: line.from,
      to: line.to,
      dec: Decoration.replace({
        widget: getCachedWidget(
          `codeblock:${targetRange.from}:${targetRange.to}:${langText}:${codeContent}`,
          () => new CodeBlockWidget(codeContent, langText, targetRange.from, targetRange.to)
        ),
      }),
    });

    for (let hideL = openingLineNum + 1; hideL <= closingLineNum; hideL++) {
      const hLine = doc.line(hideL);
      collect({ from: hLine.from, to: hLine.from, dec: lineDecHiddenTable });
      if (hLine.from < hLine.to) {
        collect({ from: hLine.from, to: hLine.to, dec: hiddenMark });
      }
    }

    return closingLineNum + 1;
  } else {
    // Closing fence line
    collect({ from: line.from, to: line.from, dec: lineDecCodeFooter });
    if (line.from < line.to) {
      collect({ from: line.from, to: line.to, dec: hiddenMark });
    }
    return null;
  }
}

/**
 * Applies line-level styling (Headings, Horizontal Rules, Blockquotes).
 * Returns true if the line was an HR (which also hides the text characters).
 */
export function applyLineStyles(
  line: { from: number; to: number; text: string },
  collect: DecCollector
): boolean {
  const text = line.text;

  // Horizontal Rules: --- or *** or ___
  if (/^(---|[*]{3}|_{3})\s*$/.test(text.trim())) {
    collect({ from: line.from, to: line.from, dec: lineDecHR });
    if (line.from < line.to) {
      collect({ from: line.from, to: line.to, dec: hiddenMark });
    }
    return true;
  }

  // Heading Level: H1..H4
  const hMatch = text.match(/^(#{1,4})\s+/);
  if (hMatch) {
    const level = hMatch[1].length;
    const dec = level === 1 ? lineDecH1 : level === 2 ? lineDecH2 : level === 3 ? lineDecH3 : lineDecH4;
    collect({ from: line.from, to: line.from, dec });
  }

  // Blockquote
  if (text.trimStart().startsWith('>')) {
    collect({ from: line.from, to: line.from, dec: lineDecBlockquote });
  }

  return false;
}
