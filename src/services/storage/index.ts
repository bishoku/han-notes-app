/**
 * Storage Provider — Environment-aware entry point.
 * 
 * Detects whether the app is running inside Tauri (desktop) or in a
 * regular browser (PWA), and exports the appropriate storage service.
 * 
 * Usage:
 *   import { storage } from '@/services/storage';
 *   const notes = await storage.getVaultFiles();
 */
import type { IStorageService } from './types';
import { TauriStorage } from './TauriStorage';
import { BrowserStorage } from './BrowserStorage';
import { IndexedDBStorage } from './IndexedDBStorage';

// Re-export all types for convenience
export type {
  IStorageService,
  FileNode,
  NoteInfo,
  TagCount,
  BacklinkInfo,
  TaskInfo,
  TaskRegistry,
  DecisionInfo,
  DecisionRegistry,
} from './types';

export { IndexedDBStorage };

/**
 * Detect if we're running inside a Tauri desktop app.
 * Tauri injects `__TAURI_INTERNALS__` into the window object.
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Check if File System Access API is available in the browser */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Create the appropriate storage provider based on runtime environment:
 * 1. Tauri Desktop -> TauriStorage (native Rust file I/O)
 * 2. Desktop Browsers supporting showDirectoryPicker -> BrowserStorage (local disk .md)
 * 3. Mobile / Unsupported Browsers -> IndexedDBStorage (client-side DB fallback)
 */
function createStorage(): IStorageService {
  if (isTauriEnvironment()) {
    console.log('[Storage] Tauri environment detected — using native backend');
    return new TauriStorage();
  } else if (isFileSystemAccessSupported()) {
    console.log('[Storage] Browser environment detected — using File System Access API');
    return new BrowserStorage();
  } else {
    console.log('[Storage] Unsupported or mobile browser detected — falling back to IndexedDB');
    return new IndexedDBStorage();
  }
}

/** Singleton storage instance — auto-detects platform */
export const storage: IStorageService = createStorage();

/**
 * Try to silently reuse a previously saved directory handle.
 * No-op when running in Tauri.
 * Throws if no saved handle — caller should then show UI with pickBrowserDirectory.
 */
export async function initBrowserStorage(): Promise<void> {
  if (storage instanceof BrowserStorage) {
    await storage.init();
  }
}

/**
 * Show the directory picker dialog. MUST be called from a user gesture (click).
 * No-op when running in Tauri.
 */
export async function pickBrowserDirectory(): Promise<void> {
  if (storage instanceof BrowserStorage) {
    await storage.pickDirectory();
  }
}

/**
 * Get the name of the previously saved directory handle (if any).
 */
export async function getSavedDirectoryName(): Promise<string | null> {
  if (storage instanceof BrowserStorage) {
    return await storage.getSavedHandleName();
  }
  return null;
}

/**
 * Request permission to access the previously saved directory handle inside a user gesture (click).
 */
export async function requestSavedDirectoryPermission(): Promise<boolean> {
  if (storage instanceof BrowserStorage) {
    return await storage.requestPermissionForSaved();
  }
  return false;
}

/**
 * Clear the saved directory handle from storage.
 */
export async function clearSavedDirectoryHandle(): Promise<void> {
  if (storage instanceof BrowserStorage) {
    await storage.clearSavedHandle();
  }
}

/**
 * Initialize IndexedDB storage (used on mobile / fallback environments).
 */
export async function initIndexedDbStorage(): Promise<void> {
  if (storage instanceof IndexedDBStorage) {
    await storage.getDb();
  }
}

