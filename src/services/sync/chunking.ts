/**
 * Packet Chunking and Reassembly utilities for WebRTC DataChannel.
 * 
 * WebRTC DataChannels enforce maximum message size limits (typically 64KB or 262KB).
 * Attempting to send messages exceeding these limits throws:
 * "Failed to execute 'send' on 'RTCDataChannel': Trying to send message larger than max-message-size".
 * 
 * This module splits large encrypted payloads into safe 16 KiB chunks with an 8-byte
 * binary header for framing and reassembles them at the receiver.
 * 
 * Header layout (8 bytes, Big-Endian):
 * - Bytes 0..3: messageId (uint32)
 * - Bytes 4..5: chunkIndex (uint16)
 * - Bytes 6..7: totalChunks (uint16)
 * - Bytes 8.. : chunkData (uint8[])
 */

export const CHUNK_SIZE = 16 * 1024; // 16 KiB chunk payload
export const HEADER_SIZE = 8; // 8 bytes binary framing header
export const MAX_BUFFERED_AMOUNT = 128 * 1024; // 128 KiB backpressure limit
export const BUFFERED_AMOUNT_LOW_THRESHOLD = 64 * 1024; // 64 KiB resume threshold

export interface ParsedChunk {
  messageId: number;
  chunkIndex: number;
  totalChunks: number;
  data: Uint8Array;
}

/**
 * Splits an ArrayBuffer or Uint8Array payload into framed 16KB chunk packets.
 */
export function splitIntoChunks(
  messageId: number,
  payload: ArrayBuffer | Uint8Array
): ArrayBuffer[] {
  const rawBytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const totalLength = rawBytes.byteLength;
  const totalChunks = Math.ceil(totalLength / CHUNK_SIZE) || 1;
  const packets: ArrayBuffer[] = [];

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalLength);
    const chunkData = rawBytes.subarray(start, end);
    const packet = new Uint8Array(HEADER_SIZE + chunkData.byteLength);
    const view = new DataView(packet.buffer);

    view.setUint32(0, messageId);
    view.setUint16(4, chunkIndex);
    view.setUint16(6, totalChunks);
    packet.set(chunkData, HEADER_SIZE);

    packets.push(packet.buffer);
  }

  return packets;
}

/**
 * Parses an incoming binary packet. Returns null if packet is smaller than HEADER_SIZE.
 */
export function parseChunkPacket(packetBuffer: ArrayBuffer): ParsedChunk | null {
  if (packetBuffer.byteLength < HEADER_SIZE) {
    return null;
  }

  const view = new DataView(packetBuffer);
  const messageId = view.getUint32(0);
  const chunkIndex = view.getUint16(4);
  const totalChunks = view.getUint16(6);
  const data = new Uint8Array(packetBuffer, HEADER_SIZE);

  return { messageId, chunkIndex, totalChunks, data };
}

/**
 * Manages chunk reassembly from multiple incoming messages.
 */
export class MessageReassembler {
  private assemblies: Map<
    number,
    {
      totalChunks: number;
      chunks: Map<number, Uint8Array>;
      totalBytes: number;
    }
  > = new Map();

  /**
   * Ingests a packet. If the packet completes a message, returns the reassembled ArrayBuffer.
   * Otherwise returns null.
   */
  ingest(packetBuffer: ArrayBuffer): { messageId: number; buffer: ArrayBuffer } | null {
    const parsed = parseChunkPacket(packetBuffer);
    if (!parsed) return null;

    const { messageId, chunkIndex, totalChunks, data } = parsed;

    let assembly = this.assemblies.get(messageId);
    if (!assembly) {
      assembly = {
        totalChunks,
        chunks: new Map(),
        totalBytes: 0,
      };
      this.assemblies.set(messageId, assembly);
    }

    if (!assembly.chunks.has(chunkIndex)) {
      assembly.chunks.set(chunkIndex, data);
      assembly.totalBytes += data.byteLength;
    }

    if (assembly.chunks.size === assembly.totalChunks) {
      this.assemblies.delete(messageId);

      const assembled = new Uint8Array(assembly.totalBytes);
      let offset = 0;
      for (let i = 0; i < assembly.totalChunks; i++) {
        const chunk = assembly.chunks.get(i);
        if (!chunk) {
          throw new Error(`Missing chunk ${i} for messageId ${messageId}`);
        }
        assembled.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return { messageId, buffer: assembled.buffer };
    }

    return null;
  }

  clear(): void {
    this.assemblies.clear();
  }
}
