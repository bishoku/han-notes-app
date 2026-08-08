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

/**
 * Detect if we're running inside a Tauri desktop app.
 * Tauri injects `__TAURI_INTERNALS__` into the window object.
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Create the appropriate storage provider based on runtime environment.
 */
function createStorage(): IStorageService {
  if (isTauriEnvironment()) {
    console.log('[Storage] Tauri environment detected — using native backend');
    return new TauriStorage();
  } else {
    console.log('[Storage] Browser environment detected — using File System Access API');
    return new BrowserStorage();
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

/** Check if File System Access API is available in the browser */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}
