import { Decoration } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type { DecItem } from "./types";

/**
 * Comparator for RangeSetBuilder items:
 * 1. Ascending by start offset (from)
 * 2. Line decorations (from === to) come before range decorations at the same position
 * 3. Ascending by end offset (to)
 */
function sortDecItems(a: DecItem, b: DecItem): number {
  if (a.from !== b.from) return a.from - b.from;
  const aIsLine = a.from === a.to ? 0 : 1;
  const bIsLine = b.from === b.to ? 0 : 1;
  if (aIsLine !== bIsLine) return aIsLine - bIsLine;
  return (a.to - a.from) - (b.to - b.from);
}

/**
 * Assembles a sorted array of DecItems into a CodeMirror DecorationSet.
 * Filters out invalid ranges, duplicate line decorations, and conflicting replacements.
 * Runs without inner try/catch in the hot loop to maintain V8 JIT optimization.
 */
export function buildDecorationSet(items: DecItem[], docLength: number): DecorationSet {
  if (items.length === 0) {
    return Decoration.none;
  }

  items.sort(sortDecItems);

  const builder = new RangeSetBuilder<Decoration>();
  let lastReplaceEnd = -1;
  let lastAddedFrom = -1;
  let lastAddedTo = -1;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const from = item.from;
    const to = item.to;

    // Bounds check
    if (from < 0 || to > docLength || from > to) continue;

    if (from === to) {
      // Line decoration: ensure monotonic addition and avoid duplicates
      if (from < lastAddedFrom) continue;
      lastAddedFrom = from;
      lastAddedTo = to;
      builder.add(from, to, item.dec);
    } else {
      const decSpec = (item.dec as any).spec;
      const isReplace = decSpec?.widget !== undefined || decSpec?.inclusive !== undefined || (item.dec as any).isReplace;

      if (isReplace) {
        if (from < lastReplaceEnd) continue;
        lastReplaceEnd = to;
      } else {
        // Mark decoration overlapping an active replace
        if (from < lastReplaceEnd && to > lastReplaceEnd) continue;
      }

      // Monotonic order check for RangeSetBuilder
      if (from < lastAddedFrom || (from === lastAddedFrom && to < lastAddedTo)) continue;
      lastAddedFrom = from;
      lastAddedTo = to;
      builder.add(from, to, item.dec);
    }
  }

  try {
    return builder.finish();
  } catch (err) {
    console.warn('[LivePreview] RangeSetBuilder finish failed, falling back to Decoration.none:', err);
    return Decoration.none;
  }
}
