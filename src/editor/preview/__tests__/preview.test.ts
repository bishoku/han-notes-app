const mockStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
};
try {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
} catch {
  // Ignore
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Text } from '@codemirror/state';
import type { DecItem } from '../types.ts';
import { applyInlineDecorations } from '../inlineDeco.ts';
import { hideFrontmatter, applyLineStyles, processFencedCodeLine } from '../blockDeco.ts';
import { parseCachedMeta, getCachedWidget } from '../cache.ts';
import { buildDecorationSet } from '../builder.ts';
import { WidgetType } from '@codemirror/view';

describe('preview/inlineDeco', () => {
  it('should skip processing completely for plain text lines (early bailout)', () => {
    const items: DecItem[] = [];
    const line = { from: 0, to: 25, text: 'This is simple plain text' };
    applyInlineDecorations(line, 0, () => false, (item) => items.push(item));
    assert.equal(items.length, 0);
  });

  it('should format bold and italic properly', () => {
    const items: DecItem[] = [];
    const line = { from: 10, to: 35, text: '**bold text** and *italic*' };
    applyInlineDecorations(line, 10, () => false, (item) => items.push(item));

    assert.equal(items.length, 6);
    assert.equal(items[0].from, 10);
    assert.equal(items[0].to, 12);
    assert.equal(items[1].from, 12);
    assert.equal(items[1].to, 21);
    assert.equal(items[2].from, 21);
    assert.equal(items[2].to, 23);
  });

  it('should parse wikilinks and standard web links', () => {
    const items: DecItem[] = [];
    const line = { from: 0, to: 60, text: 'See [[Target Note|My Note]] and [Google](https://google.com)' };
    applyInlineDecorations(line, 0, () => false, (item) => items.push(item));

    assert.equal(items.length, 2);
    assert.equal(items[0].from, 4);
    assert.equal(items[0].to, 27);
    assert.equal(items[1].from, 32);
    assert.equal(items[1].to, 60);
  });

  it('should parse bare URLs without colliding with markdown links', () => {
    const items: DecItem[] = [];
    const line = { from: 0, to: 50, text: 'Visit https://han-notes.org directly today.' };
    applyInlineDecorations(line, 0, () => false, (item) => items.push(item));

    assert.equal(items.length, 1);
    assert.equal(items[0].from, 6);
    assert.equal(items[0].to, 27);
  });

  it('should parse HTML colored spans and underlines', () => {
    const items: DecItem[] = [];
    const line = { from: 0, to: 60, text: '<span style="color: #ff0000">Red</span> and <u>Underline</u>' };
    applyInlineDecorations(line, 0, () => false, (item) => items.push(item));

    assert.equal(items.length, 6);
  });
});

describe('preview/blockDeco', () => {
  it('should detect and hide YAML frontmatter', () => {
    const doc = Text.of([
      '---',
      'title: Test Note',
      'tags: [a, b]',
      '---',
      'Actual note content here',
    ]);

    const items: DecItem[] = [];
    const endLine = hideFrontmatter(doc, 1, (item) => items.push(item));

    assert.equal(endLine, 4);
    assert.equal(items.length, 4);
  });

  it('should recognize headings and horizontal rules', () => {
    const h1Line = { from: 0, to: 10, text: '# Heading 1' };
    const itemsH1: DecItem[] = [];
    applyLineStyles(h1Line, (item) => itemsH1.push(item));
    assert.equal(itemsH1.length, 1);

    const hrLine = { from: 20, to: 23, text: '---' };
    const itemsHR: DecItem[] = [];
    const isHR = applyLineStyles(hrLine, (item) => itemsHR.push(item));
    assert.equal(isHR, true);
    assert.equal(itemsHR.length, 2);
  });

  it('should recognize mermaid blocks with |width=513, |513, and width=513', () => {
    const docText = [
      '```mermaid|width=513',
      'graph TD',
      '  A --> B',
      '```',
    ].join('\n');
    const doc = Text.of(docText.split('\n'));
    const fencedRanges = [{ from: 0, to: docText.length }];
    const items: DecItem[] = [];

    const nextLine = processFencedCodeLine(
      doc,
      1,
      { from: 0, to: 20, text: '```mermaid|width=513' },
      fencedRanges,
      (item) => items.push(item)
    );

    assert.equal(nextLine, 5);
    assert.ok(items.length > 0);
    // Ensure widget key contains customWidth 513
    const widgetDec = items.find((i) => i.dec.spec?.widget);
    assert.ok(widgetDec);
    assert.equal((widgetDec.dec.spec?.widget as any)?.width, 513);
  });
});

describe('preview/cache', () => {
  class DummyWidget extends WidgetType {
    toDOM() {
      return {} as any;
    }
  }

  it('should parse and cache metadata JSON', () => {
    const jsonStr = '{"priority": "high", "done": false}';
    const first = parseCachedMeta(jsonStr);
    assert.deepEqual(first, { priority: 'high', done: false });
    const second = parseCachedMeta(jsonStr);
    assert.equal(second, first);
  });

  it('should cache and reuse widget instances', () => {
    let callCount = 0;
    const factory = () => {
      callCount++;
      return new DummyWidget();
    };

    const w1 = getCachedWidget('test:10:20:tag', factory);
    const w2 = getCachedWidget('test:10:20:tag', factory);

    assert.equal(w1, w2);
    assert.equal(callCount, 1);
  });
});

describe('preview/builder', () => {
  it('should assemble DecorationSet without errors', () => {
    const items: DecItem[] = [
      { from: 5, to: 10, dec: { spec: {} } as any },
      { from: 0, to: 0, dec: { spec: {} } as any },
      { from: 12, to: 15, dec: { spec: {} } as any },
    ];

    const decSet = buildDecorationSet(items, 50);
    assert.ok(decSet);
  });
});
