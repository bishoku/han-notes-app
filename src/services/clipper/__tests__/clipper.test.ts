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
  sanitizeMarkdownOutput,
  DEFAULT_CLIPPER_CLEAN_OPTIONS,
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

  it('correctly converts HTML tables (with or without thead, multi-line cells, colspans and pipes)', () => {
    if (typeof (globalThis as any).DOMParser === 'undefined') return;

    const tableHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Tablo Testi</title></head>
        <body>
          <article>
            <h1>Tablo Testi</h1>
            <!-- Table 1: No thead/th, only td elements -->
            <table>
              <tr><td>Öğe</td><td>Fiyat</td><td>Stok</td></tr>
              <tr><td>Kitap</td><td>150 TL</td><td>Var</td></tr>
              <tr><td>Kalem</td><td>25 TL</td><td>Yok</td></tr>
            </table>

            <!-- Table 2: Alignment, code with pipes, and multiline paragraph cells -->
            <table>
              <thead>
                <tr><th align="center">Özellik</th><th align="right">Detay</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>a | b</code> veya c | d</td>
                  <td>
                    <p>Satır 1</p>
                    <p>Satır 2</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </article>
        </body>
      </html>
    `;

    const result = convertHtmlToMarkdown(tableHtml, 'https://example.com/tablolar');

    // Verify Table 1 was converted to Markdown table
    assert.ok(result.markdown.includes('| Öğe | Fiyat | Stok |'), 'Table 1 header converted');
    assert.ok(result.markdown.includes('| Kitap | 150 TL | Var |'), 'Table 1 row 1 converted');
    assert.ok(result.markdown.includes('| Kalem | 25 TL | Yok |'), 'Table 1 row 2 converted');

    // Verify Table 2 has alignments and handled multi-line cells and pipes
    assert.ok(result.markdown.includes('| :-: | --: |'), 'Table 2 alignments preserved');
    assert.ok(result.markdown.includes('`a | b` veya c \\| d'), 'Pipes escaped outside code');
    assert.ok(result.markdown.includes('Satır 1<br>Satır 2'), 'Multiline cells converted to <br>');
  });

  it('strips Wikipedia citations, edit links, and reflist while preserving external links', () => {
    if (typeof (globalThis as any).DOMParser === 'undefined') return;

    const wikiHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Recep Tayyip Erdoğan - Vikipedi</title></head>
        <body>
          <article>
            <h1>Recep Tayyip Erdoğan</h1>
            <h2>Erken yaşamı ve eğitimi<span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?action=edit">değiştir</a><span class="mw-editsection-divider"> | </span><a href="/w/index.php?action=edit">kaynağı değiştir</a><span class="mw-editsection-bracket">]</span></span></h2>
            <p>
              Lise yıllarında <a href="https://tr.wikipedia.org/wiki/Mill%C3%AE_T%C3%BCrk_Talebe_Birli%C4%9Fi_(1946)">Millî Türk Talebe Birliği</a>'ne girdi.<sup id="cite_ref-Milliyet-2001-20" class="reference"><a href="#cite_note-Milliyet-2001-20"><span class="cite-bracket">[</span>20<span class="cite-bracket">]</span></a></sup><sup id="cite_ref-Yalçın-49-42" class="reference"><a href="#cite_note-Yalçın-49-42">[42]</a></sup> 1975'te <a href="https://tr.wikipedia.org/wiki/Mill%C3%AE_Selamet_Partisi">Millî Selamet Partisi</a> gençlik kollarına katıldı.
            </p>
            <div class="reflist">
              <ol class="references">
                <li id="cite_note-Milliyet-2001-20">Milliyet Gazetesi Arşivi, 2001.</li>
                <li id="cite_note-Yalçın-49-42">Yalçın, Soner, 2006, s. 49.</li>
              </ol>
            </div>
          </article>
        </body>
      </html>
    `;

    const result = convertHtmlToMarkdown(wikiHtml, 'https://tr.wikipedia.org/wiki/Recep_Tayyip_Erdo%C4%9Fan');

    // 1. Valid external topic links must be preserved
    assert.ok(
      result.markdown.includes('[Millî Türk Talebe Birliği](https://tr.wikipedia.org/wiki/Mill%C3%AE_T%C3%BCrk_Talebe_Birli%C4%9Fi_(1946))'),
      'Valid topic link preserved'
    );
    assert.ok(
      result.markdown.includes('[Millî Selamet Partisi](https://tr.wikipedia.org/wiki/Mill%C3%AE_Selamet_Partisi)'),
      'Second topic link preserved'
    );

    // 2. Citation markers like [20], [42], [\[20\]], #cite_note MUST be gone
    assert.ok(!result.markdown.includes('cite_note'), 'No cite_note links');
    assert.ok(!result.markdown.includes('cite_ref'), 'No cite_ref links');
    assert.ok(!result.markdown.includes('[20]'), 'No [20]');
    assert.ok(!result.markdown.includes('[42]'), 'No [42]');
    assert.ok(!result.markdown.includes('[\\[20\\]]'), 'No escaped bracket [20]');
    assert.ok(!result.markdown.includes('[\\[42\\]]'), 'No escaped bracket [42]');

    // 3. Edit links in headings must be stripped
    assert.ok(result.markdown.includes('## Erken yaşamı ve eğitimi'), 'Clean heading');
    assert.ok(!result.markdown.includes('değiştir'), 'No edit button in heading');
    assert.ok(!result.markdown.includes('kaynağı değiştir'), 'No edit source button in heading');

    // 4. Bibliography / reflist must be removed
    assert.ok(!result.markdown.includes('Milliyet Gazetesi Arşivi'), 'No reflist footnotes');
  });

  it('unwraps internal fragment anchors into plain text to prevent dead links', () => {
    if (typeof (globalThis as any).DOMParser === 'undefined') return;

    const html = `
      <html>
        <head><title>Makale</title></head>
        <body>
          <article>
            <h1>Test</h1>
            <p>Ayrıntılı bilgi için <a href="#tablo-detay">bu tabloya</a> bakabilirsiniz. Ayrıca <a href="#top">Başa Dön</a>.</p>
          </article>
        </body>
      </html>
    `;

    const result = convertHtmlToMarkdown(html, 'https://example.com/makale');
    assert.ok(result.markdown.includes('Ayrıntılı bilgi için bu tabloya bakabilirsiniz.'), 'Unwrapped internal anchor to plain text');
    assert.ok(!result.markdown.includes('[bu tabloya](#tablo-detay)'), 'No dead anchor markdown link');
    assert.ok(!result.markdown.includes('Başa Dön'), 'Removed navigation jump link');
  });

  it('strips social share buttons, newsletters, and sidebar navigation noise', () => {
    if (typeof (globalThis as any).DOMParser === 'undefined') return;

    const noisyHtml = `
      <html>
        <head><title>Haber Başlığı</title></head>
        <body>
          <article>
            <h1>Haber Başlığı</h1>
            <div class="share-buttons">
              <a href="https://twitter.com/share">Twitter'da Paylaş</a>
              <a href="https://facebook.com/share">Facebook'ta Paylaş</a>
            </div>
            <div class="hatnote">Bu sayfa haber içerir.</div>
            <p>Bu haberin ana gövdesidir ve kalması gerekir.</p>
            <div class="newsletter-form">
              <input type="email" placeholder="E-posta" />
              <button>Bültene Katıl</button>
            </div>
            <div class="navbox">Gezinme Kutusu İçeriği</div>
          </article>
        </body>
      </html>
    `;

    const result = convertHtmlToMarkdown(noisyHtml, 'https://example.com/haber');
    assert.ok(result.markdown.includes('Bu haberin ana gövdesidir ve kalması gerekir.'), 'Article body preserved');
    assert.ok(!result.markdown.includes("Twitter'da Paylaş"), 'Social share buttons removed');
    assert.ok(!result.markdown.includes('Bültene Katıl'), 'Newsletter form removed');
    assert.ok(!result.markdown.includes('Gezinme Kutusu İçeriği'), 'Navbox removed');
    assert.ok(!result.markdown.includes('Bu sayfa haber içerir.'), 'Hatnote removed');
  });

  it('preserves square brackets inside code blocks without stripping them', () => {
    if (typeof (globalThis as any).DOMParser === 'undefined') return;

    const codeHtml = `
      <html>
        <head><title>Kod Rehberi</title></head>
        <body>
          <article>
            <h1>Kod Rehberi</h1>
            <p>Dizi indeksleme örneği:</p>
            <pre><code class="language-typescript">const items = [10, 20, 30];\nconst first = items[0];\nconst second = items[20];</code></pre>
          </article>
        </body>
      </html>
    `;

    const result = convertHtmlToMarkdown(codeHtml, 'https://example.com/kod');
    assert.ok(result.markdown.includes('items[0]'), 'items[0] preserved in code block');
    assert.ok(result.markdown.includes('items[20]'), 'items[20] preserved in code block');
    assert.ok(result.markdown.includes('[10, 20, 30]'), 'Array literal preserved in code block');
  });

  it('cleans the exact user citation sample string while preserving text and topic links', () => {
    const rawMarkdownWithTurndownArtifacts = `Lise yıllarında [Millî Türk Talebe Birliği](https://tr.wikipedia.org/wiki/Mill%C3%AE_T%C3%BCrk_Talebe_Birli%C4%9Fi_(1946))'ne girdi.[\[20\]](#cite_note-Milliyet-2001-20)[\[42\]](#cite_note-Yalçın-49-42) 1975'te [Millî Selamet Partisi](https://tr.wikipedia.org/wiki/Mill%C3%AE_Selamet_Partisi) gençlik kollarına katıldı.`;

    const cleaned = sanitizeMarkdownOutput(rawMarkdownWithTurndownArtifacts, DEFAULT_CLIPPER_CLEAN_OPTIONS);

    assert.ok(!cleaned.includes('cite_note'), 'Stripped citation anchor');
    assert.ok(!cleaned.includes('[20]'), 'Stripped [20]');
    assert.ok(!cleaned.includes('[42]'), 'Stripped [42]');
    assert.ok(!cleaned.includes('[\\[20\\]]'), 'Stripped escaped [20]');
    assert.ok(!cleaned.includes('[\\[42\\]]'), 'Stripped escaped [42]');
    assert.ok(cleaned.includes("girdi. 1975'te"), 'Clean sentence flow with punctuation intact');
    assert.ok(
      cleaned.includes("[Millî Türk Talebe Birliği](https://tr.wikipedia.org/wiki/Mill%C3%AE_T%C3%BCrk_Talebe_Birli%C4%9Fi_(1946))"),
      'Topic link preserved'
    );
  });

  it('respects options when stripCitations is set to false', () => {
    if (typeof (globalThis as any).DOMParser === 'undefined') return;

    const html = `
      <html>
        <head><title>Akademik Makale</title></head>
        <body>
          <article>
            <h1>Başlık</h1>
            <p>Bir önerme yapıldı<sup class="reference"><a href="#cite_note-1">[1]</a></sup>.</p>
          </article>
        </body>
      </html>
    `;

    const result = convertHtmlToMarkdown(html, 'https://example.com/akademik', { stripCitations: false });
    assert.ok(result.markdown.includes('1'), 'Citation preserved when stripCitations is false');
  });
});


