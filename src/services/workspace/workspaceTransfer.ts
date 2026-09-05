/**
 * workspaceTransfer.ts — Cross-workspace file and folder migration service.
 * 
 * Handles reading notes/folders (and referenced assets) from the active workspace
 * and writing them into any other target workspace (Browser FSA, IndexedDB, or Tauri),
 * followed by clean deletion from the source workspace and state cleanup.
 */
import { storage } from '@/services/storage';
import { workspaceManager } from './workspaceManager';
import { BrowserStorage } from '@/services/storage/BrowserStorage';
import { IndexedDBStorage } from '@/services/storage/IndexedDBStorage';
import { TauriStorage } from '@/services/storage/TauriStorage';
import type { IStorageService } from '@/services/storage/types';
import { useNoteStore } from '@/store/noteStore';
import { useGitStore } from '@/store/gitStore';

/**
 * Creates and initializes an isolated IStorageService instance for the target workspace.
 */
export async function getStorageForWorkspace(workspaceId: string): Promise<IStorageService> {
  const targetWs = await workspaceManager.getWorkspace(workspaceId);
  if (!targetWs) {
    throw new Error(`Hedef çalışma alanı bulunamadı (ID: ${workspaceId})`);
  }

  if (targetWs.storageType === 'browser') {
    const handle = await workspaceManager.getDirectoryHandle(workspaceId);
    if (!handle) {
      throw new Error(
        'Hedef çalışma alanına ait klasör erişimi bulunamadı. Lütfen önce çalışma alanını seçerek klasör izni verin.'
      );
    }

    try {
      const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const req = await (handle as any).requestPermission({ mode: 'readwrite' });
        if (req !== 'granted') {
          throw new Error('Hedef çalışma alanı klasörüne yazma izni verilmedi.');
        }
      }
    } catch (err: any) {
      console.warn('[workspaceTransfer] Directory permission check failed:', err);
      throw new Error('Hedef çalışma alanı klasör izin doğrulaması başarısız oldu.');
    }

    const bs = new BrowserStorage();
    await bs.setWorkspace(workspaceId, handle);
    return bs;
  } else if (targetWs.storageType === 'indexeddb') {
    const idb = new IndexedDBStorage();
    idb.setWorkspace(workspaceId);
    if (typeof indexedDB !== 'undefined') {
      await idb.getDb();
    }
    return idb;
  } else if (targetWs.storageType === 'tauri') {
    return new TauriStorage();
  }

  throw new Error(`Bilinmeyen depolama tipi: ${targetWs.storageType}`);
}

/**
 * Extracts and copies any local assets (_assets/...) referenced in note markdown content.
 */
async function transferReferencedAssets(
  content: string,
  targetStorage: IStorageService
): Promise<void> {
  if (!content) return;
  const assetRegex = /_assets\/([^")\s]+)/g;
  const matches = Array.from(content.matchAll(assetRegex));
  if (matches.length === 0) return;

  for (const match of matches) {
    const assetRelPath = match[0];
    try {
      const bytes = await storage.getImageBytes(assetRelPath);
      if (bytes && bytes.length > 0) {
        const fileName = assetRelPath.split('/').pop() || 'asset.png';
        await targetStorage.saveImageBytes('', fileName, bytes);
      }
    } catch (err) {
      // Non-fatal if an asset is missing or unreadable
      console.warn(`[workspaceTransfer] Asset transfer skipped for ${assetRelPath}:`, err);
    }
  }
}

/**
 * Moves a note or folder from the current workspace to a target workspace.
 * 
 * @param srcRelPath Relative path in current workspace (e.g. "Work/Project.md" or "Work")
 * @param targetWorkspaceId ID of target workspace to move to
 * @param isDir Whether the item is a folder
 */
export async function moveNodeToWorkspace(
  srcRelPath: string,
  targetWorkspaceId: string,
  isDir: boolean
): Promise<{ success: boolean; movedCount: number; targetWorkspaceName: string }> {
  const targetWs = await workspaceManager.getWorkspace(targetWorkspaceId);
  if (!targetWs) {
    throw new Error('Hedef çalışma alanı bulunamadı.');
  }

  const targetStorage = await getStorageForWorkspace(targetWorkspaceId);
  let movedCount = 0;

  if (!isDir) {
    // ── Single Note Transfer ──
    const content = await storage.readNote(srcRelPath);
    await targetStorage.writeNote(srcRelPath, content);
    await transferReferencedAssets(content, targetStorage);
    movedCount = 1;
  } else {
    // ── Folder Transfer ──
    const currentNotes = useNoteStore.getState().notes;
    const cleanPrefix = srcRelPath.replace(/^\/+|\/+$/g, '');
    const prefix = `${cleanPrefix}/`;

    const matchingNotes = currentNotes.filter(
      (n) => n.path === cleanPrefix || n.path.startsWith(prefix) || n.id === cleanPrefix || n.id.startsWith(prefix)
    );

    // If empty folder, ensure the directory exists on target
    if (matchingNotes.length === 0) {
      const parentDir = cleanPrefix.includes('/')
        ? cleanPrefix.substring(0, cleanPrefix.lastIndexOf('/'))
        : '';
      const folderName = cleanPrefix.includes('/')
        ? cleanPrefix.substring(cleanPrefix.lastIndexOf('/') + 1)
        : cleanPrefix;
      await targetStorage.createFolder(parentDir, folderName);
    } else {
      for (const note of matchingNotes) {
        const notePath = note.path || note.id;
        try {
          const content = await storage.readNote(note.id || note.path);
          await targetStorage.writeNote(notePath, content);
          await transferReferencedAssets(content, targetStorage);
          movedCount++;
        } catch (err) {
          console.error(`[workspaceTransfer] Error transferring note ${notePath}:`, err);
        }
      }
    }
  }

  // ── Delete item from source workspace ──
  await useNoteStore.getState().deleteNode(srcRelPath);

  // ── Reset URL hash if pointing to the moved/deleted note ──
  if (typeof window !== 'undefined') {
    const currentNoteId = useNoteStore.getState().currentNoteId;
    if (!currentNoteId) {
      const hash = window.location.hash || '';
      if (hash.startsWith('#/notes/') && hash.length > '#/notes/'.length) {
        window.location.hash = '#/notes';
      }
    }
  }

  // ── Update target workspace access timestamp ──
  targetWs.updatedAt = Date.now();
  await workspaceManager.saveWorkspace(targetWs);

  // ── Git snapshot for source workspace ──
  if (typeof window !== 'undefined') {
    useGitStore.getState().createSnapshot(`Farklı alana taşındı: ${srcRelPath} -> [${targetWs.name}]`);
  }

  return {
    success: true,
    movedCount: Math.max(movedCount, 1),
    targetWorkspaceName: targetWs.name,
  };
}
