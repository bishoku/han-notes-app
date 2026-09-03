import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Set up minimal browser environment if running in node/vite-node
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    location: {
      origin: 'http://localhost:5173',
      pathname: '/',
    },
  };
}

// Polyfill DOMParser using Readability's bundled lightweight parser or fallback if not in browser
if (typeof (globalThis as any).DOMParser === 'undefined') {
  try {
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    const JSDOMParser = req('@mozilla/readability/JSDOMParser.js');
    (globalThis as any).DOMParser = class {
      parseFromString(html: string) {
        return new JSDOMParser().parse(html);
      }
    };
  } catch (e) {
    console.warn('Could not load JSDOMParser:', e);
  }
}

import {
  getDefaultAppImportUrl,
  generateRawBookmarkletScript,
  generateBookmarkletHref,
} from '../bookmarkletGenerator.ts';
import {
  sanitizeNoteTitle,
  resolveRelativeUrls,
  convertHtmlToMarkdown,
} from '../webClipperService.ts';

describe('Web Clipper: bookmarkletGenerator', () => {
  it('generates the default app import URL targeting #/import-clip', () => {
    const url = getDefaultAppImportUrl();
    assert.ok(url.includes('#/import-clip'));
    assert.ok(url.startsWith('http://localhost:5173'));
  });

  it('generates raw bookmarklet script containing two-way handshake logic', () => {
    const script = generateRawBookmarkletScript('https://notes.han.app/#/import-clip');
    assert.ok(script.includes('https://notes.han.app/#/import-clip'));
    assert.ok(script.includes('CLIPPER_READY'));
    assert.ok(script.includes('CLIPPER_DATA'));
    assert.ok(script.includes('document.documentElement.outerHTML'));
    assert.ok(script.includes('window.open'));
  });

  it('generates URL-encoded javascript: bookmarklet href', () => {
    const href = generateBookmarkletHref('https://notes.han.app/#/import-clip');
    assert.ok(href.startsWith('javascript:'));
    assert.ok(href.includes('%20') || href.includes('('));
    assert.ok(decodeURIComponent(href).includes('CLIPPER_READY'));
  });
});

describe('Web Clipper: webClipperService title sanitization', () => {
  it('cleans illegal path and file system characters from note title', () => {
    assert.equal(sanitizeNoteTitle('Article: What is AI? / Guide <2026>'), 'Article- What is AI- - Guide -2026-');
    assert.equal(sanitizeNoteTitle('   Clean Title   '), 'Clean Title');
    assert.equal(sanitizeNoteTitle(''), 'Web-Notu');
    assert.equal(sanitizeNoteTitle('Multiple   Spaces \n Newline'), 'Multiple Spaces Newline');
  });
});

describe('Web Clipper: webClipperService relative URL resolver', () => {
  it('resolves relative URLs if DOMParser is available', () => {
    if (typeof (globalThis as any).DOMParser === 'undefined') return;

    const parser = new (globalThis as any).DOMParser();
    const doc = parser.parseFromString(`
      <html>
        <head><title>Test</title></head>
        <body>
          <a id="link1" href="/articles/ai">AI</a>
          <a id="link2" href="#section">Anchor</a>
          <img id="img1" src="/images/pic.png" />
          <img id="img2" data-src="/images/lazy.jpg" />
        </body>
      </html>
    `, 'text/html');

    resolveRelativeUrls(doc, 'https://example.com/blog/intro');

    const links = doc.querySelectorAll ? doc.querySelectorAll('a') : doc.getElementsByTagName('a');
    const imgs = doc.querySelectorAll ? doc.querySelectorAll('img') : doc.getElementsByTagName('img');
    const a1 = links[0];
    const a2 = links[1];
    const img1 = imgs[0];
    const img2 = imgs[1];

    assert.equal(a1?.getAttribute('href'), 'https://example.com/articles/ai');
    assert.equal(a2?.getAttribute('href'), '#section');
    assert.equal(img1?.getAttribute('src'), 'https://example.com/images/pic.png');
    assert.equal(img2?.getAttribute('src'), 'https://example.com/images/lazy.jpg');
  });
});

describe('Web Clipper: webClipperService convertHtmlToMarkdown', () => {
  it('converts sample HTML into clean Markdown with metadata frontmatter', () => {
    if (typeof (globalThis as any).DOMParser === 'undefined') return;

    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Makale Başlığı</title>
        </head>
        <body>
          <article>
            <h1>Test Makale Başlığı</h1>
            <p>Bu bir <strong>test</strong> paragrafıdır. Web clipper başarıyla çalışıyor.</p>
            <pre><code class="language-typescript">const x: number = 42;</code></pre>
            <a href="https://example.com/link?utm_source=tracker">Temiz Link</a>
          </article>
        </body>
      </html>
    `;

    const result = convertHtmlToMarkdown(sampleHtml, 'https://example.com/test-makale');

    assert.ok(result.title.includes('Test Makale Başlığı'));
    assert.ok(result.markdown.includes('---'));
    assert.ok(result.markdown.includes('source: "https://example.com/test-makale"'));
    assert.ok(result.markdown.includes('tags: [web-clip]'));
    assert.ok(result.markdown.includes('```typescript'));
    assert.ok(result.markdown.includes('const x: number = 42;'));
    assert.ok(result.markdown.includes('[Temiz Link](https://example.com/link)'));
    assert.ok(!result.markdown.includes('utm_source=tracker'));
  });

  it('handles fallback when article content cannot be isolated by Readability', () => {
    if (typeof (globalThis as any).DOMParser === 'undefined') return;

    const minimalHtml = `
      <html>
        <head><title>Kısa Sayfa</title></head>
        <body>
          <div>Yalnızca kısa bir duyuru metni.</div>
        </body>
      </html>
    `;

    const result = convertHtmlToMarkdown(minimalHtml, 'https://example.com/kisa');
    assert.equal(result.title, 'Kısa Sayfa');
    assert.ok(result.markdown.includes('Yalnızca kısa bir duyuru metni.'));
    assert.ok(result.markdown.includes('source: "https://example.com/kisa"'));
  });
});
