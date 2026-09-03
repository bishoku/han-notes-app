/**
 * webClipperService.ts — Extracts clean article content from raw web page HTML
 * and converts it to GitHub Flavored Markdown (GFM) with metadata frontmatter.
 */
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
// @ts-ignore — turndown-plugin-gfm does not provide bundled types
import { gfm } from 'turndown-plugin-gfm';

export interface ClipperMetadata {
  title: string;
  sourceUrl: string;
  clippedAt: string;
  byline?: string | null;
  siteName?: string | null;
  excerpt?: string | null;
  publishedTime?: string | null;
  lang?: string | null;
}

export interface ConvertResult {
  title: string;
  markdown: string;
  metadata: ClipperMetadata;
}

/**
 * Cleans the HTML content of a table cell and converts it into a single-line Markdown string.
 * Converts <br>, <p>, <div>, and list items into <br> tags, and escapes lone pipe characters.
 */
function cleanCellMarkdown(rawHtml: string, inlineTurndown: (html: string) => string): string {
  if (!rawHtml || !rawHtml.trim()) return ' ';

  // Pre-process block line breaks inside cells
  let html = rawHtml
    .replace(/<\s*br\s*\/?>/gi, ' HTMLBRPLACEHOLDER ')
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, ' HTMLBRPLACEHOLDER ')
    .replace(/<\s*(p|div|li|h[1-6])[^>]*>/gi, '');

  let md = inlineTurndown(html);

  // Replace placeholders with <br>
  md = md.replace(/\s*HTMLBRPLACEHOLDER\s*/g, '<br>');

  // Collapse multiple consecutive <br>s and whitespace
  md = md.replace(/(<br>\s*)+/g, '<br>');
  md = md.replace(/^<br>|<br>$/g, '');
  // Remove any remaining raw newlines so the Markdown table row stays intact
  md = md.replace(/\r?\n+/g, ' ');

  // Escape pipe characters not inside backtick code spans
  const parts = md.split(/(`[^`]*`)/);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(/\|/g, '\\|');
  }
  md = parts.join('');

  return md.trim() || ' ';
}

/**
 * Robustly converts any HTML <table> element into a valid GitHub Flavored Markdown (GFM) table.
 * Supports tables without <thead>/<th>, handles colspans, preserves alignments,
 * converts multi-line cells using <br>, and escapes pipe characters.
 */
export function convertTableElementToMarkdown(
  tableEl: HTMLElement,
  inlineTurndown?: (html: string) => string
): string {
  const turndownFn =
    inlineTurndown ||
    ((h: string) => {
      const inlineService = new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
        strongDelimiter: '**',
        linkStyle: 'inlined',
      });
      return inlineService.turndown(h);
    });

  // Find all tr elements that belong directly to this table (ignoring nested tables)
  const allTrs = Array.from(
    tableEl.querySelectorAll ? tableEl.querySelectorAll('tr') : tableEl.getElementsByTagName?.('tr') || []
  );
  const trs = allTrs.filter((tr) => {
    let p = tr.parentNode;
    while (p && p !== tableEl) {
      if (p.nodeName === 'TABLE') return false; // belongs to a nested table
      p = p.parentNode;
    }
    return true;
  });

  if (trs.length === 0) return '';

  const tableMatrix: string[][] = [];
  const columnAlignments: string[] = [];

  for (let r = 0; r < trs.length; r++) {
    const tr = trs[r];
    const cells = Array.from(tr.childNodes).filter(
      (n: any) => n.nodeName === 'TH' || n.nodeName === 'TD'
    ) as HTMLElement[];
    if (cells.length === 0) continue;

    const row: string[] = [];

    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      const colspan = Math.max(1, parseInt(cell.getAttribute ? cell.getAttribute('colspan') || '1' : '1', 10) || 1);

      const cellHtml = cell.innerHTML || cell.textContent || '';
      const cellText = cleanCellMarkdown(cellHtml, turndownFn);

      row.push(cellText);

      // Handle colspan by adding placeholder spaces
      for (let s = 1; s < colspan; s++) {
        row.push(' ');
      }

      // Detect alignments
      const dataAlign = (cell.getAttribute ? cell.getAttribute('data-align') || '' : '').toLowerCase();
      const alignAttr = (cell.getAttribute ? cell.getAttribute('align') || '' : '').toLowerCase();
      const styleAttr = (cell.getAttribute ? cell.getAttribute('style') || '' : '').toLowerCase();
      let align = 'left';
      if (
        dataAlign === 'center' ||
        alignAttr === 'center' ||
        styleAttr.includes('text-align: center') ||
        styleAttr.includes('text-align:center')
      ) {
        align = 'center';
      } else if (
        dataAlign === 'right' ||
        alignAttr === 'right' ||
        styleAttr.includes('text-align: right') ||
        styleAttr.includes('text-align:right')
      ) {
        align = 'right';
      }

      const currentTargetCol = row.length - 1;
      if (!columnAlignments[currentTargetCol] || align !== 'left') {
        columnAlignments[currentTargetCol] = align;
      }
    }

    tableMatrix.push(row);
  }

  if (tableMatrix.length === 0) return '';

  const maxCols = Math.max(...tableMatrix.map((r) => r.length));
  if (maxCols === 0) return '';

  // Pad each row to maxCols
  for (const row of tableMatrix) {
    while (row.length < maxCols) {
      row.push(' ');
    }
  }

  // Header row
  const headerRow = tableMatrix[0];
  let bodyRows = tableMatrix.slice(1);

  // If table only had 1 row, synthesize an empty data row
  if (bodyRows.length === 0) {
    bodyRows = [new Array(maxCols).fill(' ')];
  }

  // Generate separator row
  const separatorCells: string[] = [];
  for (let i = 0; i < maxCols; i++) {
    const align = columnAlignments[i] || 'left';
    if (align === 'center') separatorCells.push(':-:');
    else if (align === 'right') separatorCells.push('--:');
    else separatorCells.push('---');
  }

  const lines = [
    '| ' + headerRow.join(' | ') + ' |',
    '| ' + separatorCells.join(' | ') + ' |',
    ...bodyRows.map((r) => '| ' + r.join(' | ') + ' |'),
  ];

  return '\n\n' + lines.join('\n') + '\n\n';
}

/**
 * Creates and configures a TurndownService instance with GFM and web article rules.
 */
function createClipperTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  // Enable GitHub Flavored Markdown (tables, strikethrough, task lists)
  try {
    service.use(gfm);
  } catch (err) {
    console.warn('[webClipperService] Failed to load turndown-plugin-gfm:', err);
  }

  // Rule: Advanced HTML Table to GFM Markdown converter
  // Overrides default fragile table rules to guarantee tables convert properly
  service.addRule('advancedTable', {
    filter: 'table',
    replacement: function (_content, node) {
      return convertTableElementToMarkdown(node as HTMLElement);
    },
  });

  // Rule: Fenced Code Blocks (<pre>, <pre><code>)
  service.addRule('fencedCodeBlock', {
    filter: ['pre'],
    replacement: function (_content, node) {
      const el = node as HTMLElement;
      const codeEl = el.querySelector ? el.querySelector('code') : el.getElementsByTagName?.('code')?.[0];
      const classAttr =
        (codeEl ? codeEl.className || codeEl.getAttribute?.('class') : '') ||
        el.className ||
        el.getAttribute?.('class') ||
        '';
      const langMatch = classAttr.match(/(?:language-|lang-)([a-zA-Z0-9_-]+)/);
      const lang = langMatch ? langMatch[1] : (el.getAttribute('data-lang') || '');

      const codeText = el.textContent || '';
      const trimmed = codeText.replace(/\n+$/, '');
      return `\n\n\`\`\`${lang}\n${trimmed}\n\`\`\`\n\n`;
    },
  });

  // Rule: Figure with Figcaption
  service.addRule('figureWithCaption', {
    filter: 'figure',
    replacement: function (_content, node) {
      const el = node as HTMLElement;
      const img = el.querySelector ? el.querySelector('img') : el.getElementsByTagName?.('img')?.[0];
      if (!img) return _content;

      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (!src) return '';

      const figcaption = el.querySelector
        ? el.querySelector('figcaption')
        : el.getElementsByTagName?.('figcaption')?.[0];
      const caption = figcaption?.textContent?.trim() || img.getAttribute('alt') || 'Görsel';

      return `\n\n![${caption}](${src})\n\n`;
    },
  });

  // Rule: Strip tracking parameters from links
  service.addRule('cleanLinks', {
    filter: 'a',
    replacement: function (content, node) {
      const el = node as HTMLAnchorElement;
      let href = el.getAttribute('href') || '';
      if (!href || !content.trim()) return content;

      try {
        if (href.startsWith('http://') || href.startsWith('https://')) {
          const url = new URL(href);
          url.searchParams.delete('utm_source');
          url.searchParams.delete('utm_medium');
          url.searchParams.delete('utm_campaign');
          url.searchParams.delete('utm_term');
          url.searchParams.delete('utm_content');
          url.searchParams.delete('source');
          href = url.toString();
        }
      } catch {
        // keep original href if invalid
      }

      return `[${content}](${href})`;
    },
  });

  // Rule: Strip unwanted noise tags completely
  service.remove((node) => {
    const tag = node.nodeName.toLowerCase();
    return [
      'script',
      'style',
      'noscript',
      'button',
      'svg',
      'header',
      'footer',
      'nav',
      'form',
      'iframe',
      'dialog',
      'template',
    ].includes(tag);
  });

  return service;
}

