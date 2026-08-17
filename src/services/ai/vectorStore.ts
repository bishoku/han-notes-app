/**
 * vectorStore.ts — IndexedDB persistent vector database with client-side Cosine Similarity search.
 */
import type { VectorChunk, SearchResult } from './types';

const DB_NAME = 'han_vector_store_v1';
const STORE_NAME = 'chunks';

function openVectorDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
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
 * Computes Cosine Similarity between two L2-normalized vectors.
 * Because embeddings from Transformers.js are L2-normalized, cosine similarity is equal to their dot product.
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
  public async saveChunks(chunks: VectorChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const db = await openVectorDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const chunk of chunks) {
        store.put(chunk);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getNoteChunks(noteId: string): Promise<VectorChunk[]> {
    const db = await openVectorDb();
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
    const db = await openVectorDb();
    const existing = await this.getNoteChunks(noteId);
    if (existing.length === 0) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const chunk of existing) {
        store.delete(chunk.id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async deleteNoteChunksByPrefix(prefix: string): Promise<void> {
    const all = await this.getAllChunks();
    const toDelete = all.filter(
      (c) => c.noteId === prefix || c.noteId.startsWith(prefix + '/')
    );
    if (toDelete.length === 0) return;

    const db = await openVectorDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const chunk of toDelete) {
        store.delete(chunk.id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getAllChunks(): Promise<VectorChunk[]> {
    const db = await openVectorDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async purgeAllVectors(): Promise<void> {
    const db = await openVectorDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
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

    for (const chunk of allChunks) {
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
