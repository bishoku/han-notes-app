/**
 * crypto.ts — Web Crypto API (AES-GCM 256-bit) client-side secret encryption.
 * Protects user API keys from being stored as plaintext in localStorage or IndexedDB.
 */

const KEY_DB_NAME = 'han_crypto_vault';
const KEY_STORE_NAME = 'keys';
const KEY_NAME = 'master_key_v1';

async function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
        db.createObjectStore(KEY_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateMasterKey(): Promise<CryptoKey> {
  const db = await openKeyDb();
  
  // Try to load existing key
  const existingKey = await new Promise<CryptoKey | null>((resolve) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readonly');
    const store = tx.objectStore(KEY_STORE_NAME);
    const req = store.get(KEY_NAME);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });

  if (existingKey) {
    return existingKey;
  }

  // Generate new 256-bit AES-GCM key
  const newKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable for maximum security
    ['encrypt', 'decrypt']
  );

  // Save in IndexedDB
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(KEY_STORE_NAME);
    const req = store.put(newKey, KEY_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return newKey;
}

/**
 * Encrypts a plaintext secret into an AES-GCM base64 string.
 */
export async function encryptSecret(secret: string): Promise<string> {
  if (!secret) return '';

  try {
    const key = await getOrCreateMasterKey();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
    const encoder = new TextEncoder();
    const encoded = encoder.encode(secret);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Convert to base64
    let binary = '';
    const bytes = new Uint8Array(combined);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.error('Failed to encrypt secret:', err);
    return secret; // fallback
  }
}

/**
 * Decrypts an AES-GCM base64 string back into plaintext secret.
 */
export async function decryptSecret(encryptedBase64: string): Promise<string> {
  if (!encryptedBase64) return '';

  try {
    const binary = atob(encryptedBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    if (bytes.length < 13) {
      return encryptedBase64; // Not an encrypted payload
    }

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    const key = await getOrCreateMasterKey();

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    // If decryption fails (e.g. legacy plain text), return as is
    return encryptedBase64;
  }
}
