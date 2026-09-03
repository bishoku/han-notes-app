import type { WidgetType } from "@codemirror/view";
import type { ChangeDesc } from "@codemirror/state";
import { clearMermaidCache } from "../mermaid/mermaidService";

// Module-level cache for parsed JSON comment metadata (tasks, decisions)
const _metaCache = new Map<string, any>();
const MAX_META_CACHE = 200;

export function parseCachedMeta(raw: string): any | null {
  const trimmed = raw.trim();
  const cached = _metaCache.get(trimmed);
  if (cached !== undefined) return cached;

  try {
    const parsed = JSON.parse(trimmed);
    _metaCache.set(trimmed, parsed);
    if (_metaCache.size > MAX_META_CACHE) {
      const firstKey = _metaCache.keys().next().value;
      if (firstKey !== undefined) _metaCache.delete(firstKey);
    }
    return parsed;
  } catch {
    _metaCache.set(trimmed, null);
    return null;
  }
}

// Module-level widget cache — reuse widget instances across scroll & edit rebuilds
const _widgetCache = new Map<string, WidgetType>();
const MAX_WIDGET_CACHE = 400;

export function getCachedWidget<T extends WidgetType>(
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

/**
 * Range-aware widget cache invalidation.
 * If changes are provided, widgets strictly before the change range are preserved,
 * preventing unnecessary widget recreation and DOM churn.
 */
export function invalidateWidgetCache(changes?: ChangeDesc): void {
  if (!changes || changes.empty) {
    _widgetCache.clear();
    return;
  }

  // Find minimum modified document offset
  let minChangedFrom = Infinity;
  changes.iterChangedRanges((fromA: number) => {
    if (fromA < minChangedFrom) minChangedFrom = fromA;
  });

  if (!Number.isFinite(minChangedFrom)) {
    _widgetCache.clear();
    return;
  }

  // Keys have format: "prefix:from:to:..."
  for (const key of _widgetCache.keys()) {
    const colonIdx1 = key.indexOf(':');
    if (colonIdx1 === -1) {
      _widgetCache.delete(key);
      continue;
    }
    const colonIdx2 = key.indexOf(':', colonIdx1 + 1);
    if (colonIdx2 === -1) {
      _widgetCache.delete(key);
      continue;
    }
    const fromStr = key.slice(colonIdx1 + 1, colonIdx2);
    const itemFrom = Number(fromStr);
    if (isNaN(itemFrom) || itemFrom >= minChangedFrom) {
      _widgetCache.delete(key);
    }
  }
}

/**
 * Clear all Live Preview caches (widgets, metadata, mermaid diagrams).
 */
export function clearLivePreviewCaches(): void {
  _widgetCache.clear();
  _metaCache.clear();
  clearMermaidCache();
}
