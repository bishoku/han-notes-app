import type { Decoration } from "@codemirror/view";

/**
 * Represents a decoration to be added into the CodeMirror RangeSetBuilder.
 */
export interface DecItem {
  from: number;
  to: number;
  dec: Decoration;
}

/**
 * Represents a fenced code block range [from, to] extracted from the syntax tree.
 */
export interface FencedRange {
  from: number;
  to: number;
}

/**
 * Callback function used by decorators to register a decoration item.
 */
export type DecCollector = (item: DecItem) => void;
