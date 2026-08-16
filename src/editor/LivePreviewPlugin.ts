import {
  Decoration,
  EditorView,
  ViewPlugin,
} from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { ResizableImageWidget } from "./widgets/ResizableImageWidget";
import { DecisionBadgeWidget } from "./widgets/DecisionBadgeWidget";
import { TaskBadgeWidget } from "./widgets/TaskBadgeWidget";
import { TableWidget, parseMarkdownTable } from "./widgets/TableWidget";
import { WikilinkWidget, WebLinkWidget } from "./widgets/WikilinkWidget";
import { TaskCheckboxWidget } from "./widgets/TaskCheckboxWidget";
import { DecisionPrefixWidget } from "./widgets/DecisionPrefixWidget";
import { CALLOUT_ICONS, calloutLineDecs, IconWidget } from "./preview/calloutDeco";
import { CodeCopyButtonWidget } from "./preview/codeBlockDeco";
import { handleEditorMouseDown } from "./preview/eventHandlers";

const hiddenMark = Decoration.replace({});
const strikethroughMark = Decoration.mark({ class: "cm-strikethrough" });
const highlightMark = Decoration.mark({ class: "cm-highlight" });
const inlineCodeMark = Decoration.mark({ class: "cm-inline-code" });

// Hoisted constants for performance — avoid recreating on each decoration pass
const HIDE_NODES = new Set([
  "HeaderMark", "EmphasisMark", "StrongMark",
  "QuoteMark", "CodeMark", "CommentMark", "HTMLComment"
]);

const lineDecH1 = Decoration.line({ attributes: { class: "cm-h1" } });
const lineDecH2 = Decoration.line({ attributes: { class: "cm-h2" } });
const lineDecH3 = Decoration.line({ attributes: { class: "cm-h3" } });
const lineDecH4 = Decoration.line({ attributes: { class: "cm-h4" } });
const lineDecHidden = Decoration.line({ attributes: { class: "cm-hidden-frontmatter" } });
const lineDecHiddenTable = Decoration.line({ attributes: { class: "cm-hidden-table-line" } });
const lineDecCodeBlock = Decoration.line({ attributes: { class: "cm-codeblock-line" } });
const lineDecCodeHeader = Decoration.line({ attributes: { class: "cm-codeblock-line cm-codeblock-header" } });
const lineDecCodeFooter = Decoration.line({ attributes: { class: "cm-codeblock-line cm-codeblock-footer" } });
const lineDecBlockquote = Decoration.line({ attributes: { class: "cm-blockquote-line" } });
const lineDecHR = Decoration.line({ attributes: { class: "cm-hr-line" } });

interface DecItem {
  from: number;
  to: number;
  dec: Decoration;
}

