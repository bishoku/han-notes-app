import {
  Decoration,
  EditorView,
  ViewPlugin,
} from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { useNoteStore } from "@/store/noteStore";
import { useUiStore } from "@/store/uiStore";
import { ResizableImageWidget } from "./widgets/ResizableImageWidget";
import { TaskBadgeWidget } from "./widgets/TaskBadgeWidget";
import { DecisionBadgeWidget } from "./widgets/DecisionBadgeWidget";

const hiddenMark = Decoration.replace({});
const linkMark = Decoration.mark({
  class: "cm-wikilink font-semibold italic text-gray-900 dark:text-gray-100 underline decoration-gray-300 dark:decoration-zinc-600 underline-offset-4 decoration-1 hover:decoration-mac-accent hover:text-mac-accent cursor-pointer transition-colors",
});

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
const lineDecCodeFence = Decoration.line({ attributes: { class: "cm-codeblock-fence" } });
const lineDecBlockquote = Decoration.line({ attributes: { class: "cm-blockquote-line" } });

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
    // Single-pass tree iteration: collect FencedCode ranges AND hide markdown markers
    const fencedRanges: Array<{ from: number; to: number }> = [];
    const pendingHides: Array<{ from: number; to: number }> = [];

    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter: (node) => {
        // Collect fenced code block ranges
        if (node.name === "FencedCode") {
          fencedRanges.push({ from: node.from, to: node.to });
          return;
        }

        // Skip frontmatter and cursor line
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

    // Process pending hides — skip CodeMark inside fenced blocks
    for (const h of pendingHides) {
      if (h.from === h.to) continue; // empty range guard
      // Check if this is a CodeMark inside a fenced code block
      // CodeMark nodes have small ranges (typically 1-3 chars for backticks)
      if (isInsideFencedCode(h.from)) {
        // Only skip if it's likely a CodeMark (backtick fence) — 
        // other marks like EmphasisMark inside code blocks shouldn't exist
        // but we check just in case
        continue;
      }
      items.push({ from: h.from, to: h.to, dec: hiddenMark });
    }

    // 2. Iterate lines in visible range
    const startLine = view.state.doc.lineAt(range.from).number;
    const endLine = view.state.doc.lineAt(range.to).number;

    for (let l = startLine; l <= endLine; l++) {
      if (frontmatterEndLine > 0 && l <= frontmatterEndLine) continue;
      const line = view.state.doc.line(l);
      const text = line.text;

      // Apply line-level heading class (cm-h1..cm-h4)
      const hMatch = text.match(/^(#{1,4})\s+/);
      if (hMatch) {
        const level = hMatch[1].length;
        const dec = level === 1 ? lineDecH1 : level === 2 ? lineDecH2 : level === 3 ? lineDecH3 : lineDecH4;
        items.push({ from: line.from, to: line.from, dec });
      }

      // Apply fenced code block line styling
      if (isInsideFencedCode(line.from)) {
        const trimmed = text.trimStart();
        const isFenceLine = trimmed.startsWith('```');
        if (isFenceLine) {
          // For opening fence, extract language and create a label decoration
          const lang = trimmed.replace(/^```+/, '').trim();
          if (lang && l !== cursorLine) {
            // Hide the raw fence line and replace with a language label
            const fenceDec = Decoration.line({ attributes: { class: "cm-codeblock-fence", "data-lang": lang } });
            items.push({ from: line.from, to: line.from, dec: fenceDec });
          } else {
            items.push({ from: line.from, to: line.from, dec: lineDecCodeFence });
          }
        } else {
          items.push({ from: line.from, to: line.from, dec: lineDecCodeBlock });
        }
      }

      // Apply blockquote line styling
      if (text.trimStart().startsWith('>')) {
        items.push({ from: line.from, to: line.from, dec: lineDecBlockquote });
      }

      // Match media ![alt|width](path) for images and GIFs
      const imgRe = /!\[(.*?)\]\((.*?)\)/g;
      let imgMatch: RegExpExecArray | null;
      while ((imgMatch = imgRe.exec(text)) !== null) {
        const imgFrom = line.from + imgMatch.index;
        const imgTo = imgFrom + imgMatch[0].length;
        
        if (selection.from < imgFrom || selection.from > imgTo) {
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
      }

      // Hide <!-- task:... --> comment metadata ALWAYS and replace with GitHub-style inline Task Badges
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

      // Hide <!-- decision:... --> comment metadata ALWAYS and replace with Decision Badges
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

      if (l === cursorLine) continue; // Show full syntax when cursor is on active line

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
  }

  // Sort items by `from` position ascending, and place line decorations (to == from) before span decorations
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
      mousedown(event) {
        const target = event.target as Node;
        const element = target.nodeType === Node.TEXT_NODE ? target.parentElement : (target as HTMLElement);
        const wikilink = element?.closest(".cm-wikilink");
        
        if (wikilink) {
          event.preventDefault();
          event.stopPropagation();

          const rawText = wikilink.textContent?.trim();
          if (rawText) {
            let cleanTitle = rawText.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
            if (cleanTitle.includes('|')) {
              cleanTitle = cleanTitle.split('|')[0].trim();
            }

            const { notes, selectNote, createNote } = useNoteStore.getState();
            
            // Search by full ID, title stem, or nested folder ending
            const targetNote = notes.find((n) => 
              n.id.toLowerCase() === cleanTitle.toLowerCase() ||
              n.title.toLowerCase() === cleanTitle.toLowerCase() ||
              n.id.toLowerCase().endsWith(`/${cleanTitle.toLowerCase()}`)
            );

            if (targetNote) {
              selectNote(targetNote.id);
            } else {
              createNote(cleanTitle);
            }
            useUiStore.getState().setViewMode("notes");
          }
          return true;
        }
      },
    },
  }
);
