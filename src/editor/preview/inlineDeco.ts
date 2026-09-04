import { Decoration } from "@codemirror/view";
import type { DecCollector } from "./types";
import { getCachedWidget } from "./cache";
import { WikilinkWidget, WebLinkWidget } from "../widgets/WikilinkWidget";

// Exported shared marks
export const hiddenMark = Decoration.replace({});
export const boldMark = Decoration.mark({ class: "cm-bold" });
export const italicMark = Decoration.mark({ class: "cm-italic" });
export const boldItalicMark = Decoration.mark({ class: "cm-bold-italic" });
export const underlineMark = Decoration.mark({ class: "cm-underline" });
export const strikethroughMark = Decoration.mark({ class: "cm-strikethrough" });
export const highlightMark = Decoration.mark({ class: "cm-highlight" });
export const inlineCodeMark = Decoration.mark({ class: "cm-inline-code" });

// Hoisted regular expressions
const boldItalicRe = /\*\*\*([^*]+?)\*\*\*|___([^_]+?)___/g;
const boldRe = /(?<!\*)\*\*([^*]+?)\*\*(?!\*)|(?<!_)__([^_]+?)__(?!_)/g;
const italicRe = /(?<!\*)\*([^*]+?)\*(?!\*)|(?<!_)_([^_]+?)_(?!_)/g;
const strikeRe = /~~(.*?)~~/g;
const highlightRe = /==(.*?)==/g;
const codeRe = /`([^`]+)`/g;
const wikilinkRe = /\[\[(.*?)\]\]/g;
const webLinkRe = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
const bareUrlRe = /(?<![\])=’"\w])(https?:\/\/[^\s<>)\]"]+)/g;
const spanColorRe = /<span\s+style=["']color:\s*([^"';]+)[^"']*["']>([\s\S]*?)<\/span>/gi;
const underlineRe = /<u>([\s\S]*?)<\/u>/gi;

// Fast trigger regex to skip lines devoid of inline formatting characters
const INLINE_TRIGGER_RE = /[*_~=`[<]|https?:/;

export interface LineContext {
  from: number;
  to: number;
  text: string;
}

/**
 * Parses and emits inline decorations (bold, italic, strikethrough, highlight,
 * code, wikilinks, web links, bare URLs, colored spans, and underline tags) for a single line.
 *
 * Performance optimizations:
 * 1. Early bailout if text has no markdown trigger characters.
 * 2. Local line-scoped overlap check for bare URLs (O(1) instead of scanning the full viewport array).
 */
