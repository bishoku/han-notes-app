/**
 * vectorStore.ts — IndexedDB persistent vector database with in-memory caching
 * and client-side Cosine Similarity search.
 * Supports multi-workspace isolation (isolated vector databases per workspace).
 */
import type { VectorChunk, SearchResult } from './types';

const STORE_NAME = 'chunks';

function openVectorDb(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('noteId', 'noteId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Computes Cosine Similarity between two L2-normalized vectors (dot product).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export class VectorStore {
  private currentWorkspaceId: string = 'default';
  private db: IDBDatabase | null = null;
  // In-memory cache of vector chunks to prevent repeated IndexedDB deserialization
  private cachedChunks: VectorChunk[] | null = null;

  public getActiveWorkspaceId(): string {
    return this.currentWorkspaceId;
  }

  public getDbName(): string {
    return this.currentWorkspaceId === 'default'
      ? 'han_vector_store_v1'
      : `han_vector_store_${this.currentWorkspaceId}`;
  }

  /**
   * Switches the active workspace, resetting connection and in-memory cache.
   */
  public async setWorkspace(workspaceId: string): Promise<void> {
    if (this.currentWorkspaceId !== workspaceId) {
      this.currentWorkspaceId = workspaceId;
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      this.cachedChunks = null;
    }
  }

  private async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    this.db = await openVectorDb(this.getDbName());
    return this.db;
  }

  /**
   * Deletes a workspace's vector database when workspace is deleted.
   */
  public static async deleteWorkspaceDatabase(workspaceId: string): Promise<void> {
    const dbName = workspaceId === 'default' ? 'han_vector_store_v1' : `han_vector_store_${workspaceId}`;
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async saveChunks(chunks: VectorChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const db = await this.getDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const chunk of chunks) {
        store.put(chunk);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Invalidate / update memory cache
    if (this.cachedChunks) {
      const chunkMap = new Map(this.cachedChunks.map((c) => [c.id, c]));
      for (const c of chunks) {
        chunkMap.set(c.id, c);
      }
      this.cachedChunks = Array.from(chunkMap.values());
    }
  }

  public async getNoteChunks(noteId: string): Promise<VectorChunk[]> {
    if (this.cachedChunks) {
      return this.cachedChunks.filter((c) => c.noteId === noteId);
    }

    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('noteId');
      const req = index.getAll(noteId);

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteNoteChunks(noteId: string): Promise<void> {
    const existing = await this.getNoteChunks(noteId);
    if (existing.length === 0) return;

    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const chunk of existing) {
        store.delete(chunk.id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if (this.cachedChunks) {
      this.cachedChunks = this.cachedChunks.filter((c) => c.noteId !== noteId);
    }
  }

  public async deleteNoteChunksByPrefix(prefix: string): Promise<void> {
    const all = await this.getAllChunks();
    const toDelete = all.filter(
      (c) => c.noteId === prefix || c.noteId.startsWith(prefix + '/')
    );
    if (toDelete.length === 0) return;

    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const chunk of toDelete) {
        store.delete(chunk.id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if (this.cachedChunks) {
      this.cachedChunks = this.cachedChunks.filter(
        (c) => c.noteId !== prefix && !c.noteId.startsWith(prefix + '/')
      );
    }
  }

  public async getAllChunks(): Promise<VectorChunk[]> {
    if (this.cachedChunks) {
      return this.cachedChunks;
    }

    const db = await this.getDb();
    const chunks = await new Promise<VectorChunk[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    this.cachedChunks = chunks;
    return chunks;
  }

  public async purgeAllVectors(): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    this.cachedChunks = [];
  }

  public async getStats(): Promise<{ totalChunks: number; totalNotes: number }> {
    const all = await this.getAllChunks();
    const uniqueNotes = new Set(all.map((c) => c.noteId));
    return {
      totalChunks: all.length,
      totalNotes: uniqueNotes.size,
    };
  }

  public async searchSimilar(
    queryVector: number[],
    topK = 5,
    minSimilarity = 0.25
  ): Promise<SearchResult[]> {
    const allChunks = await this.getAllChunks();
    const scored: SearchResult[] = [];

    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      if (chunk.vector && chunk.vector.length > 0) {
        const similarity = cosineSimilarity(queryVector, chunk.vector);
        if (similarity >= minSimilarity) {
          scored.push({ chunk, similarity });
        }
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }
}

export const vectorStore = new VectorStore();
