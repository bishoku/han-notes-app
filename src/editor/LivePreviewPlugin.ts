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
import { CALLOUT_ICONS, calloutLineDecs, IconWidget } from "./preview/calloutDeco";
import { CodeCopyButtonWidget } from "./preview/codeBlockDeco";
import { handleEditorMouseDown } from "./preview/eventHandlers";

const hiddenMark = Decoration.replace({});
const linkMark = Decoration.mark({
  class: "cm-wikilink font-semibold italic text-gray-900 dark:text-gray-100 underline decoration-gray-300 dark:decoration-zinc-600 underline-offset-4 decoration-1 hover:decoration-mac-accent hover:text-mac-accent cursor-pointer transition-colors",
});
const strikethroughMark = Decoration.mark({ class: "cm-strikethrough" });
const highlightMark = Decoration.mark({ class: "cm-highlight" });
const inlineCodeMark = Decoration.mark({ class: "cm-inline-code" });

// Hoisted constants for performance — avoid recreating on each decoration pass
const HIDE_NODES = new Set([
  "HeaderMark", "EmphasisMark", "StrongMark", "ListMark",
  "QuoteMark", "CodeMark", "CommentMark", "HTMLComment"
]);

const lineDecH1 = Decoration.line({ attributes: { class: "cm-h1" } });
const lineDecH2 = Decoration.line({ attributes: { class: "cm-h2" } });
const lineDecH3 = Decoration.line({ attributes: { class: "cm-h3" } });
const lineDecH4 = Decoration.line({ attributes: { class: "cm-h4" } });
const lineDecHidden = Decoration.line({ attributes: { class: "cm-hidden-frontmatter" } });
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

