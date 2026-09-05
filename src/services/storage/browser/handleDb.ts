/**
 * handleDb.ts — Persists FileSystemDirectoryHandles across browser sessions using IndexedDB.
 * Supports multiple workspaces while maintaining backward-compatibility with single-vault legacy keys.
 */

const DB_NAME = 'han-notes-browser';
const DB_VERSION = 1;
const HANDLE_STORE = 'handles';

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Saves a directory handle for a specific workspace key (or legacy 'vaultDir').
 */
export async function saveWorkspaceHandle(workspaceId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, workspaceId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error(`[BrowserStorage] Failed to save handle for workspace ${workspaceId}:`, err);
  }
}

/**
 * Loads a directory handle for a specific workspace key.
 */
export async function loadWorkspaceHandle(workspaceId: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const req = tx.objectStore(HANDLE_STORE).get(workspaceId);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[BrowserStorage] Failed to load handle for workspace ${workspaceId}:`, err);
    return null;
  }
}

/**
 * Deletes a directory handle for a specific workspace key.
 */
export async function deleteWorkspaceHandle(workspaceId: string): Promise<void> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).delete(workspaceId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[BrowserStorage] Failed to delete handle for workspace ${workspaceId}:`, err);
  }
}

// ── Legacy Single-Vault API (Kept for backward compatibility) ──

export async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await saveWorkspaceHandle('vaultDir', handle);
}

export async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  return await loadWorkspaceHandle('vaultDir');
}

export async function clearHandle(): Promise<void> {
  await deleteWorkspaceHandle('vaultDir');
}
