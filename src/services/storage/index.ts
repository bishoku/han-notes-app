/**
 * Storage Provider — Environment-aware and Workspace-aware entry point.
 * 
 * Manages dynamic binding to the active workspace's storage engine:
 * - Tauri Desktop -> TauriStorage (native Rust file I/O)
 * - Desktop Browsers with File System Access -> BrowserStorage (local disk .md)
 * - Mobile / Safari / Browser-Memory Workspaces -> IndexedDBStorage (scoped IDB)
 * 
 * Transparently forwards all calls from `storage` to whichever provider is
 * active for the current workspace.
 * 
 * Usage:
 *   import { storage } from '@/services/storage';
 *   const notes = await storage.getVaultFiles();
 */
import type { IStorageService } from './types';
import { TauriStorage } from './TauriStorage';
import { BrowserStorage } from './BrowserStorage';
import { IndexedDBStorage } from './IndexedDBStorage';
import { workspaceManager } from '@/services/workspace/workspaceManager';

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

export { IndexedDBStorage, BrowserStorage, TauriStorage };

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
 * Create the initial fallback storage provider based on runtime environment:
 */
function createDefaultStorage(): IStorageService {
  if (isTauriEnvironment()) {
    return new TauriStorage();
  } else if (isFileSystemAccessSupported()) {
    return new BrowserStorage();
  } else {
    return new IndexedDBStorage();
  }
}

// ── Storage Provider Registry & Cache ──
let activeStorageProvider: IStorageService = createDefaultStorage();

let cachedBrowserStorage: BrowserStorage | null =
  activeStorageProvider instanceof BrowserStorage ? activeStorageProvider : null;

let cachedIndexedDbStorage: IndexedDBStorage | null =
  activeStorageProvider instanceof IndexedDBStorage ? activeStorageProvider : null;

let cachedTauriStorage: TauriStorage | null =
  activeStorageProvider instanceof TauriStorage ? activeStorageProvider : null;

export function getOrCreateBrowserStorage(): BrowserStorage {
  if (!cachedBrowserStorage) {
    cachedBrowserStorage = new BrowserStorage();
  }
  return cachedBrowserStorage;
}

export function getOrCreateIndexedDbStorage(): IndexedDBStorage {
  if (!cachedIndexedDbStorage) {
    cachedIndexedDbStorage = new IndexedDBStorage();
  }
  return cachedIndexedDbStorage;
}

export function getOrCreateTauriStorage(): TauriStorage {
  if (!cachedTauriStorage) {
    cachedTauriStorage = new TauriStorage();
  }
  return cachedTauriStorage;
}

export function setStorageProvider(provider: IStorageService): void {
  activeStorageProvider = provider;
}

export function getActiveStorageProvider(): IStorageService {
  return activeStorageProvider;
}

/**
 * Dynamically switches and binds the appropriate storage provider for the given workspace.
 * 
 * - 'browser': Switches to BrowserStorage, retrieves and verifies the FileSystemDirectoryHandle.
 * - 'indexeddb': Switches to IndexedDBStorage, sets the isolated database name (han_notes_db_${ws.id}).
 * - 'tauri': Switches to TauriStorage.
 */
export async function bindWorkspaceStorage(
  workspace: { id: string; name: string; storageType: string },
  handle?: FileSystemDirectoryHandle | null
): Promise<IStorageService> {
  if (workspace.storageType === 'browser') {
    const bs = getOrCreateBrowserStorage();
    const dirHandle = handle || (await workspaceManager.getDirectoryHandle(workspace.id));
    if (!dirHandle) {
      throw new Error(`Directory handle for workspace "${workspace.name}" not found.`);
    }

    try {
      const perm = await (dirHandle as any).queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const req = await (dirHandle as any).requestPermission({ mode: 'readwrite' });
        if (req !== 'granted') {
          throw new Error(`Permission denied for workspace "${workspace.name}".`);
        }
      }
    } catch (err: any) {
      console.warn('[Storage] Directory permission check failed:', err);
    }

    await bs.setWorkspace(workspace.id, dirHandle);
    setStorageProvider(bs);
    return bs;
  } else if (workspace.storageType === 'indexeddb') {
    const idb = getOrCreateIndexedDbStorage();
    idb.setWorkspace(workspace.id);
    if (typeof indexedDB !== 'undefined') {
      await idb.getDb();
    }
    setStorageProvider(idb);
    return idb;
  } else if (workspace.storageType === 'tauri') {
    const ts = getOrCreateTauriStorage();
    setStorageProvider(ts);
    return ts;
  }

  throw new Error(`Unsupported storage type: ${workspace.storageType}`);
}

/**
 * Dynamic singleton storage proxy.
 * Every consumer importing `import { storage } from '@/services/storage'`
 * transparently communicates with whichever storage provider is active for the current workspace.
 */
export const storage: IStorageService = new Proxy({} as IStorageService, {
  get(_target, prop: string | symbol) {
    const val = (activeStorageProvider as any)[prop];
    if (typeof val === 'function') {
      return val.bind(activeStorageProvider);
    }
    return val;
  },
  set(_target, prop: string | symbol, value: any) {
    (activeStorageProvider as any)[prop] = value;
    return true;
  },
});

/**
 * Try to silently reuse a previously saved directory handle.
 * No-op when running in Tauri.
 * Throws if no saved handle — caller should then show UI with pickBrowserDirectory.
 */
export async function initBrowserStorage(): Promise<void> {
  const provider = getActiveStorageProvider();
  if (provider instanceof BrowserStorage) {
    await provider.init();
  }
}

/**
 * Show the directory picker dialog. MUST be called from a user gesture (click).
 * No-op when running in Tauri.
 */
export async function pickBrowserDirectory(): Promise<void> {
  const provider = getOrCreateBrowserStorage();
  await provider.pickDirectory();
  setStorageProvider(provider);
}

/**
 * Get the name of the previously saved directory handle (if any).
 */
export async function getSavedDirectoryName(): Promise<string | null> {
  const provider = getActiveStorageProvider();
  if (provider instanceof BrowserStorage) {
    return await provider.getSavedHandleName();
  }
  return null;
}

/**
 * Request permission to access the previously saved directory handle inside a user gesture (click).
 */
export async function requestSavedDirectoryPermission(): Promise<boolean> {
  const provider = getActiveStorageProvider();
  if (provider instanceof BrowserStorage) {
    return await provider.requestPermissionForSaved();
  }
  return false;
}

/**
 * Clear the saved directory handle from storage.
 */
export async function clearSavedDirectoryHandle(): Promise<void> {
  const provider = getActiveStorageProvider();
  if (provider instanceof BrowserStorage) {
    await provider.clearSavedHandle();
  }
}

/**
 * Initialize IndexedDB storage (used on mobile / fallback environments).
 */
export async function initIndexedDbStorage(): Promise<void> {
  const provider = getOrCreateIndexedDbStorage();
  if (typeof indexedDB !== 'undefined') {
    await provider.getDb();
  }
  setStorageProvider(provider);
}