function livePreviewDecorations(view: EditorView) {
  const items: DecItem[] = [];
  const selection = view.state.selection.main;
  const cursorLine = view.state.doc.lineAt(selection.from).number;

  // Hide YAML Frontmatter ALWAYS at document start (0 to closing ---)
  let frontmatterEndLine = -1;
  const doc = view.state.doc;
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

  for (const range of view.visibleRanges) {
    const fencedRanges: Array<{ from: number; to: number }> = [];
    const pendingHides: Array<{ from: number; to: number }> = [];

    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter: (node) => {
        if (node.name === "FencedCode") {
          fencedRanges.push({ from: node.from, to: node.to });
          return;
        }

        const nodeLine = view.state.doc.lineAt(node.from).number;
        if (frontmatterEndLine > 0 && nodeLine <= frontmatterEndLine) return;
        if (nodeLine === cursorLine) return;

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

    // 2. Iterate lines in visible range
    const startLine = view.state.doc.lineAt(range.from).number;
    const endLine = view.state.doc.lineAt(range.to).number;

    let l = startLine;
    while (l <= endLine) {
      if (frontmatterEndLine > 0 && l <= frontmatterEndLine) {
        l++;
        continue;
      }
      const line = view.state.doc.line(l);
      const text = line.text;

      // 1. Detect Callout Header: > [!NOTE] / > [!WARNING] / > [!TIP] / > [!IMPORTANT] / > [!CAUTION]
      const calloutMatch = text.match(/^>\s*\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i);
      if (!isInsideFencedCode(line.from) && calloutMatch) {
        const type = calloutMatch[1].toUpperCase();
        const calloutDecs = calloutLineDecs[type] || calloutLineDecs.NOTE;
        const icon = CALLOUT_ICONS[type] || "ℹ️";

        let calloutEndLine = l;
        for (let nextL = l + 1; nextL <= endLine; nextL++) {
          const nextLine = view.state.doc.line(nextL);
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
        const prefixMatch = text.match(/^>\s*\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
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
          const bLine = view.state.doc.line(bL);
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

      // 2. Detect Horizontal Rules: --- or *** or ___
      if (l !== cursorLine && !isInsideFencedCode(line.from) && /^(---|[*]{3}|_{3})\s*$/.test(text.trim())) {
        items.push({ from: line.from, to: line.from, dec: lineDecHR });
        if (line.from < line.to) {
          items.push({ from: line.from, to: line.to, dec: hiddenMark });
        }
        l++;
        continue;
      }

      // 3. Detect Markdown Table blocks and render TableWidget when cursor is outside table
      if (!isInsideFencedCode(line.from) && (text.trim().startsWith('|') || text.includes('|'))) {
        let tableEndLine = l;
        const tableLines = [text];

        for (let nextL = l + 1; nextL <= endLine; nextL++) {
          const nextLine = view.state.doc.line(nextL);
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
          const firstLine = view.state.doc.line(l);
          const lastLine = view.state.doc.line(tableEndLine);

          if (firstLine.from < firstLine.to) {
            items.push({
              from: firstLine.from,
              to: firstLine.to,
              dec: Decoration.replace({
                widget: new TableWidget(tableText, firstLine.from, lastLine.to),
              }),
            });
          } else {
            items.push({
              from: firstLine.from,
              to: firstLine.from,
              dec: Decoration.widget({
                widget: new TableWidget(tableText, firstLine.from, lastLine.to),
                side: 1,
              }),
            });
          }

          for (let hideL = l + 1; hideL <= tableEndLine; hideL++) {
            const hLine = view.state.doc.line(hideL);
            items.push({
              from: hLine.from,
              to: hLine.from,
              dec: lineDecHidden,
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

      // Apply line-level heading class (cm-h1..cm-h4)
      const hMatch = text.match(/^(#{1,4})\s+/);
      if (hMatch) {
        const level = hMatch[1].length;
        const dec = level === 1 ? lineDecH1 : level === 2 ? lineDecH2 : level === 3 ? lineDecH3 : lineDecH4;
        items.push({ from: line.from, to: line.from, dec });
      }

      // Apply fenced code block line styling & widgets (Header, Body, Footer)
      if (isInsideFencedCode(line.from)) {
        const trimmed = text.trimStart();
        const isFenceLine = trimmed.startsWith('```');
        if (isFenceLine) {
          const targetRange = fencedRanges.find((r) => line.from >= r.from && line.from <= r.to);
          const isOpeningFence = targetRange ? Math.abs(line.from - targetRange.from) < 5 : true;

          if (isOpeningFence && targetRange) {
            // Opening Header Line decoration: cm-codeblock-line cm-codeblock-header
            items.push({ from: line.from, to: line.from, dec: lineDecCodeHeader });

            // Extract code lines inside block for Copy button
            const codeLines: string[] = [];
            const openingLineNum = view.state.doc.lineAt(targetRange.from).number;
            const closingLineNum = view.state.doc.lineAt(targetRange.to).number;

            for (let cL = openingLineNum + 1; cL < closingLineNum; cL++) {
              codeLines.push(view.state.doc.line(cL).text);
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

            // When cursor is NOT on opening line, hide ONLY leading backticks (```), leaving language text editable & visible!
            // When cursor IS on opening line, backticks & language text are 100% EDITABLE by user!
            if (l !== cursorLine) {
              const backtickMatch = text.match(/^```/);
              if (backtickMatch) {
                items.push({
                  from: line.from,
                  to: line.from + 3,
                  dec: hiddenMark,
                });
              }
            }
          } else {
            // Closing Footer Line decoration: cm-codeblock-line cm-codeblock-footer
            items.push({ from: line.from, to: line.from, dec: lineDecCodeFooter });

            // Hide closing backticks (```) when cursor is not on closing line
            if (l !== cursorLine && line.from < line.to) {
              items.push({ from: line.from, to: line.to, dec: hiddenMark });
            }
          }
        } else {
          // Code Body Line: cm-codeblock-line
          items.push({ from: line.from, to: line.from, dec: lineDecCodeBlock });
        }
      }

      // Apply blockquote line styling
      if (text.trimStart().startsWith('>')) {
        items.push({ from: line.from, to: line.from, dec: lineDecBlockquote });
      }

      // Match media ![alt|width](path) for images, GIFs, diagrams, and sketches ALWAYS
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

      // Hide <!-- task:... --> comment metadata ALWAYS
      const commentRe = /<!--\s*task:(.*?)-->/g;
      let cMatch: RegExpExecArray | null;
      while ((cMatch = commentRe.exec(text)) !== null) {
        const commentFrom = line.from + cMatch.index;
        const commentTo = commentFrom + cMatch[0].length;
        
        try {
          const meta = JSON.parse(cMatch[1].trim());
          const widgetDec = Decoration.replace({ widget: new TaskBadgeWidget(meta) });
          items.push({ from: commentFrom, to: commentTo, dec: widgetDec });
        } catch (e) {
          items.push({ from: commentFrom, to: commentTo, dec: hiddenMark });
        }
      }

      // Hide <!-- decision:... --> comment metadata ALWAYS
      const decCommentRe = /<!--\s*decision:(.*?)-->/g;
      let dMatch: RegExpExecArray | null;
      while ((dMatch = decCommentRe.exec(text)) !== null) {
        const commentFrom = line.from + dMatch.index;
        const commentTo = commentFrom + dMatch[0].length;
        
        try {
          const meta = JSON.parse(dMatch[1].trim());
          const widgetDec = Decoration.replace({ widget: new DecisionBadgeWidget(meta) });
          items.push({ from: commentFrom, to: commentTo, dec: widgetDec });
        } catch (e) {
          items.push({ from: commentFrom, to: commentTo, dec: hiddenMark });
        }
      }

      // Hide <!-- diagram:UUID --> comment metadata ALWAYS
      const diagramCommentRe = /<!--\s*diagram:(.*?)\s*-->/g;
      let diagMatch: RegExpExecArray | null;
      while ((diagMatch = diagramCommentRe.exec(text)) !== null) {
        const commentFrom = line.from + diagMatch.index;
        const commentTo = commentFrom + diagMatch[0].length;
        items.push({ from: commentFrom, to: commentTo, dec: hiddenMark });
      }

      if (l !== cursorLine) {
        // Inline Code: `code`
        const codeRe = /`([^`]+)`/g;
        let cdMatch: RegExpExecArray | null;
        while ((cdMatch = codeRe.exec(text)) !== null) {
          const cFrom = line.from + cdMatch.index;
          const cTo = cFrom + cdMatch[0].length;
          items.push({ from: cFrom, to: cFrom + 1, dec: hiddenMark });
          items.push({ from: cFrom + 1, to: cTo - 1, dec: inlineCodeMark });
          items.push({ from: cTo - 1, to: cTo, dec: hiddenMark });
        }

        // Strikethrough: ~~text~~
        const strikeRe = /~~(.*?)~~/g;
        let sMatch: RegExpExecArray | null;
        while ((sMatch = strikeRe.exec(text)) !== null) {
          const sFrom = line.from + sMatch.index;
          const sTo = sFrom + sMatch[0].length;
          items.push({ from: sFrom, to: sFrom + 2, dec: hiddenMark });
          items.push({ from: sFrom + 2, to: sTo - 2, dec: strikethroughMark });
          items.push({ from: sTo - 2, to: sTo, dec: hiddenMark });
        }

        // Highlight: ==text==
        const highlightRe = /==(.*?)==/g;
        let hlMatch: RegExpExecArray | null;
        while ((hlMatch = highlightRe.exec(text)) !== null) {
          const hlFrom = line.from + hlMatch.index;
          const hlTo = hlFrom + hlMatch[0].length;
          items.push({ from: hlFrom, to: hlFrom + 2, dec: hiddenMark });
          items.push({ from: hlFrom + 2, to: hlTo - 2, dec: highlightMark });
          items.push({ from: hlTo - 2, to: hlTo, dec: hiddenMark });
        }

        // Hide [[ and ]] and style wikilinks
        const re = /\[\[(.*?)\]\]/g;
        let match: RegExpExecArray | null;

        while ((match = re.exec(text)) !== null) {
          const matchFrom = line.from + match.index;
          const matchTo = matchFrom + match[0].length;
          const innerFrom = matchFrom + 2;
          const innerTo = matchTo - 2;

          items.push({ from: matchFrom, to: innerFrom, dec: hiddenMark });
          if (innerTo > innerFrom) {
            items.push({ from: innerFrom, to: innerTo, dec: linkMark });
          }
          items.push({ from: innerTo, to: matchTo, dec: hiddenMark });
        }
      }

      // HTML Colored span tags: <span style="color: #ef4444">text</span>
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

        const cursorInOpenTag = cursorLine === l && selection.from >= openTagFrom && selection.from <= openTagTo;
        const cursorInCloseTag = cursorLine === l && selection.from >= closeTagFrom && selection.from <= closeTagTo;

        if (!cursorInOpenTag && !cursorInCloseTag) {
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
      }

      l++;
    }
  }

  items.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return (a.to - a.from) - (b.to - b.from);
  });

  const builder = new RangeSetBuilder<Decoration>();
  for (const item of items) {
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