/**
 * Resolves relative URLs (links and images) to absolute URLs based on the page's URL.
 */
export function resolveRelativeUrls(doc: Document, pageUrl: string): void {
  let baseUrl = pageUrl;
  try {
    const baseEl = doc.querySelector ? doc.querySelector('base') : doc.getElementsByTagName?.('base')?.[0];
    if (baseEl?.getAttribute('href')) {
      baseUrl = new URL(baseEl.getAttribute('href')!, pageUrl).href;
    }
  } catch {
    baseUrl = pageUrl;
  }

  // Convert <a> links
  const links = doc.querySelectorAll ? doc.querySelectorAll('a') : doc.getElementsByTagName?.('a') || [];
  Array.from(links).forEach((a) => {
    const href = a.getAttribute('href');
    if (
      href &&
      !href.startsWith('#') &&
      !href.startsWith('javascript:') &&
      !href.startsWith('mailto:') &&
      !href.startsWith('tel:')
    ) {
      try {
        a.setAttribute('href', new URL(href, baseUrl).href);
      } catch {
        // Keep original if resolution fails
      }
    }
  });

  // Convert <img> tags (including data-src lazyloading)
  const imgs = doc.querySelectorAll ? doc.querySelectorAll('img') : doc.getElementsByTagName?.('img') || [];
  Array.from(imgs).forEach((img) => {
    const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-original-src');
    const src = img.getAttribute('src') || dataSrc;

    if (src && !src.startsWith('data:')) {
      try {
        const u = new URL(src, baseUrl);
        u.searchParams.delete('utm_source');
        u.searchParams.delete('utm_medium');
        u.searchParams.delete('utm_campaign');
        u.searchParams.delete('utm_term');
        u.searchParams.delete('utm_content');
        img.setAttribute('src', u.href);
      } catch {
        // Keep original
      }
    } else if (dataSrc && !img.getAttribute('src')) {
      try {
        const u = new URL(dataSrc, baseUrl);
        u.searchParams.delete('utm_source');
        u.searchParams.delete('utm_medium');
        u.searchParams.delete('utm_campaign');
        u.searchParams.delete('utm_term');
        u.searchParams.delete('utm_content');
        img.setAttribute('src', u.href);
      } catch {
        // Keep original
      }
    }
  });
}

