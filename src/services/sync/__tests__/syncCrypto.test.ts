import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generatePairingKey,
  importPairingKey,
  encryptPayload,
  decryptPayload,
  computeContentHash,
  bufferToBase64Url,
  base64UrlToBuffer,
} from '../crypto';

describe('Web Crypto E2EE AES-GCM Service', () => {
  it('should generate an ephemeral pairing key and export it to base64url', async () => {
    const { key, keyBase64 } = await generatePairingKey();
    assert.ok(key);
    assert.strictEqual(key.algorithm.name, 'AES-GCM');
    assert.ok(typeof keyBase64 === 'string');
    assert.ok(keyBase64.length > 20);

    // Verify round-trip conversion
    const buffer = base64UrlToBuffer(keyBase64);
    const convertedBase64 = bufferToBase64Url(buffer);
    assert.strictEqual(convertedBase64, keyBase64);
  });

  it('should import the exported pairing key correctly', async () => {
    const { keyBase64 } = await generatePairingKey();
    const importedKey = await importPairingKey(keyBase64);
    assert.ok(importedKey);
    assert.strictEqual(importedKey.algorithm.name, 'AES-GCM');
  });

  it('should encrypt and decrypt JSON payloads correctly', async () => {
    const { key, keyBase64 } = await generatePairingKey();
    const importedKey = await importPairingKey(keyBase64);

    const testPayload = {
      type: 'NOTE_PAYLOAD',
      note: {
        id: 'Work/Architecture',
        path: 'Work/Architecture.md',
        content: '# Architecture Spec\n\n- [ ] Deploy signaling server',
        updatedAt: 1725438000000,
        deleted: false,
        hash: 'abc123def456',
      },
    };

    const encryptedBuffer = await encryptPayload(key, testPayload);
    assert.ok(encryptedBuffer instanceof ArrayBuffer);
    assert.ok(encryptedBuffer.byteLength > 12);

    const decrypted = await decryptPayload(importedKey, encryptedBuffer);
    assert.deepStrictEqual(decrypted, testPayload);
  });

  it('should fail decryption when using a different key', async () => {
    const { key: key1 } = await generatePairingKey();
    const { key: key2 } = await generatePairingKey();

    const payload = { secret: 'zero-knowledge note data' };
    const encrypted = await encryptPayload(key1, payload);

    await assert.rejects(async () => {
      await decryptPayload(key2, encrypted);
    });
  });

  it('should compute consistent SHA-256 hashes for content diffing', async () => {
    const contentA = '# My Note\n\nContent line 1';
    const contentB = '# My Note\n\nContent line 1';
    const contentC = '# My Note\n\nContent line 2';

    const hashA = await computeContentHash(contentA);
    const hashB = await computeContentHash(contentB);
    const hashC = await computeContentHash(contentC);

    assert.strictEqual(hashA, hashB);
    assert.notStrictEqual(hashA, hashC);
    assert.strictEqual(hashA.length, 64);
  });
});
