import { Decoration } from "@codemirror/view";
import type { DecCollector } from "./types";
import { hiddenMark } from "./inlineDeco";
import { getCachedWidget, parseCachedMeta } from "./cache";
import { TaskCheckboxWidget } from "../widgets/TaskCheckboxWidget";
import { DecisionPrefixWidget } from "../widgets/DecisionPrefixWidget";
import { ResizableImageWidget } from "../widgets/ResizableImageWidget";
import { TaskBadgeWidget } from "../widgets/TaskBadgeWidget";
import { DecisionBadgeWidget } from "../widgets/DecisionBadgeWidget";

// Hoisted regular expressions
const imgRe = /!\[(.*?)\]\((.*?)\)/g;
const commentRe = /<!--\s*task:(.*?)-->/g;
const decCommentRe = /<!--\s*decision:(.*?)-->/g;
const diagramCommentRe = /<!--\s*diagram:(.*?)\s*-->/g;

/**
 * Handles interactive prefixes:
 * - Task checkbox: - [ ] or - [x]
 * - Decision prefix: - [D] or [D]
 */
export function processPrefixWidgets(
  line: { from: number; to: number; text: string },
  collect: DecCollector
): void {
  const text = line.text;

  // 1. Interactive Task Checkbox: - [ ] or - [x] or [ ] or [x]
  const taskMatch = text.match(/^(\s*(?:[-*+]\s+)?)\[([ xX])\](\s*)/);
  if (taskMatch) {
    const isChecked = taskMatch[2].toLowerCase() === 'x';
    const bracketIndex = text.indexOf('[');
    const boxStart = line.from + bracketIndex;
    const boxEnd = boxStart + 3;
    const prefixFrom = line.from;
    const prefixTo = line.from + taskMatch[0].length;

    collect({
      from: prefixFrom,
      to: prefixTo,
      dec: Decoration.replace({
        widget: new TaskCheckboxWidget(isChecked, boxStart, boxEnd),
      }),
    });
    return;
  }

  // 2. Decision Record Prefix Widget: - [D] or [D]
  const decMatch = text.match(/^(\s*(?:[-*+]\s+)?)\[[Dd]\](\s*)/);
  if (decMatch) {
    const prefixFrom = line.from;
    const prefixTo = line.from + decMatch[0].length;

    collect({
      from: prefixFrom,
      to: prefixTo,
      dec: Decoration.replace({
        widget: new DecisionPrefixWidget(),
      }),
    });
  }
}

/**
 * Handles embedded badges, images, and HTML comments within a line:
 * - Media: ![alt|width](relPath)
 * - Task comment metadata: <!-- task:... -->
 * - Decision comment metadata: <!-- decision:... -->
 * - Diagram comment metadata: <!-- diagram:UUID -->
 */
export function processBadgesAndMedia(
  line: { from: number; to: number; text: string },
  collect: DecCollector
): void {
  const text = line.text;

  // 1. Match media ![alt|width](path) for images, GIFs, diagrams, and sketches
  if (text.includes('![')) {
    imgRe.lastIndex = 0;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = imgRe.exec(text)) !== null) {
      const imgFrom = line.from + imgMatch.index;
      const imgTo = imgFrom + imgMatch[0].length;

      const rawAlt = imgMatch[1].trim();
      const relPath = imgMatch[2].trim();

      let altText = rawAlt;
      let width: number | null = null;

      if (rawAlt.includes('|')) {
        const parts = rawAlt.split('|');
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
      collect({
        from: imgFrom,
        to: imgTo,
        dec: Decoration.replace({ widget }),
      });
    }
  }

  // 2. Hide <!-- task:... --> comment metadata and render TaskBadgeWidget
  if (text.includes('<!--') && text.includes('task:')) {
    commentRe.lastIndex = 0;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = commentRe.exec(text)) !== null) {
      const commentFrom = line.from + cMatch.index;
      const commentTo = commentFrom + cMatch[0].length;

      const meta = parseCachedMeta(cMatch[1]);
      if (meta) {
        const widget = getCachedWidget(
          `task:${commentFrom}:${commentTo}:${cMatch[1]}`,
          () => new TaskBadgeWidget(meta)
        );
        collect({
          from: commentFrom,
          to: commentTo,
          dec: Decoration.replace({ widget }),
        });
      } else {
        collect({ from: commentFrom, to: commentTo, dec: hiddenMark });
      }
    }
  }

  // 3. Hide <!-- decision:... --> comment metadata and render DecisionBadgeWidget
  if (text.includes('<!--') && text.includes('decision:')) {
    decCommentRe.lastIndex = 0;
    let dMatch: RegExpExecArray | null;
    while ((dMatch = decCommentRe.exec(text)) !== null) {
      const commentFrom = line.from + dMatch.index;
      const commentTo = commentFrom + dMatch[0].length;

      const meta = parseCachedMeta(dMatch[1]);
      if (meta) {
        const widget = getCachedWidget(
          `dec:${commentFrom}:${commentTo}:${dMatch[1]}`,
          () => new DecisionBadgeWidget(meta)
        );
        collect({
          from: commentFrom,
          to: commentTo,
          dec: Decoration.replace({ widget }),
        });
      } else {
        collect({ from: commentFrom, to: commentTo, dec: hiddenMark });
      }
    }
  }

  // 4. Hide <!-- diagram:UUID --> comment metadata
  if (text.includes('<!--') && text.includes('diagram:')) {
    diagramCommentRe.lastIndex = 0;
    let diagMatch: RegExpExecArray | null;
    while ((diagMatch = diagramCommentRe.exec(text)) !== null) {
      const commentFrom = line.from + diagMatch.index;
      const commentTo = commentFrom + diagMatch[0].length;
      collect({ from: commentFrom, to: commentTo, dec: hiddenMark });
    }
  }
}