export function applyInlineDecorations(
  line: LineContext,
  minOffset: number,
  isInsideFencedCode: (pos: number) => boolean,
  collect: DecCollector
): void {
  const lineFrom = line.from;
  if (isInsideFencedCode(lineFrom)) return;

  const text = line.text;
  if (!INLINE_TRIGGER_RE.test(text)) {
    return;
  }

  // 1. Bold Italic: ***text*** or ___text___
  if (text.includes('***') || text.includes('___')) {
    boldItalicRe.lastIndex = 0;
    let biMatch: RegExpExecArray | null;
    while ((biMatch = boldItalicRe.exec(text)) !== null) {
      const biFrom = lineFrom + biMatch.index;
      const biTo = biFrom + biMatch[0].length;
      if (biFrom < minOffset) continue;
      collect({ from: biFrom, to: biFrom + 3, dec: hiddenMark });
      collect({ from: biFrom + 3, to: biTo - 3, dec: boldItalicMark });
      collect({ from: biTo - 3, to: biTo, dec: hiddenMark });
    }
  }

  // 2. Bold: **text** or __text__
  if (text.includes('**') || text.includes('__')) {
    boldRe.lastIndex = 0;
    let bMatch: RegExpExecArray | null;
    while ((bMatch = boldRe.exec(text)) !== null) {
      const bFrom = lineFrom + bMatch.index;
      const bTo = bFrom + bMatch[0].length;
      if (bFrom < minOffset) continue;
      collect({ from: bFrom, to: bFrom + 2, dec: hiddenMark });
      collect({ from: bFrom + 2, to: bTo - 2, dec: boldMark });
      collect({ from: bTo - 2, to: bTo, dec: hiddenMark });
    }
  }

  // 3. Italic: *text* or _text_
  if (text.includes('*') || text.includes('_')) {
    italicRe.lastIndex = 0;
    let iMatch: RegExpExecArray | null;
    while ((iMatch = italicRe.exec(text)) !== null) {
      const iFrom = lineFrom + iMatch.index;
      const iTo = iFrom + iMatch[0].length;
      if (iFrom < minOffset) continue;
      collect({ from: iFrom, to: iFrom + 1, dec: hiddenMark });
      collect({ from: iFrom + 1, to: iTo - 1, dec: italicMark });
      collect({ from: iTo - 1, to: iTo, dec: hiddenMark });
    }
  }

  // 4. Strikethrough: ~~text~~
  if (text.includes('~~')) {
    strikeRe.lastIndex = 0;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = strikeRe.exec(text)) !== null) {
      const sFrom = lineFrom + sMatch.index;
      const sTo = sFrom + sMatch[0].length;
      if (sFrom < minOffset) continue;
      collect({ from: sFrom, to: sFrom + 2, dec: hiddenMark });
      collect({ from: sFrom + 2, to: sTo - 2, dec: strikethroughMark });
      collect({ from: sTo - 2, to: sTo, dec: hiddenMark });
    }
  }

  // 5. Highlight: ==text==
  if (text.includes('==')) {
    highlightRe.lastIndex = 0;
    let hlMatch: RegExpExecArray | null;
    while ((hlMatch = highlightRe.exec(text)) !== null) {
      const hlFrom = lineFrom + hlMatch.index;
      const hlTo = hlFrom + hlMatch[0].length;
      if (hlFrom < minOffset) continue;
      collect({ from: hlFrom, to: hlFrom + 2, dec: hiddenMark });
      collect({ from: hlFrom + 2, to: hlTo - 2, dec: highlightMark });
      collect({ from: hlTo - 2, to: hlTo, dec: hiddenMark });
    }
  }

  // 6. Inline Code: `code`
  if (text.includes('`')) {
    codeRe.lastIndex = 0;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = codeRe.exec(text)) !== null) {
      const cFrom = lineFrom + cMatch.index;
      const cTo = cFrom + cMatch[0].length;
      if (cFrom < minOffset) continue;
      collect({ from: cFrom, to: cFrom + 1, dec: hiddenMark });
      collect({ from: cFrom + 1, to: cTo - 1, dec: inlineCodeMark });
      collect({ from: cTo - 1, to: cTo, dec: hiddenMark });
    }
  }

  // Track link ranges on this line to prevent bare URLs from colliding with markdown links (O(1) local check)
  const lineLinkRanges: Array<{ from: number; to: number }> = [];

  // 7. Wikilinks [[Note Title]]
  if (text.includes('[[')) {
    wikilinkRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = wikilinkRe.exec(text)) !== null) {
      const matchFrom = lineFrom + match.index;
      const matchTo = matchFrom + match[0].length;
      if (matchFrom < minOffset) continue;
      const rawContent = match[1].trim();
      if (!rawContent) continue;

      lineLinkRanges.push({ from: matchFrom, to: matchTo });

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
      collect({
        from: matchFrom,
        to: matchTo,
        dec: Decoration.replace({ widget }),
      });
    }
  }

  // 8. Standard Markdown Links: [Label](url)
  if (text.includes('](')) {
    webLinkRe.lastIndex = 0;
    let wlMatch: RegExpExecArray | null;
    while ((wlMatch = webLinkRe.exec(text)) !== null) {
      const linkFrom = lineFrom + wlMatch.index;
      const linkTo = linkFrom + wlMatch[0].length;
      if (linkFrom < minOffset) continue;
      const label = wlMatch[1];
      const url = wlMatch[2].trim();

      lineLinkRanges.push({ from: linkFrom, to: linkTo });

      const widget = getCachedWidget(
        `web:${linkFrom}:${linkTo}:${url}`,
        () => new WebLinkWidget(label, url, linkFrom, linkTo)
      );
      collect({
        from: linkFrom,
        to: linkTo,
        dec: Decoration.replace({ widget }),
      });
    }
  }

  // 9. Bare URLs: https://example.com
  if (text.includes('http://') || text.includes('https://')) {
    bareUrlRe.lastIndex = 0;
    let buMatch: RegExpExecArray | null;
    while ((buMatch = bareUrlRe.exec(text)) !== null) {
      const linkFrom = lineFrom + buMatch.index;
      const linkTo = linkFrom + buMatch[0].length;
      if (linkFrom < minOffset) continue;
      const url = buMatch[1];

      // O(1) check against lineLinkRanges instead of O(N) items.some
      const hasOverlap = lineLinkRanges.some((r) => linkFrom < r.to && linkTo > r.from);
      if (!hasOverlap) {
        lineLinkRanges.push({ from: linkFrom, to: linkTo });
        const widget = getCachedWidget(
          `bare:${linkFrom}:${linkTo}:${url}`,
          () => new WebLinkWidget(url, url, linkFrom, linkTo)
        );
        collect({
          from: linkFrom,
          to: linkTo,
          dec: Decoration.replace({ widget }),
        });
      }
    }
  }

  // 10. HTML Colored span tags: <span style="color: #ef4444">text</span>
  if (text.includes('<span') || text.includes('<SPAN')) {
    spanColorRe.lastIndex = 0;
    let spanMatch: RegExpExecArray | null;
    while ((spanMatch = spanColorRe.exec(text)) !== null) {
      const matchFrom = lineFrom + spanMatch.index;
      const matchTo = matchFrom + spanMatch[0].length;
      const openTagLength = spanMatch[0].indexOf('>') + 1;
      const openTagFrom = matchFrom;
      const openTagTo = matchFrom + openTagLength;
      const closeTagFrom = matchTo - 7;
      const closeTagTo = matchTo;
      const color = spanMatch[1].trim();

      collect({ from: openTagFrom, to: openTagTo, dec: hiddenMark });
      if (closeTagFrom > openTagTo) {
        collect({
          from: openTagTo,
          to: closeTagFrom,
          dec: Decoration.mark({
            attributes: { style: `color: ${color}; font-weight: 500;` },
          }),
        });
      }
      collect({ from: closeTagFrom, to: closeTagTo, dec: hiddenMark });
    }
  }

  // 11. Underline tags: <u>text</u>
  if (text.includes('<u>') || text.includes('<U>')) {
    underlineRe.lastIndex = 0;
    let uMatch: RegExpExecArray | null;
    while ((uMatch = underlineRe.exec(text)) !== null) {
      const uFrom = lineFrom + uMatch.index;
      const uTo = uFrom + uMatch[0].length;
      collect({ from: uFrom, to: uFrom + 3, dec: hiddenMark });
      if (uTo - 4 > uFrom + 3) {
        collect({ from: uFrom + 3, to: uTo - 4, dec: underlineMark });
      }
      collect({ from: uTo - 4, to: uTo, dec: hiddenMark });
    }
  }
}
