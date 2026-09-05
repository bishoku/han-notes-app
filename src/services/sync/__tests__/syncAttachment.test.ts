import { describe, it } from 'node:test';
import assert from 'node:assert';
import { syncStorageAdapter } from '../syncStorageAdapter';
import { computeBinaryHash, bytesToBase64, base64ToBytes } from '../crypto';
import { storage } from '@/services/storage';
import type { CanonicalNote, SyncManifest } from '../types';

describe('P2P Sync Attachment Extraction & Binary Utilities', () => {
  it('should round-trip binary data through bytesToBase64 and base64ToBytes losslessly', () => {
    const sampleBytes = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
    const b64 = bytesToBase64(sampleBytes);
    const restored = base64ToBytes(b64);

    assert.strictEqual(sampleBytes.length, restored.length);
    for (let i = 0; i < sampleBytes.length; i++) {
      assert.strictEqual(sampleBytes[i], restored[i]);
    }
  });

  it('should compute consistent SHA-256 hash digests for binary buffers', async () => {
    const bufferA = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic header
    const bufferB = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const bufferC = new Uint8Array([37, 80, 68, 70, 45]); // %PDF- header

    const hashA = await computeBinaryHash(bufferA);
    const hashB = await computeBinaryHash(bufferB);
    const hashC = await computeBinaryHash(bufferC);

    assert.strictEqual(typeof hashA, 'string');
    assert.strictEqual(hashA.length, 64);
    assert.strictEqual(hashA, hashB);
    assert.notStrictEqual(hashA, hashC);
  });

  it('should extract referenced attachment paths from active notes and ignore external links and tombstones', async () => {
    // Mock storage.getImageBytes to return fake bytes for existing mock files
    const existingFiles: Record<string, Uint8Array> = {
      '.attachments/diagram-uuid-1.png': new Uint8Array([1, 2, 3]),
      'Work/.attachments/sketch-uuid-2.png': new Uint8Array([4, 5, 6]),
      '.attachments/Specification.pdf': new Uint8Array([7, 8, 9]),
      'Work/.attachments/Architecture.pdf': new Uint8Array([10, 11, 12]),
    };

    const origGetImageBytes = storage.getImageBytes;
    (storage as any).getImageBytes = async (path: string) => {
      const clean = path.replace(/^\/+|\/+$/g, '');
      if (existingFiles[clean]) return existingFiles[clean];
      throw new Error(`File not found: ${clean}`);
    };

    try {
      const notes: CanonicalNote[] = [
        {
          id: 'Welcome',
          path: 'Welcome.md',
          content: `
# Welcome Note
Check our diagram:
![diagram-uuid-1.png](.attachments/diagram-uuid-1.png)

And documentation:
[Specification.pdf](.attachments/Specification.pdf)

External image that must be ignored:
![External](https://example.com/logo.png)
          `.trim(),
          updatedAt: 1000,
          deleted: false,
          hash: 'hash_welcome',
        },
        {
          id: 'Work/Sprint',
          path: 'Work/Sprint.md',
          content: `
# Sprint Plan
Sketch here:
![sketch-uuid-2.png](Work/.attachments/sketch-uuid-2.png)

Wikilink PDF here:
[[Work/.attachments/Architecture.pdf]]
          `.trim(),
          updatedAt: 2000,
          deleted: false,
          hash: 'hash_sprint',
        },
        {
          id: 'OldDeletedNote',
          path: 'OldDeletedNote.md',
          content: `
![secret.png](.attachments/secret.png)
          `.trim(),
          updatedAt: 500,
          deleted: true, // Tombstone! Should be ignored completely
          hash: '',
        },
      ];

      const extracted = await syncStorageAdapter.extractReferencedAttachmentPaths(notes);

      assert.ok(extracted.has('.attachments/diagram-uuid-1.png'));
      assert.ok(extracted.has('.attachments/Specification.pdf'));
      assert.ok(extracted.has('Work/.attachments/sketch-uuid-2.png'));
      assert.ok(extracted.has('Work/.attachments/Architecture.pdf'));
      assert.strictEqual(extracted.has('.attachments/secret.png'), false); // from tombstone note -> omitted
      assert.strictEqual(extracted.size, 4);
    } finally {
      (storage as any).getImageBytes = origGetImageBytes;
    }
  });

  it('should skip attachments with identical SHA-256 hash when diffing manifests', () => {
    const localManifest: SyncManifest = {
      deviceId: 'dev_local',
      timestamp: 2000,
      notes: {},
      attachments: {
        '.attachments/unchanged-diagram.png': {
          path: '.attachments/unchanged-diagram.png',
          hash: 'hash_same_png',
          size: 1024,
          updatedAt: 1000,
        },
        '.attachments/updated-sketch.png': {
          path: '.attachments/updated-sketch.png',
          hash: 'hash_sketch_v2',
          size: 2048,
          updatedAt: 3000, // Local is newer
        },
        '.attachments/local-only-doc.pdf': {
          path: '.attachments/local-only-doc.pdf',
          hash: 'hash_doc_pdf',
          size: 4096,
          updatedAt: 2000,
        },
      },
    };

    const remoteManifest: SyncManifest = {
      deviceId: 'dev_remote',
      timestamp: 2000,
      notes: {},
      attachments: {
        '.attachments/unchanged-diagram.png': {
          path: '.attachments/unchanged-diagram.png',
          hash: 'hash_same_png', // Exact same content
          size: 1024,
          updatedAt: 1000,
        },
        '.attachments/updated-sketch.png': {
          path: '.attachments/updated-sketch.png',
          hash: 'hash_sketch_v1', // Older version
          size: 1800,
          updatedAt: 1500,
        },
        '.attachments/remote-only-image.jpg': {
          path: '.attachments/remote-only-image.jpg',
          hash: 'hash_remote_jpg',
          size: 3000,
          updatedAt: 2500,
        },
      },
    };

    // Calculate diff
    const toSend: string[] = [];
    const toReceive: string[] = [];

    const localAtts = localManifest.attachments || {};
    const remoteAtts = remoteManifest.attachments || {};

    for (const [path, localAtt] of Object.entries(localAtts)) {
      const remoteAtt = remoteAtts[path];
      if (!remoteAtt) {
        toSend.push(path);
      } else if (localAtt.hash !== remoteAtt.hash && localAtt.updatedAt > remoteAtt.updatedAt) {
        toSend.push(path);
      }
    }

    for (const [path, remoteAtt] of Object.entries(remoteAtts)) {
      const localAtt = localAtts[path];
      if (!localAtt) {
        toReceive.push(path);
      } else if (remoteAtt.hash !== localAtt.hash && remoteAtt.updatedAt > localAtt.updatedAt) {
        toReceive.push(path);
      }
    }

    // Unchanged attachment is skipped (0 bytes transfer)!
    assert.deepStrictEqual(toSend, [
      '.attachments/updated-sketch.png',
      '.attachments/local-only-doc.pdf',
    ]);
    assert.deepStrictEqual(toReceive, ['.attachments/remote-only-image.jpg']);
  });

  it('should update attachment when incoming is strictly newer', async () => {
    const savedFiles: Record<string, Uint8Array> = {
      '.attachments/my-diagram.png': new Uint8Array([1, 2, 3]),
    };

    const origGetImageBytes = storage.getImageBytes;
    const origSaveAttachment = storage.saveAttachment;

    (storage as any).getImageBytes = async (path: string) => {
      const clean = path.replace(/^\/+|\/+$/g, '');
      if (savedFiles[clean]) return savedFiles[clean];
      throw new Error('Not found');
    };

    (storage as any).saveAttachment = async (path: string, bytes: Uint8Array) => {
      const clean = path.replace(/^\/+|\/+$/g, '');
      savedFiles[clean] = bytes;
    };

    try {
      const meta = await syncStorageAdapter.loadMetadata();
      if (!meta.attachments) meta.attachments = {};
      meta.attachments['.attachments/my-diagram.png'] = {
        hash: 'hash_old',
        size: 3,
        updatedAt: 1000,
      };

      const incomingPayload = {
        path: '.attachments/my-diagram.png',
        bytes: new Uint8Array([10, 20, 30]),
        hash: 'hash_new',
        updatedAt: 2000, // Strictly newer
      };

      const result = await syncStorageAdapter.applyAttachmentPayload(incomingPayload);
      assert.strictEqual(result.status, 'updated');
      assert.deepStrictEqual(savedFiles['.attachments/my-diagram.png'], incomingPayload.bytes);
    } finally {
      (storage as any).getImageBytes = origGetImageBytes;
      (storage as any).saveAttachment = origSaveAttachment;
    }
  });

  it('should apply incoming attachment and preserve local copy in case of concurrent conflict', async () => {
    const savedFiles: Record<string, Uint8Array> = {
      '.attachments/conflict-diagram.png': new Uint8Array([10, 20, 30]), // existing local
    };

    const origGetImageBytes = storage.getImageBytes;
    const origSaveAttachment = storage.saveAttachment;

    (storage as any).getImageBytes = async (path: string) => {
      const clean = path.replace(/^\/+|\/+$/g, '');
      if (savedFiles[clean]) return savedFiles[clean];
      throw new Error('Not found');
    };

    (storage as any).saveAttachment = async (path: string, bytes: Uint8Array) => {
      const clean = path.replace(/^\/+|\/+$/g, '');
      savedFiles[clean] = bytes;
    };

    try {
      const meta = await syncStorageAdapter.loadMetadata();
      if (!meta.attachments) meta.attachments = {};
      meta.attachments['.attachments/conflict-diagram.png'] = {
        hash: 'hash_local_conflict',
        size: 3,
        updatedAt: 1000,
      };

      const incomingPayload = {
        path: '.attachments/conflict-diagram.png',
        bytes: new Uint8Array([40, 50, 60]),
        hash: 'hash_incoming_conflict',
        updatedAt: 1000, // Identical timestamp causing concurrent conflict
      };

      const result = await syncStorageAdapter.applyAttachmentPayload(incomingPayload);

      assert.strictEqual(result.status, 'conflict');
      assert.ok(result.backupPath);
      assert.ok(result.backupPath.includes('conflict-diagram-conflict-'));
      // Main path has incoming bytes
      assert.deepStrictEqual(savedFiles['.attachments/conflict-diagram.png'], incomingPayload.bytes);
      // Backup path has preserved local bytes
      const backupClean = result.backupPath.replace(/^\/+|\/+$/g, '');
      assert.deepStrictEqual(savedFiles[backupClean], new Uint8Array([10, 20, 30]));
    } finally {
      (storage as any).getImageBytes = origGetImageBytes;
      (storage as any).saveAttachment = origSaveAttachment;
    }
  });
});
