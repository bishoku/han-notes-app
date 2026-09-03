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
        const absoluteUrl = new URL(src, baseUrl).href;
        img.setAttribute('src', absoluteUrl);
      } catch {
        // Keep original
      }
    } else if (dataSrc && !img.getAttribute('src')) {
      try {
        img.setAttribute('src', new URL(dataSrc, baseUrl).href);
      } catch {
        // Keep original
      }
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

  // 1. Resolve relative URLs to absolute URLs
  resolveRelativeUrls(doc, pageUrl);

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
