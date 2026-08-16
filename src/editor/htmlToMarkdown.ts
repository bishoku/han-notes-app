/**
 * htmlToMarkdown.ts — Advanced HTML-to-Markdown converter for web articles (Medium, Substack, Google Docs, etc.)
 * Preserves headings, bold/italic, lists, blockquotes, code blocks, tables, images with captions, and links.
 */
import TurndownService from 'turndown';
// @ts-ignore — turndown-plugin-gfm does not provide bundled types
import { gfm } from 'turndown-plugin-gfm';

// 1. Initialize Turndown with clean Markdown defaults
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
});

// 2. Enable GitHub Flavored Markdown (tables, strikethrough, task lists)
try {
  turndownService.use(gfm);
} catch (err) {
  console.warn('Failed to load turndown-plugin-gfm:', err);
}

// 3. Custom Rule: Medium & Web Code Blocks (<pre>, <pre><code>)
turndownService.addRule('fencedCodeBlock', {
  filter: ['pre'],
  replacement: function (_content, node) {
    const el = node as HTMLElement;
    // Extract language if specified in data-lang, class (e.g., language-js), etc.
    const codeEl = el.querySelector('code');
    const classAttr = (codeEl ? codeEl.className : '') || el.className || '';
    const langMatch = classAttr.match(/(?:language-|lang-)([a-zA-Z0-9_-]+)/);
    const lang = langMatch ? langMatch[1] : (el.getAttribute('data-lang') || '');

    // Get clean text content preserving indentation
    const codeText = el.textContent || '';
    const trimmed = codeText.replace(/\n+$/, '');
    return `\n\n\`\`\`${lang}\n${trimmed}\n\`\`\`\n\n`;
  },
});

// 4. Custom Rule: Medium & Web Figure with Figcaption
turndownService.addRule('figureWithCaption', {
  filter: 'figure',
  replacement: function (_content, node) {
    const el = node as HTMLElement;
    const img = el.querySelector('img');
    if (!img) return _content;

    const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    if (!src) return '';

    const figcaption = el.querySelector('figcaption');
    const caption = figcaption?.textContent?.trim() || img.getAttribute('alt') || 'image';

    return `\n\n![${caption}](${src})\n\n`;
  },
});

// 5. Custom Rule: Clean Links (remove Medium/Google tracking query parameters)
turndownService.addRule('cleanLinks', {
  filter: 'a',
  replacement: function (content, node) {
    const el = node as HTMLAnchorElement;
    let href = el.getAttribute('href') || '';
    if (!href || !content.trim()) return content;

    // Clean tracking query params like ?source=... or ?utm_...
    try {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        const url = new URL(href);
        url.searchParams.delete('source');
        url.searchParams.delete('utm_source');
        url.searchParams.delete('utm_medium');
        url.searchParams.delete('utm_campaign');
        href = url.toString();
      }
    } catch {
      // If URL parsing fails, keep original href
    }

    return `[${content}](${href})`;
  },
});

// 6. Custom Rule: Underline / Highlight
turndownService.addRule('underline', {
  filter: ['u', 'ins'],
  replacement: function (content) {
    return `<u>${content}</u>`;
  },
});

// 7. Strip unwanted tags completely (scripts, styles, buttons, navs, svgs)
turndownService.remove((node) => {
  const tag = node.nodeName.toLowerCase();
  return ['script', 'style', 'noscript', 'button', 'svg', 'header', 'footer', 'nav'].includes(tag);
});

/**
 * Pre-cleans HTML string before passing to Turndown
 */
function preCleanHtml(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove hidden/tracking elements
    const elementsToRemove = doc.querySelectorAll('script, style, noscript, svg, button, form, iframe, [aria-hidden="true"]');
    elementsToRemove.forEach((el) => el.remove());

    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

/**
 * Converts rich HTML (e.g. from Medium or any web article) into clean Markdown.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return '';

  try {
    const cleanedHtml = preCleanHtml(html);
    const markdown = turndownService.turndown(cleanedHtml);
    // Normalize excessive multiple newlines
    return markdown.replace(/\n{3,}/g, '\n\n').trim();
  } catch (err) {
    console.error('Failed to convert HTML to Markdown:', err);
    return '';
  }
}

/**
 * Checks if pasted HTML has meaningful structural tags that warrant conversion
 */
export function isMeaningfulHtml(html: string): boolean {
  if (!html) return false;
  // Match common formatting and structural tags
  const structuralTagRegex = /<(?:h[1-6]|p|strong|b|em|i|blockquote|ul|ol|li|code|pre|a|table|img|figure|hr)[^>]*>/i;
  return structuralTagRegex.test(html);
}