/**
 * Preserves table cell alignments as data-align attributes before Readability
 * strips presentational attributes (align, style, etc.).
 */
export function preserveTableAlignments(doc: Document): void {
  const allCells: HTMLElement[] = doc.querySelectorAll
    ? (Array.from(doc.querySelectorAll('th, td')) as HTMLElement[])
    : ([
        ...Array.from(doc.getElementsByTagName?.('th') || []),
        ...Array.from(doc.getElementsByTagName?.('td') || []),
      ] as HTMLElement[]);

  allCells.forEach((cell) => {
    const alignAttr = (cell.getAttribute?.('align') || '').toLowerCase();
    const styleAttr = (cell.getAttribute?.('style') || '').toLowerCase();
    if (
      alignAttr === 'center' ||
      styleAttr.includes('text-align: center') ||
      styleAttr.includes('text-align:center')
    ) {
      cell.setAttribute('data-align', 'center');
    } else if (
      alignAttr === 'right' ||
      styleAttr.includes('text-align: right') ||
      styleAttr.includes('text-align:right')
    ) {
      cell.setAttribute('data-align', 'right');
    } else if (
      alignAttr === 'left' ||
      styleAttr.includes('text-align: left') ||
      styleAttr.includes('text-align:left')
    ) {
      cell.setAttribute('data-align', 'left');
    }
  });
}

/**
 * Sanitizes a note title for use as a file system name.
 */
export function sanitizeNoteTitle(rawTitle: string): string {
  if (!rawTitle) return 'Web-Notu';
  const clean = rawTitle
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.slice(0, 100) || 'Web-Notu';
}

/**
 * Escapes YAML string value safely.
 */
