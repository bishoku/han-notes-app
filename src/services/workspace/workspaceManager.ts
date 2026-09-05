/**
 * WorkspaceManager — Central IndexedDB metadata and DirectoryHandle registry.
 * 
 * Works seamlessly across:
 * - Desktop Chrome / Edge / Arc (File System Access directory handles)
 * - Mobile Safari / Android / PWA (Scoped IndexedDB databases)
 * - Tauri Desktop (Native file paths)
 */
import type { Workspace, WorkspaceStorageType } from './types';
import { loadHandle as loadLegacyHandle } from '@/services/storage/browser/handleDb';

const DB_NAME = 'han_workspaces_meta';
const DB_VERSION = 1;
const STORE_WORKSPACES = 'workspaces';
const STORE_HANDLES = 'handles';

const ACTIVE_WS_KEY = 'han_active_workspace_id';

function openWorkspaceMetaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_WORKSPACES)) {
        db.createObjectStore(STORE_WORKSPACES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class WorkspaceManager {
  private cachedWorkspaces: Workspace[] | null = null;

  /**
   * Retrieves all registered workspaces sorted by last access (updatedAt desc).
   */
  async listWorkspaces(): Promise<Workspace[]> {
    try {
      const db = await openWorkspaceMetaDb();
      const tx = db.transaction(STORE_WORKSPACES, 'readonly');
      const store = tx.objectStore(STORE_WORKSPACES);
      const req = store.getAll();

      const items = await new Promise<Workspace[]>((resolve, reject) => {
        req.onsuccess = () => resolve((req.result as Workspace[]) || []);
        req.onerror = () => reject(req.error);
      });

      // Sort: active / recently updated first
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      this.cachedWorkspaces = items;
      return items;
    } catch (err) {
      console.warn('[WorkspaceManager] Failed to list workspaces:', err);
      return this.cachedWorkspaces || [];
    }
  }

  /**
   * Retrieves a single workspace by ID.
   */
  async getWorkspace(id: string): Promise<Workspace | null> {
    const list = await this.listWorkspaces();
    return list.find((w) => w.id === id) || null;
  }

  /**
   * Saves or updates a workspace.
   */
  async saveWorkspace(ws: Workspace): Promise<void> {
    const db = await openWorkspaceMetaDb();
    const tx = db.transaction(STORE_WORKSPACES, 'readwrite');
    tx.objectStore(STORE_WORKSPACES).put(ws);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    this.cachedWorkspaces = null;
  }

  /**
   * Deletes a workspace and its associated DirectoryHandle (if browser FSA).
   */
  async deleteWorkspace(id: string): Promise<void> {
    const db = await openWorkspaceMetaDb();
    const tx = db.transaction([STORE_WORKSPACES, STORE_HANDLES], 'readwrite');
    tx.objectStore(STORE_WORKSPACES).delete(id);
    tx.objectStore(STORE_HANDLES).delete(id);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    this.cachedWorkspaces = null;

    // If active workspace was deleted, clear active key
    if (this.getActiveWorkspaceId() === id) {
      this.setActiveWorkspaceId(null);
    }
  }

  /**
   * Saves a FileSystemDirectoryHandle for a specific workspace.
   */
  async saveDirectoryHandle(workspaceId: string, handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await openWorkspaceMetaDb();
    const tx = db.transaction(STORE_HANDLES, 'readwrite');
    tx.objectStore(STORE_HANDLES).put(handle, workspaceId);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Retrieves the FileSystemDirectoryHandle for a workspace.
   */
  async getDirectoryHandle(workspaceId: string): Promise<FileSystemDirectoryHandle | null> {
    try {
      const db = await openWorkspaceMetaDb();
      const tx = db.transaction(STORE_HANDLES, 'readonly');
      const req = tx.objectStore(STORE_HANDLES).get(workspaceId);

      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[WorkspaceManager] Failed to load handle for workspace ${workspaceId}:`, err);
      return null;
    }
  }

  /**
   * Deletes a directory handle from storage.
   */
  async deleteDirectoryHandle(workspaceId: string): Promise<void> {
    const db = await openWorkspaceMetaDb();
    const tx = db.transaction(STORE_HANDLES, 'readwrite');
    tx.objectStore(STORE_HANDLES).delete(workspaceId);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Gets the last active workspace ID from localStorage.
   */
  getActiveWorkspaceId(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(ACTIVE_WS_KEY);
  }

  /**
   * Sets the active workspace ID in localStorage.
   */
  setActiveWorkspaceId(id: string | null): void {
    if (typeof localStorage === 'undefined') return;
    if (id) {
      localStorage.setItem(ACTIVE_WS_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_WS_KEY);
    }
  }

  /**
   * Seamless Zero-Data-Loss Migration for existing installations.
   * If workspaces metadata DB is empty, checks existing legacy data and
   * creates a default workspace pointing to it.
   */
  async migrateExistingDataIfNeeded(defaultStorageType: WorkspaceStorageType): Promise<Workspace[]> {
    const existing = await this.listWorkspaces();
    if (existing.length > 0) {
      return existing;
    }

    console.log('[WorkspaceManager] No workspaces found. Running initial bootstrap migration...');

    // 1. Check if legacy File System Access handle exists ('vaultDir')
    if (defaultStorageType === 'browser') {
      try {
        const legacyHandle = await loadLegacyHandle();
        if (legacyHandle) {
          const defaultWs: Workspace = {
            id: 'default',
            name: legacyHandle.name || 'Notlarım',
            storageType: 'browser',
            handleName: legacyHandle.name,
            color: '#6366f1',
            icon: 'Folder',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isDefault: true,
          };
          await this.saveWorkspace(defaultWs);
          await this.saveDirectoryHandle('default', legacyHandle);
          this.setActiveWorkspaceId('default');
          return [defaultWs];
        }
      } catch (e) {
        console.warn('[WorkspaceManager] Legacy handle check failed:', e);
      }
    }

    // 2. Default Workspace fallback (IndexedDB or freshly started)
    const defaultWs: Workspace = {
      id: 'default',
      name: 'Varsayılan',
      storageType: defaultStorageType,
      color: '#6366f1',
      icon: defaultStorageType === 'browser' ? 'Folder' : 'Book',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
    };

    await this.saveWorkspace(defaultWs);
    this.setActiveWorkspaceId('default');
    return [defaultWs];
  }
}

export const workspaceManager = new WorkspaceManager();
