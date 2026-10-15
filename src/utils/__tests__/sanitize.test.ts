import { describe, it, expect } from 'vitest';
import { escapeHtml, isSafeUrl, sanitizeHtml } from '../sanitize';
import { normalizeEmbedUrl } from '../../editor/widgets/EmbedWidget';

describe('Security Sanitization Utilities', () => {
  it('escapes HTML special characters in untrusted strings', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
    expect(escapeHtml("O'Reilly & Co")).toBe('O&#39;Reilly &amp; Co');
  });

  it('strips script tags, event handlers, and javascript: links in sanitizeHtml', () => {
    const dirty = `
      <h1>Safe Title</h1>
      <script>alert(1)</script>
      <img src="x" onerror="alert(2)" />
      <a href="javascript:alert(3)" onclick="evil()">Click me</a>
      <iframe src="https://evil.com"></iframe>
    `;
    const clean = sanitizeHtml(dirty);
    expect(clean).toContain('Safe Title');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('<iframe');
  });

  it('validates safe vs unsafe URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('mailto:user@example.com')).toBe(true);
    expect(isSafeUrl('_assets/image.png')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('  java\nscript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=', true)).toBe(true);
  });

  it('rejects non-http(s) URLs in normalizeEmbedUrl', () => {
    expect(normalizeEmbedUrl('javascript:alert(1)')).toBe('');
    expect(normalizeEmbedUrl('data:text/html,<h1>Hi</h1>')).toBe('');
    expect(normalizeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
    );
  });
});
