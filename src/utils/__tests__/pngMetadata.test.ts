import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import LZString from 'lz-string';
import {
  injectPngMetadata,
  extractPngMetadata,
  resolveBinaryBytes,
  YADA_METADATA_KEYWORD,
  EXCALIDRAW_METADATA_KEYWORD,
} from '../pngMetadata.ts';

describe('pngMetadata and binary bytes utility', () => {
  // Valid minimal 1x1 PNG binary
  const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const getMinimalPngBuffer = (): ArrayBuffer => {
    const binary = atob(minimalPngBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  it('correctly injects and extracts YADA diagram metadata from PNG', () => {
    const rawBuffer = getMinimalPngBuffer();
    const yadaPayload = {
      logicalData: { schemaVersion: 2, nodes: [{ id: 'node-1', name: 'Auth Service' }], edges: [] },
      visualData: { canvas: { zoom: 1, pan: { x: 100, y: 200 } } },
    };

    const enrichedBytes = injectPngMetadata(rawBuffer, YADA_METADATA_KEYWORD, yadaPayload);
    assert.ok(enrichedBytes.byteLength > rawBuffer.byteLength);

    const extracted = extractPngMetadata(enrichedBytes, YADA_METADATA_KEYWORD);
    assert.ok(extracted !== null);
    assert.equal(extracted.logicalData.nodes[0].name, 'Auth Service');
    assert.equal(extracted.visualData.canvas.pan.x, 100);
  });

  it('correctly injects and extracts Excalidraw sketch metadata from PNG', () => {
    const rawBuffer = getMinimalPngBuffer();
    const excalidrawPayload = {
      engine: 'excalidraw',
      elements: [{ id: 'elem-1', type: 'rectangle', x: 50, y: 50 }],
      appState: { viewBackgroundColor: '#ffffff' },
    };

    const enrichedBytes = injectPngMetadata(rawBuffer, EXCALIDRAW_METADATA_KEYWORD, excalidrawPayload);
    const extracted = extractPngMetadata(enrichedBytes, EXCALIDRAW_METADATA_KEYWORD);

    assert.ok(extracted !== null);
    assert.equal(extracted.engine, 'excalidraw');
    assert.equal(extracted.elements[0].type, 'rectangle');
  });

  it('compresses and decompresses YADA simulation share URL data correctly', () => {
    const yadaPayload = {
      logicalData: { schemaVersion: 2, nodes: [{ id: 'gateway', name: 'API Gateway' }], edges: [] },
      visualData: { canvas: { zoom: 1, pan: { x: 0, y: 0 } } },
    };

    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(yadaPayload));
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    assert.ok(decompressed !== null);
    const parsed = JSON.parse(decompressed!);
    assert.equal(parsed.logicalData.nodes[0].name, 'API Gateway');
  });

  it('resolves binary bytes from data URL', async () => {
    const dataUrl = `data:image/png;base64,${minimalPngBase64}`;
    const bytes = await resolveBinaryBytes(dataUrl);
    assert.ok(bytes instanceof Uint8Array);
    assert.ok(bytes.length > 0);
    // PNG signature: 0x89 0x50 0x4E 0x47
    assert.equal(bytes[0], 0x89);
    assert.equal(bytes[1], 0x50);
  });
});