function escapeYaml(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

/**
 * Converts raw HTML string and page URL into a clean, structured Markdown document.
 */
export function convertHtmlToMarkdown(htmlString: string, pageUrl: string): ConvertResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString || '', 'text/html');

  // 1. Pre-process DOM: resolve relative URLs and preserve table alignments
  resolveRelativeUrls(doc, pageUrl);
  preserveTableAlignments(doc);

  const docTitle = doc.title?.trim() || '';

  // 2. Parse main content using @mozilla/readability
  let article: ReturnType<InstanceType<typeof Readability>['parse']> = null;
  try {
    // Clone document so Readability's mutations don't prevent fallback access
    const docClone = typeof doc.cloneNode === 'function' ? (doc.cloneNode(true) as Document) : doc;
    const reader = new Readability(docClone, {
      charThreshold: 20,
      keepClasses: true,
    });
    article = reader.parse();
  } catch (err) {
    console.warn('[webClipperService] Readability parsing failed:', err);
  }

  // 3. Determine title, content HTML, and metadata
  const title = (article?.title?.trim() || docTitle || 'Web Notu').trim();
  const clippedAt = new Date().toISOString();
  const byline = article?.byline?.trim() || null;
  const siteName = article?.siteName?.trim() || null;
  const excerpt = article?.excerpt?.trim() || null;
  const publishedTime = article?.publishedTime?.trim() || null;
  const lang = article?.lang?.trim() || doc.documentElement?.lang || null;

  const metadata: ClipperMetadata = {
    title,
    sourceUrl: pageUrl,
    clippedAt,
    byline,
    siteName,
    excerpt,
    publishedTime,
    lang,
  };

  // 4. Fallback if Readability fails or produces empty content
  let contentHtml: string = (article?.content as string) || '';
  if (!contentHtml.trim()) {
    // Fallback to body content or innerText
    if (doc.body) {
      // Remove noise elements from body
      if (doc.body.querySelectorAll) {
        const noise = doc.body.querySelectorAll(
          'script, style, noscript, svg, button, form, iframe, nav, footer, header'
        );
        noise.forEach((n) => n.remove());
      } else {
        const noiseTags = ['script', 'style', 'noscript', 'svg', 'button', 'form', 'iframe', 'nav', 'footer', 'header'];
        for (const tag of noiseTags) {
          const els = doc.body.getElementsByTagName?.(tag) || [];
          for (let i = els.length - 1; i >= 0; i--) {
            els[i]?.remove?.();
          }
        }
      }
      contentHtml = doc.body.innerHTML || `<p>${(doc.body as any).innerText || doc.body.textContent || ''}</p>`;
    } else {
      contentHtml = `<p>${(doc.documentElement as any)?.innerText || doc.documentElement?.textContent || ''}</p>`;
    }
  }

  // 5. Convert content HTML to Markdown using Turndown
  const turndownService = createClipperTurndownService();
  let markdownBody = '';
  try {
    markdownBody = turndownService.turndown(contentHtml);
    markdownBody = markdownBody.replace(/\n{3,}/g, '\n\n').trim();
  } catch (err) {
    console.error('[webClipperService] Turndown conversion error:', err);
    markdownBody = doc.body?.innerText || '';
  }

  // 6. Build Frontmatter and Header
  const frontmatterLines: string[] = ['---'];
  frontmatterLines.push(`title: "${escapeYaml(title)}"`);
  frontmatterLines.push(`source: "${escapeYaml(pageUrl)}"`);
  frontmatterLines.push(`clipped_at: "${clippedAt}"`);
  if (byline) frontmatterLines.push(`author: "${escapeYaml(byline)}"`);
  if (siteName) frontmatterLines.push(`site: "${escapeYaml(siteName)}"`);
  if (publishedTime) frontmatterLines.push(`published: "${escapeYaml(publishedTime)}"`);
  if (excerpt) frontmatterLines.push(`excerpt: "${escapeYaml(excerpt)}"`);
  frontmatterLines.push('tags: [web-clip]');
  frontmatterLines.push('---');

  const metaHeaderLines: string[] = [];
  metaHeaderLines.push(`# ${title}`);
  metaHeaderLines.push('');
  metaHeaderLines.push(`> 🔗 **Kaynak:** [${pageUrl}](${pageUrl})`);
  if (byline) {
    metaHeaderLines.push(`> ✍️ **Yazar:** ${byline}`);
  }
  if (siteName) {
    metaHeaderLines.push(`> 🌐 **Site:** ${siteName}`);
  }
  metaHeaderLines.push(`> 📅 **Kırpılma Tarihi:** ${new Date().toLocaleString()}`);
  metaHeaderLines.push('');
  metaHeaderLines.push('---');
  metaHeaderLines.push('');

  const fullMarkdown = [
    frontmatterLines.join('\n'),
    '',
    metaHeaderLines.join('\n'),
    markdownBody,
  ].join('\n');

  return {
    title,
    markdown: fullMarkdown,
    metadata,
  };
}
