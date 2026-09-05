/**
 * Zero-Knowledge Web Crypto API (AES-GCM 256) Services.
 * 
 * End-to-end encryption for the WebRTC DataChannel.
 * Keys are generated ephemerally on the host device and passed solely via the
 * QR code's URL hash fragment (#sync=...&key=...). Keys NEVER touch the signaling
 * server or any intermediate network hop.
 */

function getCryptoSubtle(): SubtleCrypto {
  const c = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  if (!c || !c.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not available in this environment.');
  }
  return c.subtle;
}

function getRandomValues(array: Uint8Array): Uint8Array {
  const c = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  if (!c || !c.getRandomValues) {
    throw new Error('Web Crypto API (crypto.getRandomValues) is not available.');
  }
  return c.getRandomValues(array);
}

/**
 * Converts ArrayBuffer / Uint8Array to URL-safe Base64 string.
 */
export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Converts URL-safe Base64 string to Uint8Array.
 */
export function base64UrlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } else {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
}

/**
 * Generates an ephemeral 256-bit AES-GCM symmetric key.
 */
export async function generatePairingKey(): Promise<{ key: CryptoKey; keyBase64: string }> {
  const subtle = getCryptoSubtle();
  const key = await subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable for QR code pairing URL
    ['encrypt', 'decrypt']
  );

  const raw = await subtle.exportKey('raw', key);
  const keyBase64 = bufferToBase64Url(raw);

  return { key, keyBase64 };
}

/**
 * Imports an AES-GCM key from an ephemeral base64url string.
 */
export async function importPairingKey(keyBase64: string): Promise<CryptoKey> {
  const subtle = getCryptoSubtle();
  const rawBytes = base64UrlToBuffer(keyBase64);

  return subtle.importKey(
    'raw',
    rawBytes as unknown as BufferSource,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // non-extractable after import
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts arbitrary JSON-serializable data using AES-GCM with a fresh 12-byte IV.
 * Returns an ArrayBuffer containing [12 bytes IV | Ciphertext + Tag].
 */
export async function encryptPayload(key: CryptoKey, data: any): Promise<ArrayBuffer> {
  const subtle = getCryptoSubtle();
  const json = JSON.stringify(data);
  const encoded = new TextEncoder().encode(json);

  const iv = getRandomValues(new Uint8Array(12));

  const ciphertext = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    encoded as unknown as BufferSource
  );

  // Combine IV (12 bytes) and ciphertext into single buffer
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return combined.buffer as ArrayBuffer;
}

/**
 * Decrypts a buffer containing [12 bytes IV | Ciphertext + Tag] using AES-GCM.
 */
export async function decryptPayload<T = any>(key: CryptoKey, data: ArrayBuffer | Uint8Array): Promise<T> {
  const subtle = getCryptoSubtle();
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (bytes.byteLength < 13) {
    throw new Error('Encrypted payload too short: missing IV or ciphertext.');
  }

  const iv = bytes.subarray(0, 12);
  const ciphertext = bytes.subarray(12);

  const decrypted = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    ciphertext as unknown as BufferSource
  );

  const decodedJson = new TextDecoder().decode(decrypted);
  return JSON.parse(decodedJson) as T;
}

/**
 * Computes a SHA-256 digest string of note content for quick diffing.
 */
export async function computeContentHash(content: string): Promise<string> {
  const subtle = getCryptoSubtle();
  const bytes = new TextEncoder().encode(content);
  const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
  const hashBytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < hashBytes.length; i++) {
    hex += hashBytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Computes a SHA-256 digest string of binary data (attachments, images, PDFs).
 */
export async function computeBinaryHash(bytes: Uint8Array): Promise<string> {
  const subtle = getCryptoSubtle();
  const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
  const hashBytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < hashBytes.length; i++) {
    hex += hashBytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Encodes a Uint8Array into a standard Base64 string using chunked processing
 * to avoid call stack limits on large binary attachments.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 8192;
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string into a Uint8Array.
 */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