export function livePreviewDecorations(view: EditorView): DecorationSet {
  const items: DecItem[] = [];
  const doc = view.state.doc;
  if (doc.length === 0) {
    return Decoration.none;
  }

  // 1. Hide YAML Frontmatter ALWAYS at document start (0 to closing ---)
  let frontmatterEndLine = -1;
  if (doc.lines > 0) {
    const firstLine = doc.line(1);
    if (firstLine.text.trim().startsWith("---")) {
      let closingLineNum = 0;
      for (let l = 2; l <= doc.lines; l++) {
        const line = doc.line(l);
        if (line.text.trim().startsWith("---")) {
          closingLineNum = l;
          break;
        }
      }

      if (closingLineNum > 0) {
        frontmatterEndLine = closingLineNum;
        if (closingLineNum < doc.lines && doc.line(closingLineNum + 1).text.trim() === '') {
          frontmatterEndLine = closingLineNum + 1;
        }
        for (let l = 1; l <= frontmatterEndLine; l++) {
          const fLine = doc.line(l);
          items.push({ from: fLine.from, to: fLine.from, dec: lineDecHidden });
        }
      }
    }
  }

  // 2. Full-Document Syntax Tree Pass: Collect FencedCode ranges and markdown marks to hide
  const fencedRanges: Array<{ from: number; to: number }> = [];
  const pendingHides: Array<{ from: number; to: number }> = [];

  syntaxTree(view.state).iterate({
    from: 0,
    to: doc.length,
    enter: (node) => {
      if (node.name === "FencedCode") {
        fencedRanges.push({ from: node.from, to: node.to });
        return;
      }

      if (node.name === "ListMark" || node.name === "TaskMarker" || node.name === "Task") {
        return;
      }

      if (HIDE_NODES.has(node.name)) {
        pendingHides.push({ from: node.from, to: node.to });
      }
    },
  });

  const isInsideFencedCode = (pos: number) =>
    fencedRanges.some((r) => pos >= r.from && pos <= r.to);

  for (const h of pendingHides) {
    if (h.from === h.to) continue;
    if (isInsideFencedCode(h.from)) continue;
    items.push({ from: h.from, to: h.to, dec: hiddenMark });
  }

  // 3. Full-Document Line by Line Processing
  let l = 1;
  while (l <= doc.lines) {
    if (frontmatterEndLine > 0 && l <= frontmatterEndLine) {
      l++;
      continue;
    }
    const line = doc.line(l);
    const text = line.text;

    // A. Detect Callout Header: > [!NOTE] / > [!WARNING] / > [!TIP] / > [!IMPORTANT] / > [!CAUTION]
    const calloutMatch = text.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i);
    if (!isInsideFencedCode(line.from) && calloutMatch) {
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

      // Line decoration for Header (Line 1)
      items.push({
        from: line.from,
        to: line.from,
        dec: isSingleLine ? calloutDecs.single : calloutDecs.header,
      });

      // ALWAYS replace prefix `> [!NOTE] ` with atomic IconWidget so Title text is 100% clean and selectable!
      const prefixMatch = text.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
      if (prefixMatch) {
        const prefixFrom = line.from;
        const prefixTo = line.from + prefixMatch[0].length;
        const widgetDec = Decoration.replace({
          widget: new IconWidget(icon, type, prefixFrom),
        });
        items.push({ from: prefixFrom, to: prefixTo, dec: widgetDec });
      }

      // Line decorations for Body Lines 2..N
      for (let bL = l + 1; bL <= calloutEndLine; bL++) {
        const bLine = doc.line(bL);
        const isLast = bL === calloutEndLine;
        const bodyDec = isLast
          ? Decoration.line({ attributes: { class: `cm-callout-body cm-callout-last cm-callout-${type.toLowerCase()}` } })
          : calloutDecs.body;

        items.push({ from: bLine.from, to: bLine.from, dec: bodyDec });

        // ALWAYS hide leading `>` on body lines so Description text is 100% clean and selectable!
        const leadMatch = bLine.text.match(/^>\s?/);
        if (leadMatch) {
          const leadFrom = bLine.from;
          const leadTo = bLine.from + leadMatch[0].length;
          items.push({ from: leadFrom, to: leadTo, dec: hiddenMark });
        }
      }

      l = calloutEndLine + 1;
      continue;
    }

    // B. Detect Horizontal Rules: --- or *** or ___
    if (!isInsideFencedCode(line.from) && /^(---|[*]{3}|_{3})\s*$/.test(text.trim())) {
      items.push({ from: line.from, to: line.from, dec: lineDecHR });
      if (line.from < line.to) {
        items.push({ from: line.from, to: line.to, dec: hiddenMark });
      }
      l++;
      continue;
    }

    // C. Detect Markdown Table blocks and render TableWidget ALWAYS
    if (!isInsideFencedCode(line.from) && (text.trim().startsWith('|') || text.includes('|'))) {
      let tableEndLine = l;
      const tableLines = [text];

      for (let nextL = l + 1; nextL <= doc.lines; nextL++) {
        const nextLine = doc.line(nextL);
        const nextText = nextLine.text;
        if (nextText.trim().startsWith('|') || (nextText.includes('|') && !nextText.trim().startsWith('```'))) {
          tableEndLine = nextL;
          tableLines.push(nextText);
        } else {
          break;
        }
      }

      const tableText = tableLines.join('\n');
      const parsed = parseMarkdownTable(tableText);

      if (parsed && tableLines.length >= 2) {
        const firstLine = doc.line(l);
        const lastLine = doc.line(tableEndLine);

        // 1. Replace the first line with the interactive TableWidget
        items.push({
          from: firstLine.from,
          to: firstLine.to,
          dec: Decoration.replace({
            widget: new TableWidget(tableText, firstLine.from, lastLine.to),
          }),
        });

        // 2. Hide lines 2..N cleanly within their own line boundaries
        for (let hideL = l + 1; hideL <= tableEndLine; hideL++) {
          const hLine = doc.line(hideL);
          items.push({
            from: hLine.from,
            to: hLine.from,
            dec: lineDecHiddenTable,
          });
          if (hLine.from < hLine.to) {
            items.push({
              from: hLine.from,
              to: hLine.to,
              dec: hiddenMark,
            });
          }
        }

        l = tableEndLine + 1;
        continue;
      }
    }

    // D. Apply line-level heading class (cm-h1..cm-h4)
    const hMatch = text.match(/^(#{1,4})\s+/);
    if (hMatch) {
      const level = hMatch[1].length;
      const dec = level === 1 ? lineDecH1 : level === 2 ? lineDecH2 : level === 3 ? lineDecH3 : lineDecH4;
      items.push({ from: line.from, to: line.from, dec });
    }

    // E. Apply fenced code block line styling & widgets (Header, Body, Footer)
    if (isInsideFencedCode(line.from)) {
      const trimmed = text.trimStart();
      const isFenceLine = trimmed.startsWith('```');
      if (isFenceLine) {
        const targetRange = fencedRanges.find((r) => line.from >= r.from && line.from <= r.to);
        const isOpeningFence = targetRange ? Math.abs(line.from - targetRange.from) < 5 : true;

        if (isOpeningFence && targetRange) {
          // Opening Header Line decoration
          items.push({ from: line.from, to: line.from, dec: lineDecCodeHeader });

          // Extract code lines inside block for Copy button
          const codeLines: string[] = [];
          const openingLineNum = doc.lineAt(targetRange.from).number;
          const closingLineNum = doc.lineAt(targetRange.to).number;

          for (let cL = openingLineNum + 1; cL < closingLineNum; cL++) {
            codeLines.push(doc.line(cL).text);
          }
          const codeText = codeLines.join('\n');

          // Attach Copy Button on the right of header line
          items.push({
            from: line.from,
            to: line.from,
            dec: Decoration.widget({
              widget: new CodeCopyButtonWidget(codeText),
              side: 1,
            }),
          });

          // Hide leading backticks (```), leaving language text cleanly visible
          const backtickMatch = text.match(/^```/);
          if (backtickMatch) {
            items.push({
              from: line.from,
              to: line.from + 3,
              dec: hiddenMark,
            });
          }
        } else {
          // Closing Footer Line decoration
          items.push({ from: line.from, to: line.from, dec: lineDecCodeFooter });

          // Hide closing backticks (```)
          if (line.from < line.to) {
            items.push({ from: line.from, to: line.to, dec: hiddenMark });
          }
        }
      } else {
        // Code Body Line
        items.push({ from: line.from, to: line.from, dec: lineDecCodeBlock });
      }
    }

    // F. Apply blockquote line styling
    if (text.trimStart().startsWith('>')) {
      items.push({ from: line.from, to: line.from, dec: lineDecBlockquote });
    }

    // F2. Interactive Task Checkbox Widget: - [ ] or - [x] or [ ] or [x]
    const taskMatch = text.match(/^(\s*(?:[-*+]\s+)?)\[([ xX])\](\s*)/);
    if (!isInsideFencedCode(line.from) && taskMatch) {
      const isChecked = taskMatch[2].toLowerCase() === 'x';
      const bracketIndex = text.indexOf('[');
      const boxStart = line.from + bracketIndex;
      const boxEnd = boxStart + 3;
      const prefixFrom = line.from;
      const prefixTo = line.from + taskMatch[0].length;

      items.push({
        from: prefixFrom,
        to: prefixTo,
        dec: Decoration.replace({
          widget: new TaskCheckboxWidget(isChecked, boxStart, boxEnd),
        }),
      });
    }

    // F3. Decision Record Prefix Widget: - [D] or [D]
    const decMatch = text.match(/^(\s*(?:[-*+]\s+)?)\[[Dd]\](\s*)/);
    if (!isInsideFencedCode(line.from) && decMatch) {
      const prefixFrom = line.from;
      const prefixTo = line.from + decMatch[0].length;

      items.push({
        from: prefixFrom,
        to: prefixTo,
        dec: Decoration.replace({
          widget: new DecisionPrefixWidget(),
        }),
      });
    }

    // G. Match media ![alt|width](path) for images, GIFs, diagrams, and sketches ALWAYS
    const imgRe = /!\[(.*?)\]\((.*?)\)/g;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = imgRe.exec(text)) !== null) {
      const imgFrom = line.from + imgMatch.index;
      const imgTo = imgFrom + imgMatch[0].length;
      
      const rawAlt = imgMatch[1].trim();
      const relPath = imgMatch[2].trim();
      
      let altText = rawAlt;
      let width: number | null = null;
      
      if (rawAlt.includes("|")) {
        const parts = rawAlt.split("|");
        altText = parts[0].trim();
        const parsedWidth = parseInt(parts[1].trim(), 10);
        if (!isNaN(parsedWidth)) {
          width = parsedWidth;
        }
      }

      const widgetDec = Decoration.replace({
        widget: new ResizableImageWidget(altText, width, relPath, imgFrom, imgTo)
      });
      items.push({ from: imgFrom, to: imgTo, dec: widgetDec });
    }

    // H. Hide <!-- task:... --> comment metadata ALWAYS and render TaskBadgeWidget
    const commentRe = /<!--\s*task:(.*?)-->/g;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = commentRe.exec(text)) !== null) {
      const commentFrom = line.from + cMatch.index;
      const commentTo = commentFrom + cMatch[0].length;
      
      try {
        const meta = JSON.parse(cMatch[1].trim());
        const widgetDec = Decoration.replace({ widget: new TaskBadgeWidget(meta) });
        items.push({ from: commentFrom, to: commentTo, dec: widgetDec });
      } catch {
        items.push({ from: commentFrom, to: commentTo, dec: hiddenMark });
      }
    }

    // I. Hide <!-- decision:... --> comment metadata ALWAYS and render DecisionBadgeWidget
    const decCommentRe = /<!--\s*decision:(.*?)-->/g;
    let dMatch: RegExpExecArray | null;
    while ((dMatch = decCommentRe.exec(text)) !== null) {
      const commentFrom = line.from + dMatch.index;
      const commentTo = commentFrom + dMatch[0].length;
      
      try {
        const meta = JSON.parse(dMatch[1].trim());
        const widgetDec = Decoration.replace({ widget: new DecisionBadgeWidget(meta) });
        items.push({ from: commentFrom, to: commentTo, dec: widgetDec });
      } catch {
        items.push({ from: commentFrom, to: commentTo, dec: hiddenMark });
      }
    }

    // J. Hide <!-- diagram:UUID --> comment metadata ALWAYS
    const diagramCommentRe = /<!--\s*diagram:(.*?)\s*-->/g;
    let diagMatch: RegExpExecArray | null;
    while ((diagMatch = diagramCommentRe.exec(text)) !== null) {
      const commentFrom = line.from + diagMatch.index;
      const commentTo = commentFrom + diagMatch[0].length;
      items.push({ from: commentFrom, to: commentTo, dec: hiddenMark });
    }

    // K. Inline Code: `code` (ALWAYS hidden marks in preview mode)
    const codeRe = /`([^`]+)`/g;
    let cdMatch: RegExpExecArray | null;
    while ((cdMatch = codeRe.exec(text)) !== null) {
      const cFrom = line.from + cdMatch.index;
      const cTo = cFrom + cdMatch[0].length;
      items.push({ from: cFrom, to: cFrom + 1, dec: hiddenMark });
      items.push({ from: cFrom + 1, to: cTo - 1, dec: inlineCodeMark });
      items.push({ from: cTo - 1, to: cTo, dec: hiddenMark });
    }

    // L. Strikethrough: ~~text~~ (ALWAYS hidden marks in preview mode)
    const strikeRe = /~~(.*?)~~/g;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = strikeRe.exec(text)) !== null) {
      const sFrom = line.from + sMatch.index;
      const sTo = sFrom + sMatch[0].length;
      items.push({ from: sFrom, to: sFrom + 2, dec: hiddenMark });
      items.push({ from: sFrom + 2, to: sTo - 2, dec: strikethroughMark });
      items.push({ from: sTo - 2, to: sTo, dec: hiddenMark });
    }

    // M. Highlight: ==text== (ALWAYS hidden marks in preview mode)
    const highlightRe = /==(.*?)==/g;
    let hlMatch: RegExpExecArray | null;
    while ((hlMatch = highlightRe.exec(text)) !== null) {
      const hlFrom = line.from + hlMatch.index;
      const hlTo = hlFrom + hlMatch[0].length;
      items.push({ from: hlFrom, to: hlFrom + 2, dec: hiddenMark });
      items.push({ from: hlFrom + 2, to: hlTo - 2, dec: highlightMark });
      items.push({ from: hlTo - 2, to: hlTo, dec: hiddenMark });
    }

    // N. Wikilinks [[Note Title]] (Atomic inline widget in preview mode)
    const wikilinkRe = /\[\[(.*?)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = wikilinkRe.exec(text)) !== null) {
      const matchFrom = line.from + match.index;
      const matchTo = matchFrom + match[0].length;
      const rawContent = match[1].trim();
      if (!rawContent) continue;

      let target = rawContent;
      let display = rawContent;
      if (rawContent.includes('|')) {
        const parts = rawContent.split('|');
        target = parts[0].trim();
        display = parts[1].trim() || target;
      }

      items.push({
        from: matchFrom,
        to: matchTo,
        dec: Decoration.replace({
          widget: new WikilinkWidget(target, display, matchFrom, matchTo),
        }),
      });
    }

    // Standard Markdown Links: [Label](url) (Atomic inline widget)
    const webLinkRe = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let wlMatch: RegExpExecArray | null;
    while ((wlMatch = webLinkRe.exec(text)) !== null) {
      const linkFrom = line.from + wlMatch.index;
      const linkTo = linkFrom + wlMatch[0].length;
      const label = wlMatch[1];
      const url = wlMatch[2];

      items.push({
        from: linkFrom,
        to: linkTo,
        dec: Decoration.replace({
          widget: new WebLinkWidget(label, url, linkFrom, linkTo),
        }),
      });
    }

    // O. HTML Colored span tags: <span style="color: #ef4444">text</span>
    const spanColorRe = /<span\s+style=["']color:\s*([^"';]+)[^"']*["']>([\s\S]*?)<\/span>/gi;
    let spanMatch: RegExpExecArray | null;
    while ((spanMatch = spanColorRe.exec(text)) !== null) {
      const matchFrom = line.from + spanMatch.index;
      const matchTo = matchFrom + spanMatch[0].length;
      const openTagLength = spanMatch[0].indexOf('>') + 1;
      const openTagFrom = matchFrom;
      const openTagTo = matchFrom + openTagLength;
      const closeTagFrom = matchTo - 7;
      const closeTagTo = matchTo;
      const color = spanMatch[1].trim();

      items.push({ from: openTagFrom, to: openTagTo, dec: hiddenMark });
      if (closeTagFrom > openTagTo) {
        items.push({
          from: openTagTo,
          to: closeTagFrom,
          dec: Decoration.mark({
            attributes: { style: `color: ${color}; font-weight: 500;` },
          }),
        });
      }
      items.push({ from: closeTagFrom, to: closeTagTo, dec: hiddenMark });
    }

    l++;
  }

  // Separate line decorations and range decorations
  const lineDecs: DecItem[] = [];
  const rangeDecs: DecItem[] = [];

  for (const item of items) {
    if (item.from === item.to) {
      lineDecs.push(item);
    } else {
      rangeDecs.push(item);
    }
  }

  // Sort range decorations: start position ascending, length descending
  rangeDecs.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return (b.to - b.from) - (a.to - a.from);
  });

  // Filter out any range decorations that overlap with earlier replace widgets
  const validRangeDecs: DecItem[] = [];
  let lastReplaceEnd = -1;

  for (const item of rangeDecs) {
    const isReplace = (item.dec as any).spec?.widget !== undefined || (item.dec as any).spec?.inclusive !== undefined;
    if (isReplace) {
      if (item.from < lastReplaceEnd) {
        // Overlaps with previous replace range, skip to prevent crash/invalidation
        continue;
      }
      lastReplaceEnd = item.to;
      validRangeDecs.push(item);
    } else {
      // Mark decoration: only keep if not inside an active replace widget
      if (item.from >= lastReplaceEnd || item.to <= lastReplaceEnd) {
        validRangeDecs.push(item);
      }
    }
  }

  // Combine and sort properly for RangeSetBuilder:
  // CodeMirror requires from ascending; if from is equal, line decs first, then larger ranges
  const allDecs = [...lineDecs, ...validRangeDecs];
  allDecs.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return (a.to - a.from) - (b.to - b.from);
  });

  const builder = new RangeSetBuilder<Decoration>();
  for (const item of allDecs) {
    builder.add(item.from, item.to, item.dec);
  }

  return builder.finish();
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = livePreviewDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = livePreviewDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      mousedown: handleEditorMouseDown,
    },
  }
);
