/**
 * Sync Storage Adapter — Intermediate Bridge & Canonical Note Mapper.
 * 
 * Strictly decouples the physical storage layers (TauriStorage, BrowserStorage,
 * IndexedDBStorage) from the synchronization engine.
 * 
 * Manages soft deletes (tombstones) and metadata to guarantee that deleted notes
 * are never resurrected across synchronization sessions.
 */
import { storage } from '@/services/storage';
import { normalizeNoteId, toNoteFilePath, extractTitleFromId, extractFolderFromId } from '@/utils/pathUtils';
import { computeContentHash } from './crypto';
import type { CanonicalNote, NoteSummary, SyncManifest, VaultSyncMetadata } from './types';

const SYNC_METADATA_FILE = '.han_sync_metadata.json';

function getOrCreateDeviceId(): string {
  const KEY = 'han_sync_device_id';
  if (typeof localStorage !== 'undefined') {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  }
  return `dev_${Math.random().toString(36).slice(2, 10)}`;
}

export class SyncStorageAdapter {
  private deviceId: string = getOrCreateDeviceId();
  private metadataCache: VaultSyncMetadata | null = null;

  /**
   * Loads sync metadata (.han_sync_metadata.json) from vault.
   */
  async loadMetadata(): Promise<VaultSyncMetadata> {
    if (this.metadataCache) return this.metadataCache;

    try {
      const exists = await storage.vaultFileExists(SYNC_METADATA_FILE);
      if (exists) {
        const text = await storage.readVaultFile(SYNC_METADATA_FILE);
        const data = JSON.parse(text);
        if (data && data.version === 1) {
          this.metadataCache = data;
          return data;
        }
      }
    } catch {
      // Ignore reading failure and initialize empty
    }

    this.metadataCache = {
      version: 1,
      deviceId: this.deviceId,
      notes: {},
      tombstones: {},
    };
    return this.metadataCache;
  }

  /**
   * Persists sync metadata (.han_sync_metadata.json) to vault.
   */
  async saveMetadata(): Promise<void> {
    if (!this.metadataCache) return;
    try {
      const json = JSON.stringify(this.metadataCache, null, 2);
      await storage.writeVaultFile(SYNC_METADATA_FILE, json);
    } catch (err) {
      console.warn('[SyncStorageAdapter] Failed to save metadata:', err);
    }
  }

  /**
   * Records a soft-delete tombstone when a note is deleted locally.
   */
  async recordTombstone(idOrPath: string): Promise<void> {
    const meta = await this.loadMetadata();
    const cleanId = normalizeNoteId(idOrPath);
    const path = toNoteFilePath(cleanId);

    meta.tombstones[cleanId] = {
      deletedAt: Date.now(),
      path,
    };
    delete meta.notes[cleanId];

    await this.saveMetadata();
  }

  /**
   * Clears any active tombstone for a note ID (e.g. when rewritten).
   */
  async clearTombstone(cleanId: string): Promise<void> {
    const meta = await this.loadMetadata();
    if (meta.tombstones[cleanId]) {
      delete meta.tombstones[cleanId];
      await this.saveMetadata();
    }
  }

  /**
   * Retrieves all canonical notes (both active notes and tombstones) from local storage.
   */
  async getAllCanonicalNotes(): Promise<CanonicalNote[]> {
    const meta = await this.loadMetadata();
    const vaultFiles = await storage.getVaultFiles();
    const canonicalList: CanonicalNote[] = [];

    // 1. Process all active notes from vault
    for (const file of vaultFiles) {
      const cleanId = normalizeNoteId(file.id);
      try {
        const content = await storage.readNote(cleanId);
        const hash = await computeContentHash(content);

        // Update or retrieve cached timestamp
        let updatedAt = meta.notes[cleanId]?.updatedAt;
        if (!updatedAt || meta.notes[cleanId]?.hash !== hash) {
          updatedAt = Date.now();
          meta.notes[cleanId] = { updatedAt, hash };
        }

        canonicalList.push({
          id: cleanId,
          path: file.path,
          content,
          updatedAt,
          deleted: false,
          hash,
        });

        // Ensure this active note has no lingering tombstone
        if (meta.tombstones[cleanId]) {
          delete meta.tombstones[cleanId];
        }
      } catch (err) {
        console.warn(`[SyncStorageAdapter] Could not read note ${cleanId}:`, err);
      }
    }

    // 2. Include all active tombstones
    for (const [tombstoneId, tombstone] of Object.entries(meta.tombstones)) {
      canonicalList.push({
        id: tombstoneId,
        path: tombstone.path,
        content: '',
        updatedAt: tombstone.deletedAt,
        deleted: true,
        deletedAt: tombstone.deletedAt,
        hash: '',
      });
    }

    await this.saveMetadata();
    return canonicalList;
  }

