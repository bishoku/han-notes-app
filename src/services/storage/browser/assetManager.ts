/**
 * assetManager.ts — High-Performance asset & image manager for BrowserStorage.
 *
 * Uses zero-copy Blob Object URLs (URL.createObjectURL) instead of megabyte-heavy
 * base64 strings in JavaScript heap memory, with proper LRU eviction and URL.revokeObjectURL.
 */

// LRU cache for active Object URLs
const objectUrlCache = new Map<string, string>();
const MAX_OBJECT_URLS = 150;

export function clearImageCache(path?: string): void {
  if (path) {
    const existing = objectUrlCache.get(path);
    if (existing && existing.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(existing);
      } catch {
        // Ignore
      }
    }
    objectUrlCache.delete(path);
    objectUrlCache.delete(`/${path}`);
  } else {
    for (const url of objectUrlCache.values()) {
      if (url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore
        }
      }
    }
    objectUrlCache.clear();
  }
}

/**
 * Resolves an asset file to a browser-renderable Object URL (blob:).
 * Automatically caches and manages URL lifecycles.
 */
export async function getAssetFile(
  dir: FileSystemDirectoryHandle,
  relativePath: string
): Promise<File> {
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error(`Invalid asset path: ${relativePath}`);

  let current: FileSystemDirectoryHandle = dir;
  let found = true;
  for (const part of parts) {
    try {
      current = await current.getDirectoryHandle(part);
    } catch {
      found = false;
      break;
    }
  }

  let file: File | null = null;
  if (found) {
    try {
      const fileHandle = await current.getFileHandle(fileName);
      file = await fileHandle.getFile();
    } catch {
      // Fall through to recursive search
    }
  }

  // Recursive fallback search
  if (!file) {
    file = await searchInDir(dir, fileName);
  }

  if (!file) {
    throw new Error(`File not found in vault: ${relativePath}`);
  }

  return file;
}

export async function getAssetBytes(
  dir: FileSystemDirectoryHandle,
  relativePath: string
): Promise<Uint8Array> {
  const file = await getAssetFile(dir, relativePath);
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Resolves an asset file to a browser-renderable Object URL (blob:).
 * Automatically caches and manages URL lifecycles.
 */
export async function getAssetUrl(
  dir: FileSystemDirectoryHandle,
  relativePath: string
): Promise<string> {
  const cached = objectUrlCache.get(relativePath);
  if (cached) return cached;

  const file = await getAssetFile(dir, relativePath);

  let url: string;
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    url = URL.createObjectURL(file);
  } else {
    // Fallback for non-DOM environments
    url = await readFileAsDataUrl(file);
  }

  objectUrlCache.set(relativePath, url);

  // Evict oldest if exceeding capacity
  if (objectUrlCache.size > MAX_OBJECT_URLS) {
    const firstKey = objectUrlCache.keys().next().value;
    if (firstKey !== undefined) {
      const oldUrl = objectUrlCache.get(firstKey);
      if (oldUrl && oldUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(oldUrl);
        } catch {
          // Ignore
        }
      }
      objectUrlCache.delete(firstKey);
    }
  }

  return url;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function searchInDir(d: FileSystemDirectoryHandle, target: string): Promise<File | null> {
  for await (const entry of (d as any).values()) {
    if (entry.kind === 'file' && entry.name === target) {
      return (entry as FileSystemFileHandle).getFile();
    }
    if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
      const sub = await searchInDir(entry as FileSystemDirectoryHandle, target);
      if (sub) return sub;
    }
  }
  return null;
}

export async function saveImageBytes(
  dir: FileSystemDirectoryHandle,
  relativeNoteId: string,
  fileName: string,
  bytes: Uint8Array
): Promise<string> {
  const parentDir = relativeNoteId.includes('/')
    ? relativeNoteId.split('/').slice(0, -1).join('/')
    : '';

  const attachmentsPath = parentDir ? `${parentDir}/.attachments` : '.attachments';

  let current = dir;
  for (const part of attachmentsPath.split('/').filter(Boolean)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }

  const fileHandle = await current.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  await writable.close();

  const relPath = parentDir ? `${parentDir}/.attachments/${fileName}` : `.attachments/${fileName}`;
  clearImageCache(relPath);
  clearImageCache(fileName);

  return relPath;
}

export async function saveTextAsset(
  dir: FileSystemDirectoryHandle,
  relativeNoteId: string,
  fileName: string,
  content: string
): Promise<string> {
  const parentDir = relativeNoteId.includes('/')
    ? relativeNoteId.split('/').slice(0, -1).join('/')
    : '';

  const attachmentsPath = parentDir ? `${parentDir}/.attachments` : '.attachments';

  let current = dir;
  for (const part of attachmentsPath.split('/').filter(Boolean)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }

  const fileHandle = await current.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();

  const relPath = parentDir ? `${parentDir}/.attachments/${fileName}` : `.attachments/${fileName}`;
  clearImageCache(relPath);
  clearImageCache(fileName);

  return relPath;
}

export async function readTextAsset(
  dir: FileSystemDirectoryHandle,
  relativePath: string
): Promise<string> {
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error('Invalid path');

  let current = dir;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part);
  }

  const fileHandle = await current.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return file.text();
}
