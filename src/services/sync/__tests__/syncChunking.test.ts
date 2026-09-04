import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  splitIntoChunks,
  parseChunkPacket,
  MessageReassembler,
  CHUNK_SIZE,
  HEADER_SIZE,
} from '../chunking';

describe('WebRTC DataChannel Chunking and Reassembly', () => {
  it('should split small payload into a single framed chunk', () => {
    const data = new TextEncoder().encode('Hello World');
    const messageId = 42;
    const packets = splitIntoChunks(messageId, data);

    assert.strictEqual(packets.length, 1);
    assert.strictEqual(packets[0].byteLength, HEADER_SIZE + data.byteLength);

    const parsed = parseChunkPacket(packets[0]);
    assert.ok(parsed);
    assert.strictEqual(parsed.messageId, 42);
    assert.strictEqual(parsed.chunkIndex, 0);
    assert.strictEqual(parsed.totalChunks, 1);
    assert.deepStrictEqual(parsed.data, data);
  });

  it('should split large payload (100 KB) into multiple 16KB chunks and reassemble in-order', () => {
    const rawBytes = new Uint8Array(100 * 1024);
    for (let i = 0; i < rawBytes.length; i++) {
      rawBytes[i] = i % 256;
    }

    const messageId = 1001;
    const packets = splitIntoChunks(messageId, rawBytes);
    const expectedChunks = Math.ceil(rawBytes.length / CHUNK_SIZE);
    assert.strictEqual(packets.length, expectedChunks);

    const reassembler = new MessageReassembler();
    let finalResult: { messageId: number; buffer: ArrayBuffer } | null = null;

    for (let i = 0; i < packets.length; i++) {
      const res = reassembler.ingest(packets[i]);
      if (i === packets.length - 1) {
        assert.ok(res !== null, 'Last chunk must complete reassembly');
        finalResult = res;
      } else {
        assert.strictEqual(res, null, `Chunk ${i} should not complete reassembly yet`);
      }
    }

    assert.ok(finalResult);
    assert.strictEqual(finalResult.messageId, 1001);
    const reassembledBytes = new Uint8Array(finalResult.buffer);
    assert.strictEqual(reassembledBytes.length, rawBytes.length);
    assert.deepStrictEqual(reassembledBytes, rawBytes);
  });

  it('should reassemble chunks arriving out-of-order', () => {
    const rawBytes = new Uint8Array(50 * 1024);
    for (let i = 0; i < rawBytes.length; i++) {
      rawBytes[i] = (i * 7) % 256;
    }

    const messageId = 77;
    const packets = splitIntoChunks(messageId, rawBytes);
    assert.ok(packets.length > 1);

    // Reverse packet arrival order
    const reversedPackets = [...packets].reverse();

    const reassembler = new MessageReassembler();
    let finalResult: { messageId: number; buffer: ArrayBuffer } | null = null;

    for (const packet of reversedPackets) {
      const res = reassembler.ingest(packet);
      if (res) {
        finalResult = res;
      }
    }

    assert.ok(finalResult);
    assert.strictEqual(finalResult.messageId, 77);
    const reassembledBytes = new Uint8Array(finalResult.buffer);
    assert.deepStrictEqual(reassembledBytes, rawBytes);
  });

  it('should handle interleaved packets from multiple concurrent messages', () => {
    const msg1Data = new TextEncoder().encode('A'.repeat(35 * 1024)); // 3 chunks
    const msg2Data = new TextEncoder().encode('B'.repeat(25 * 1024)); // 2 chunks

    const packets1 = splitIntoChunks(1, msg1Data);
    const packets2 = splitIntoChunks(2, msg2Data);

    const reassembler = new MessageReassembler();

    // Interleave: 1[0], 2[0], 1[1], 2[1], 1[2]
    assert.strictEqual(reassembler.ingest(packets1[0]), null);
    assert.strictEqual(reassembler.ingest(packets2[0]), null);
    assert.strictEqual(reassembler.ingest(packets1[1]), null);

    const res2 = reassembler.ingest(packets2[1]);
    assert.ok(res2);
    assert.strictEqual(res2.messageId, 2);
    assert.deepStrictEqual(new Uint8Array(res2.buffer), msg2Data);

    const res1 = reassembler.ingest(packets1[2]);
    assert.ok(res1);
    assert.strictEqual(res1.messageId, 1);
    assert.deepStrictEqual(new Uint8Array(res1.buffer), msg1Data);
  });

  it('should reject or ignore packets smaller than header size', () => {
    const tooSmall = new Uint8Array([1, 2, 3]);
    assert.strictEqual(parseChunkPacket(tooSmall.buffer), null);

    const reassembler = new MessageReassembler();
    assert.strictEqual(reassembler.ingest(tooSmall.buffer), null);
  });
});