  /**
   * Builds the lightweight SyncManifest for fast diffing against a remote peer.
   */
  async getSyncManifest(): Promise<SyncManifest> {
    const canonicalNotes = await this.getAllCanonicalNotes();
    const notesSummary: Record<string, NoteSummary> = {};

    for (const note of canonicalNotes) {
      notesSummary[note.id] = {
        id: note.id,
        updatedAt: note.updatedAt,
        hash: note.hash,
        deleted: note.deleted,
        deletedAt: note.deletedAt,
      };
    }

    return {
      deviceId: this.deviceId,
      timestamp: Date.now(),
      notes: notesSummary,
    };
  }

  /**
   * Applies an incoming canonical note from a remote peer:
   * - Preserves tombstones if incoming is deleted and newer
   * - Updates or creates file if incoming is newer
   * - Resolves concurrent conflicts by creating conflict copy notes
   */
  async applyCanonicalNote(
    incoming: CanonicalNote
  ): Promise<{ status: 'created' | 'updated' | 'deleted' | 'skipped' | 'conflict'; conflictId?: string }> {
    const meta = await this.loadMetadata();
    const cleanId = normalizeNoteId(incoming.id);

    // Case 1: Incoming note is a TOMBSTONE (deleted on remote device)
    if (incoming.deleted) {
      const tombstoneTime = incoming.deletedAt || incoming.updatedAt;

      // Check if we have this note locally
      let localContent: string | null = null;
      try {
        localContent = await storage.readNote(cleanId);
      } catch {
        localContent = null;
      }

      if (localContent !== null) {
        const localMeta = meta.notes[cleanId];
        const localUpdatedAt = localMeta?.updatedAt || 0;

        // If local was modified AFTER the remote deletion, local edit wins!
        if (localUpdatedAt > tombstoneTime) {
          return { status: 'skipped' };
        }

        // Otherwise, honor the tombstone and delete local note
        try {
          await storage.deleteNode(incoming.path || toNoteFilePath(cleanId));
        } catch {
          // Ignore if already deleted
        }
      }

      // Record tombstone locally so it does not resurrect
      meta.tombstones[cleanId] = {
        deletedAt: tombstoneTime,
        path: incoming.path || toNoteFilePath(cleanId),
      };
      delete meta.notes[cleanId];
      await this.saveMetadata();

      return { status: 'deleted' };
    }

    // Case 2: Incoming note is an ACTIVE NOTE
    // Check if we have a local tombstone for this note
    const localTombstone = meta.tombstones[cleanId];
    if (localTombstone && localTombstone.deletedAt > incoming.updatedAt) {
      // Local deletion wins over older remote edit
      return { status: 'skipped' };
    }

    // Check if local note already exists
    let localContent: string | null = null;
    try {
      localContent = await storage.readNote(cleanId);
    } catch {
      localContent = null;
    }

    // 2A: Note does not exist locally -> Create it
    if (localContent === null) {
      const parentFolder = extractFolderFromId(cleanId);
      if (parentFolder) {
        try {
          await storage.createFolder('', parentFolder);
        } catch {}
      }

      await storage.writeNote(cleanId, incoming.content);

      meta.notes[cleanId] = {
        updatedAt: incoming.updatedAt,
        hash: incoming.hash || (await computeContentHash(incoming.content)),
      };
      delete meta.tombstones[cleanId];
      await this.saveMetadata();

      return { status: 'created' };
    }

    // 2B: Note exists locally -> Compare content and timestamps
    const localHash = meta.notes[cleanId]?.hash || (await computeContentHash(localContent));
    const incomingHash = incoming.hash || (await computeContentHash(incoming.content));

    // If contents are identical, no-op
    if (localHash === incomingHash) {
      return { status: 'skipped' };
    }

    const localUpdatedAt = meta.notes[cleanId]?.updatedAt || 0;

    // If incoming note is strictly newer -> Overwrite local
    if (incoming.updatedAt > localUpdatedAt) {
      await storage.writeNote(cleanId, incoming.content);

      meta.notes[cleanId] = {
        updatedAt: incoming.updatedAt,
        hash: incomingHash,
      };
      delete meta.tombstones[cleanId];
      await this.saveMetadata();

      return { status: 'updated' };
    }

    // If local note is strictly newer -> Local wins, will be sent to peer
    if (localUpdatedAt > incoming.updatedAt) {
      return { status: 'skipped' };
    }

    // 2C: Concurrent conflict (equal timestamps or divergent edits) -> Create conflict copy
    const dateStr = new Date().toISOString().slice(0, 10);
    const title = extractTitleFromId(cleanId);
    const parentFolder = extractFolderFromId(cleanId);
    const conflictTitle = `${title} (Conflict ${dateStr} ${Math.random().toString(36).slice(2, 6)})`;
    const conflictId = parentFolder ? `${parentFolder}/${conflictTitle}` : conflictTitle;

    await storage.writeNote(conflictId, incoming.content);

    return {
      status: 'conflict',
      conflictId,
    };
  }
}

export const syncStorageAdapter = new SyncStorageAdapter();
