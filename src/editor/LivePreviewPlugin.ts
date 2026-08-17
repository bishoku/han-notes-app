import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
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
import { CodeLangBadgeWidget } from "./widgets/CodeLangBadgeWidget";
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

// Hoisted regex objects
const imgRe = /!\[(.*?)\]\((.*?)\)/g;
const commentRe = /<!--\s*task:(.*?)-->/g;
const decCommentRe = /<!--\s*decision:(.*?)-->/g;
const diagramCommentRe = /<!--\s*diagram:(.*?)\s*-->/g;
const codeRe = /`([^`]+)`/g;
const strikeRe = /~~(.*?)~~/g;
const highlightRe = /==(.*?)==/g;
const wikilinkRe = /\[\[(.*?)\]\]/g;
const webLinkRe = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const spanColorRe = /<span\s+style=["']color:\s*([^"';]+)[^"']*["']>([\s\S]*?)<\/span>/gi;

// Module-level cache for parsed metadata
const _metaCache = new Map<string, any>();
function parseCachedMeta(raw: string): any | null {
  const trimmed = raw.trim();
  const cached = _metaCache.get(trimmed);
  if (cached) return cached;
  try {
    const parsed = JSON.parse(trimmed);
    _metaCache.set(trimmed, parsed);
    if (_metaCache.size > 200) {
      const firstKey = _metaCache.keys().next().value;
      if (firstKey !== undefined) _metaCache.delete(firstKey);
    }
    return parsed;
  } catch {
    return null;
  }
}

interface DecItem {
  from: number;
  to: number;
  dec: Decoration;
}

// Module-level widget cache — reuse widget instances across scroll-triggered rebuilds.
// Key format: "type:from:to:identifiers" — auto-invalidates on doc changes because positions shift.
const _widgetCache = new Map<string, WidgetType>();
const MAX_WIDGET_CACHE = 300;

function getCachedWidget<T extends WidgetType>(
  key: string,
  factory: () => T
): T {
  const cached = _widgetCache.get(key);
  if (cached) return cached as T;
  const widget = factory();
  _widgetCache.set(key, widget);
  if (_widgetCache.size > MAX_WIDGET_CACHE) {
    const firstKey = _widgetCache.keys().next().value;
    if (firstKey !== undefined) _widgetCache.delete(firstKey);
  }
  return widget;
}

export function livePreviewDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  if (doc.length === 0) {
    return Decoration.none;
  }

  // 1. Calculate Visible Viewport Range with a generous buffer (~50 lines before/after)
  let startPos = doc.length;
  let endPos = 0;
  for (const range of view.visibleRanges) {
    if (range.from < startPos) startPos = range.from;
    if (range.to > endPos) endPos = range.to;
  }
  if (startPos > endPos) {
    startPos = 0;
    endPos = Math.min(doc.length, 3000);
  }

  // Buffer ~3000 chars above and below to prevent visual popping during fast scrolling
  const startLineNum = Math.max(1, doc.lineAt(Math.max(0, startPos - 3000)).number);
  const endLineNum = Math.min(doc.lines, doc.lineAt(Math.min(doc.length, endPos + 3000)).number);
  const scanFrom = doc.line(startLineNum).from;
  const scanTo = doc.line(endLineNum).to;

  const items: DecItem[] = [];

  // 2. Hide YAML Frontmatter if within or near the top
  let frontmatterEndLine = -1;
  if (startLineNum <= 2 && doc.lines > 0) {
    const firstLine = doc.line(1);
    if (firstLine.text.trim().startsWith("---")) {
      let closingLineNum = 0;
      for (let l = 2; l <= Math.min(doc.lines, 40); l++) {
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

  // 3. Syntax Tree Pass: ONLY for the buffered visible range [scanFrom, scanTo]
  const fencedRanges: Array<{ from: number; to: number }> = [];
  const pendingHides: Array<{ from: number; to: number }> = [];

  syntaxTree(view.state).iterate({
    from: scanFrom,
    to: scanTo,
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

  // Binary search over sorted fencedRanges — O(log n) instead of O(n) per call.
  // Called ~15+ times per line, so this matters in notes with many code blocks.
  const isInsideFencedCode = (pos: number): boolean => {
    let lo = 0, hi = fencedRanges.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = fencedRanges[mid];
      if (pos < r.from) hi = mid - 1;
      else if (pos > r.to) lo = mid + 1;
      else return true;
    }
    return false;
  };

  for (const h of pendingHides) {
    if (h.from === h.to) continue;
    if (isInsideFencedCode(h.from)) continue;
    items.push({ from: h.from, to: h.to, dec: hiddenMark });
  }

  // 4. Viewport-scoped Line by Line Processing
  let l = startLineNum;
  while (l <= endLineNum) {
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

      // Replace prefix `> [!NOTE] ` with atomic IconWidget
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

      if (parsed && tableLines.length >= 2) {
        const firstLine = doc.line(tableStartLine);
        const lastLine = doc.line(tableEndLine);

        // Replace the first line with the interactive TableWidget
        items.push({
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
          items.push({ from: line.from, to: line.from, dec: lineDecCodeHeader });

          // Extract code lines inside block for Copy button
          const codeLines: string[] = [];
          const openingLineNum = doc.lineAt(targetRange.from).number;
          const closingLineNum = doc.lineAt(targetRange.to).number;

          for (let cL = openingLineNum + 1; cL < closingLineNum; cL++) {
            codeLines.push(doc.line(cL).text);
          }
          const codeText = codeLines.join('\n');

          items.push({
            from: line.from,
            to: line.from,
            dec: Decoration.widget({
              widget: getCachedWidget(
                `copy:${targetRange.from}:${codeText.length}`,
                () => new CodeCopyButtonWidget(codeText)
              ),
              side: 1,
            }),
          });

          // Replace entire fence line (```lang) with language badge widget
          const langText = text.replace(/^```/, '').trim();
          if (line.from < line.to) {
            // Hide the entire line content (backticks + language)
            items.push({
              from: line.from,
              to: line.to,
              dec: Decoration.replace({
                widget: getCachedWidget(
                  `lang:${line.from}:${langText}`,
                  () => new CodeLangBadgeWidget(langText)
                ),
              }),
            });
          }
        } else {
          items.push({ from: line.from, to: line.from, dec: lineDecCodeFooter });

          // Hide closing backticks (```)
          if (line.from < line.to) {
            items.push({ from: line.from, to: line.to, dec: hiddenMark });
          }
        }
      } else {
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

    // G. Match media ![alt|width](path) for images, GIFs, diagrams, and sketches
    imgRe.lastIndex = 0;
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

      const widget = getCachedWidget(
        `img:${imgFrom}:${imgTo}:${relPath}:${width}`,
        () => new ResizableImageWidget(altText, width, relPath, imgFrom, imgTo)
      );
      const widgetDec = Decoration.replace({ widget });
      items.push({ from: imgFrom, to: imgTo, dec: widgetDec });
    }

    // H. Hide <!-- task:... --> comment metadata and render TaskBadgeWidget
    commentRe.lastIndex = 0;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = commentRe.exec(text)) !== null) {
      const commentFrom = line.from + cMatch.index;
      const commentTo = commentFrom + cMatch[0].length;
      
      const meta = parseCachedMeta(cMatch[1]);
      if (meta) {
        const widget = getCachedWidget(
          `task:${commentFrom}:${commentTo}`,
          () => new TaskBadgeWidget(meta)
        );
        const widgetDec = Decoration.replace({ widget });
        items.push({ from: commentFrom, to: commentTo, dec: widgetDec });
      } else {
        items.push({ from: commentFrom, to: commentTo, dec: hiddenMark });
      }
    }

    // I. Hide <!-- decision:... --> comment metadata and render DecisionBadgeWidget
    decCommentRe.lastIndex = 0;
    let dMatch: RegExpExecArray | null;
    while ((dMatch = decCommentRe.exec(text)) !== null) {
      const commentFrom = line.from + dMatch.index;
      const commentTo = commentFrom + dMatch[0].length;
      
      const meta = parseCachedMeta(dMatch[1]);
      if (meta) {
        const widget = getCachedWidget(
          `dec:${commentFrom}:${commentTo}`,
          () => new DecisionBadgeWidget(meta)
        );
        const widgetDec = Decoration.replace({ widget });
        items.push({ from: commentFrom, to: commentTo, dec: widgetDec });
      } else {
        items.push({ from: commentFrom, to: commentTo, dec: hiddenMark });
      }
    }

    // J. Hide <!-- diagram:UUID --> comment metadata
    diagramCommentRe.lastIndex = 0;
    let diagMatch: RegExpExecArray | null;
    while ((diagMatch = diagramCommentRe.exec(text)) !== null) {
      const commentFrom = line.from + diagMatch.index;
      const commentTo = commentFrom + diagMatch[0].length;
      items.push({ from: commentFrom, to: commentTo, dec: hiddenMark });
    }

    // K. Inline Code: `code`
    codeRe.lastIndex = 0;
    let cdMatch: RegExpExecArray | null;
    while ((cdMatch = codeRe.exec(text)) !== null) {
      const cFrom = line.from + cdMatch.index;
      const cTo = cFrom + cdMatch[0].length;
      items.push({ from: cFrom, to: cFrom + 1, dec: hiddenMark });
      items.push({ from: cFrom + 1, to: cTo - 1, dec: inlineCodeMark });
      items.push({ from: cTo - 1, to: cTo, dec: hiddenMark });
    }

    // L. Strikethrough: ~~text~~
    strikeRe.lastIndex = 0;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = strikeRe.exec(text)) !== null) {
      const sFrom = line.from + sMatch.index;
      const sTo = sFrom + sMatch[0].length;
      items.push({ from: sFrom, to: sFrom + 2, dec: hiddenMark });
      items.push({ from: sFrom + 2, to: sTo - 2, dec: strikethroughMark });
      items.push({ from: sTo - 2, to: sTo, dec: hiddenMark });
    }

    // M. Highlight: ==text==
    highlightRe.lastIndex = 0;
    let hlMatch: RegExpExecArray | null;
    while ((hlMatch = highlightRe.exec(text)) !== null) {
      const hlFrom = line.from + hlMatch.index;
      const hlTo = hlFrom + hlMatch[0].length;
      items.push({ from: hlFrom, to: hlFrom + 2, dec: hiddenMark });
      items.push({ from: hlFrom + 2, to: hlTo - 2, dec: highlightMark });
      items.push({ from: hlTo - 2, to: hlTo, dec: hiddenMark });
    }

    // N. Wikilinks [[Note Title]]
    wikilinkRe.lastIndex = 0;
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

      const widget = getCachedWidget(
        `wl:${matchFrom}:${matchTo}:${target}`,
        () => new WikilinkWidget(target, display, matchFrom, matchTo)
      );
      items.push({
        from: matchFrom,
        to: matchTo,
        dec: Decoration.replace({ widget }),
      });
    }

    // Standard Markdown Links: [Label](url)
    webLinkRe.lastIndex = 0;
    let wlMatch: RegExpExecArray | null;
    while ((wlMatch = webLinkRe.exec(text)) !== null) {
      const linkFrom = line.from + wlMatch.index;
      const linkTo = linkFrom + wlMatch[0].length;
      const label = wlMatch[1];
      const url = wlMatch[2];

      const widget = getCachedWidget(
        `web:${linkFrom}:${linkTo}:${url}`,
        () => new WebLinkWidget(label, url, linkFrom, linkTo)
      );
      items.push({
        from: linkFrom,
        to: linkTo,
        dec: Decoration.replace({ widget }),
      });
    }

    // O. HTML Colored span tags: <span style="color: #ef4444">text</span>
    spanColorRe.lastIndex = 0;
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

  // Single-pass sort: line decorations (from===to) come first at each position,
  // then range decorations sorted by ascending from, ascending length
  items.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    // Line decorations (from===to) before range decorations at same position
    const aIsLine = a.from === a.to ? 0 : 1;
    const bIsLine = b.from === b.to ? 0 : 1;
    if (aIsLine !== bIsLine) return aIsLine - bIsLine;
    return (a.to - a.from) - (b.to - b.from);
  });

  // Single-pass overlap filtering + builder construction
  const builder = new RangeSetBuilder<Decoration>();
  let lastReplaceEnd = -1;

  for (const item of items) {
    if (item.from === item.to) {
      // Line decoration — always valid
      builder.add(item.from, item.to, item.dec);
    } else {
      const isReplace = (item.dec as any).spec?.widget !== undefined || (item.dec as any).spec?.inclusive !== undefined;
      if (isReplace) {
        if (item.from < lastReplaceEnd) continue;
        lastReplaceEnd = item.to;
      } else {
        if (item.from < lastReplaceEnd && item.to > lastReplaceEnd) continue;
      }
      builder.add(item.from, item.to, item.dec);
    }
  }

  return builder.finish();
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private _rafId: number | null = null;

    constructor(view: EditorView) {
      this.decorations = livePreviewDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        // Document change: rebuild immediately for responsive typing.
        // Also clear widget cache since positions have shifted.
        _widgetCache.clear();
        if (this._rafId !== null) {
          cancelAnimationFrame(this._rafId);
          this._rafId = null;
        }
        this.decorations = livePreviewDecorations(update.view);
      } else if (update.viewportChanged) {
        // Scroll: throttle to animation frame boundary (max 1 rebuild per 16ms @ 60fps).
        // Previous decorations stay visible during the gap — no blank flash.
        if (this._rafId === null) {
          this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            this.decorations = livePreviewDecorations(update.view);
            update.view.requestMeasure();
          });
        }
      } else if (this.decorations.size === 0 && update.view.state.doc.length > 10) {
        // Safety net: after a mode switch (raw → preview), the syntax tree may not
        // be fully parsed when the constructor runs, producing empty decorations.
        // Detect this once and schedule a rebuild. Cost: one extra rAF, fires only once.
        if (this._rafId === null) {
          this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            this.decorations = livePreviewDecorations(update.view);
            update.view.requestMeasure();
          });
        }
      }
    }

    destroy() {
      if (this._rafId !== null) {
        cancelAnimationFrame(this._rafId);
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

