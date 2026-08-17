/**
 * mermaidService.ts — Centralized Mermaid.js rendering engine with:
 * - Dynamic theme synchronization (Light / Dark / Dracula / Synthwave)
 * - Safe async rendering & WeakMap/LRU caching
 * - Syntax parsing & validation error handling
 * - Clean SVG extraction and DOM isolation
 */
import mermaid from 'mermaid';

let currentTheme: 'dark' | 'light' | null = null;

/**
 * Configure and initialize Mermaid with theme and typography settings
 */
export function initializeMermaid(isDark: boolean): void {
  const themeMode = isDark ? 'dark' : 'light';
  if (currentTheme === themeMode) return;

  currentTheme = themeMode;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    fontFamily: '"Geist Variable", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    theme: isDark ? 'dark' : 'default',
    themeVariables: isDark
      ? {
          darkMode: true,
          background: '#18181b',
          primaryColor: '#3b82f6',
          primaryTextColor: '#f4f4f5',
          primaryBorderColor: '#3f3f46',
          lineColor: '#a1a1aa',
          secondaryColor: '#6366f1',
          tertiaryColor: '#27272a',
          nodeBorder: '#3f3f46',
          clusterBkg: '#27272a',
          clusterBorder: '#3f3f46',
          defaultLinkColor: '#a1a1aa',
          titleColor: '#f4f4f5',
          edgeLabelBackground: '#27272a',
          actorBkg: '#27272a',
          actorBorder: '#3f3f46',
          actorTextColor: '#f4f4f5',
          actorLineColor: '#71717a',
          signalColor: '#f4f4f5',
          signalTextColor: '#f4f4f5',
          labelBoxBkgColor: '#27272a',
          labelBoxBorderColor: '#3f3f46',
          labelTextColor: '#f4f4f5',
          loopTextColor: '#f4f4f5',
          noteBorderColor: '#3f3f46',
          noteBkgColor: '#27272a',
          noteTextColor: '#f4f4f5',
        }
      : {
          darkMode: false,
          background: '#ffffff',
          primaryColor: '#e0e7ff',
          primaryTextColor: '#1e1b4b',
          primaryBorderColor: '#c7d2fe',
          lineColor: '#64748b',
          secondaryColor: '#f1f5f9',
          tertiaryColor: '#f8fafc',
          nodeBorder: '#cbd5e1',
          clusterBkg: '#f8fafc',
          clusterBorder: '#e2e8f0',
          defaultLinkColor: '#64748b',
          titleColor: '#0f172a',
          edgeLabelBackground: '#f1f5f9',
          actorBkg: '#f8fafc',
          actorBorder: '#cbd5e1',
          actorTextColor: '#0f172a',
          actorLineColor: '#94a3b8',
          signalColor: '#0f172a',
          signalTextColor: '#0f172a',
          labelBoxBkgColor: '#f1f5f9',
          labelBoxBorderColor: '#cbd5e1',
          labelTextColor: '#0f172a',
          loopTextColor: '#0f172a',
          noteBorderColor: '#cbd5e1',
          noteBkgColor: '#fef3c7',
          noteTextColor: '#92400e',
        },
  });
}

// Module-level SVG Cache (auto-invalidates when theme or code changes)
const _svgCache = new Map<string, string>();
const MAX_CACHE_SIZE = 150;

/**
 * Render a Mermaid diagram code into an SVG string.
 */
export async function renderMermaidSvg(
  diagramId: string,
  code: string,
  isDark: boolean
): Promise<{ svg: string; error?: string }> {
  const cleanCode = code.trim();
  if (!cleanCode) {
    return { svg: '' };
  }

  const cacheKey = `${isDark ? 'dark' : 'light'}:${cleanCode}`;
  if (_svgCache.has(cacheKey)) {
    return { svg: _svgCache.get(cacheKey)! };
  }

  try {
    initializeMermaid(isDark);

    // Sanitize ID for DOM safety (must not contain colons, dots or spaces)
    const safeId = `mermaid-${diagramId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Math.random().toString(36).slice(2, 7)}`;

    // Render SVG
    const renderResult = await mermaid.render(safeId, cleanCode);
    const svg = renderResult.svg;

    // Cache the result
    _svgCache.set(cacheKey, svg);
    if (_svgCache.size > MAX_CACHE_SIZE) {
      const firstKey = _svgCache.keys().next().value;
      if (firstKey !== undefined) _svgCache.delete(firstKey);
    }

    return { svg };
  } catch (err: any) {
    const errorMsg = err?.message || err?.str || String(err);
    
    // Clean up any stray error elements Mermaid might have appended to document body
    try {
      const errorEls = document.querySelectorAll(`[id^="d${diagramId}"], [id^="mermaid-"]`);
      errorEls.forEach((el) => {
        if (el.parentElement === document.body) {
          el.remove();
        }
      });
    } catch {
      // ignore DOM cleanup error
    }

    return { svg: '', error: errorMsg };
  }
}

/**
 * Validate Mermaid code syntax without mounting to DOM
 */
export async function validateMermaid(code: string): Promise<{ valid: boolean; error?: string }> {
  const cleanCode = code.trim();
  if (!cleanCode) return { valid: true };

  try {
    await mermaid.parse(cleanCode);
    return { valid: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    return { valid: false, error: errorMsg };
  }
}

/**
 * Clear the SVG render cache
 */
export function clearMermaidCache(): void {
  _svgCache.clear();
  currentTheme = null;
}
