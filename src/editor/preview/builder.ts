import { Decoration } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type { DecItem } from "./types";

/**
 * Comparator for RangeSetBuilder items:
 * 1. Ascending by start offset (from)
 * 2. Ascending by decoration startSide (required by CodeMirror RangeSetBuilder)
 * 3. Ascending by length ((a.to - a.from) - (b.to - b.from))
 */
function sortDecItems(a: DecItem, b: DecItem): number {
  if (a.from !== b.from) return a.from - b.from;
  const aSide = (a.dec as any).startSide ?? 0;
  const bSide = (b.dec as any).startSide ?? 0;
  if (aSide !== bSide) return aSide - bSide;
  return (a.to - a.from) - (b.to - b.from);
}

/**
 * Assembles a sorted array of DecItems into a CodeMirror DecorationSet.
 * Filters out invalid ranges, duplicate line decorations, and conflicting replacements.
 * Catches any unexpected range errors so the editor never crashes.
 */
export function buildDecorationSet(items: DecItem[], docLength: number): DecorationSet {
  if (items.length === 0) {
    return Decoration.none;
  }

  items.sort(sortDecItems);

  const builder = new RangeSetBuilder<Decoration>();
  let lastReplaceEnd = -1;
  let lastAddedFrom = -1;
  let lastAddedStartSide = -Infinity;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const from = item.from;
    const to = item.to;

    // Bounds check
    if (from < 0 || to > docLength || from > to) continue;

    const startSide = (item.dec as any).startSide ?? 0;

    if (from === to) {
      // Line decoration / point decoration: ensure monotonic addition
      if (from < lastAddedFrom || (from === lastAddedFrom && startSide < lastAddedStartSide)) continue;
      try {
        builder.add(from, to, item.dec);
        lastAddedFrom = from;
        lastAddedStartSide = startSide;
      } catch (err) {
        console.warn('[LivePreview] Skipping invalid line decoration at', from, to, err);
      }
    } else {
      const decSpec = (item.dec as any).spec;
      const isReplace = (item.dec as any).isReplace || decSpec?.widget !== undefined || decSpec?.inclusive !== undefined;

      if (isReplace) {
        if (from < lastReplaceEnd) continue;
        lastReplaceEnd = to;
      } else {
        // Mark decoration overlapping an active replace
        if (from < lastReplaceEnd && to > lastReplaceEnd) continue;
      }

      // Monotonic order check for RangeSetBuilder
      if (from < lastAddedFrom || (from === lastAddedFrom && startSide < lastAddedStartSide)) continue;

      try {
        builder.add(from, to, item.dec);
        lastAddedFrom = from;
        lastAddedStartSide = startSide;
      } catch (err) {
        console.warn('[LivePreview] Skipping invalid range decoration at', from, to, err);
      }
    }
  }

  try {
    return builder.finish();
  } catch (err) {
    console.warn('[LivePreview] RangeSetBuilder finish failed, falling back to Decoration.none:', err);
    return Decoration.none;
  }
}
