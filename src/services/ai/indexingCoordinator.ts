/**
 * indexingCoordinator.ts — Battery-friendly, idle-only incremental indexing coordinator.
 * Prevents UI lag by offloading embedding computations to a Web Worker and scheduling
 * diff checks during browser idle periods (requestIdleCallback).
 */
import { chunkMarkdownNote } from './chunker';
import { embeddingService } from './embeddingService';
import { vectorStore } from './vectorStore';
import { storage } from '@/services/storage';
import type { NoteInfo } from '@/store/noteStore';
import type { VectorChunk } from './types';

class IndexingCoordinator {
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;
  private pendingNoteUpdates = new Map<string, { title: string; content: string }>();
  private onProgressCallback: ((status: { isIndexing: boolean; current: number; total: number }) => void) | null = null;

  public setProgressCallback(cb: (status: { isIndexing: boolean; current: number; total: number }) => void) {
    this.onProgressCallback = cb;
  }

  /**
   * Called on note edits.
   * Debounced with 3-second idle window and scheduled with requestIdleCallback
   * to guarantee zero typing latency while keeping vector index near-real-time.
   */
  public queueNoteUpdate(noteId: string, title: string, content: string) {
    this.pendingNoteUpdates.set(noteId, { title, content });

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          this.flushPendingNotes();
        }, { timeout: 2000 });
      } else {
        this.flushPendingNotes();
      }
    }, 3000); // 3s adaptive idle window
  }

  /**
   * Called when user switches note, leaves editor, or submits an AI chat query.
   * Flushes pending changes immediately.
   */
  public async flushImmediate(noteId?: string, title?: string, content?: string): Promise<void> {
    if (noteId && title && content) {
      this.pendingNoteUpdates.set(noteId, { title, content });
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    await this.flushPendingNotes();
  }

  public async flushPendingNotes(): Promise<void> {
    if (this.isProcessing || this.pendingNoteUpdates.size === 0) return;
    this.isProcessing = true;

    try {
      const entries = Array.from(this.pendingNoteUpdates.entries());
      this.pendingNoteUpdates.clear();

      for (const [noteId, { title, content }] of entries) {
        await this.indexSingleNote(noteId, title, content);
      }
    } catch (err) {
      console.error('Error during incremental indexing:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Incrementally indexes a single note by diffing new chunks against existing hashes.
   */
  public async indexSingleNote(noteId: string, title: string, content: string): Promise<void> {
    const newChunks = chunkMarkdownNote(noteId, title, content);
    const existingChunks = await vectorStore.getNoteChunks(noteId);

    const existingMap = new Map<string, VectorChunk>();
    for (const ec of existingChunks) {
      existingMap.set(ec.hash, ec);
    }

    const chunksToSave: VectorChunk[] = [];
    const chunksNeedingEmbedding: VectorChunk[] = [];

    for (const nc of newChunks) {
      if (existingMap.has(nc.hash)) {
        // Unchanged chunk: reuse existing vector (0ms, 0 CPU)
        const old = existingMap.get(nc.hash)!;
        chunksToSave.push({
          ...nc,
          vector: old.vector,
        });
      } else {
        // New or modified chunk: needs embedding in Web Worker
        chunksNeedingEmbedding.push(nc);
      }
    }

    // Embed only the new/modified chunks in background Web Worker
    if (chunksNeedingEmbedding.length > 0) {
      const textsToEmbed = chunksNeedingEmbedding.map((c) => c.content);
      const vectors = await embeddingService.embedTexts(textsToEmbed);

      for (let i = 0; i < chunksNeedingEmbedding.length; i++) {
        chunksToSave.push({
          ...chunksNeedingEmbedding[i],
          vector: vectors[i],
        });
      }
    }

    // Clear old chunks for this note and save updated set
    await vectorStore.deleteNoteChunks(noteId);
    await vectorStore.saveChunks(chunksToSave);
  }

  /**
   * Scans and indexes the entire vault (used when AI is first enabled).
   * Yields execution in micro-batches to ensure 60+ FPS UI responsiveness.
   */
  public async startVaultIndexing(notes: NoteInfo[]): Promise<void> {
    if (this.isProcessing || notes.length === 0) return;
    this.isProcessing = true;

    if (this.onProgressCallback) {
      this.onProgressCallback({ isIndexing: true, current: 0, total: notes.length });
    }

    try {
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        try {
          const content = await storage.readNote(note.id);
          await this.indexSingleNote(note.id, note.title, content);
        } catch (e) {
          console.warn(`Failed to index note ${note.id}:`, e);
        }

        if (this.onProgressCallback) {
          this.onProgressCallback({ isIndexing: true, current: i + 1, total: notes.length });
        }

        // Micro-yield to main thread so animations and typing stay 100% fluid
        await new Promise((r) => setTimeout(r, 40));
      }
    } finally {
      this.isProcessing = false;
      if (this.onProgressCallback) {
        this.onProgressCallback({ isIndexing: false, current: notes.length, total: notes.length });
      }
    }
  }

  public async deleteNote(noteId: string): Promise<void> {
    this.pendingNoteUpdates.delete(noteId);
    await vectorStore.deleteNoteChunks(noteId);
  }

  public async deleteFolder(folderPath: string): Promise<void> {
    for (const key of Array.from(this.pendingNoteUpdates.keys())) {
      if (key === folderPath || key.startsWith(folderPath + '/')) {
        this.pendingNoteUpdates.delete(key);
      }
    }
    await vectorStore.deleteNoteChunksByPrefix(folderPath);
  }

  public async renameNote(
    oldPath: string,
    newPath: string,
    newTitle: string,
    newContent: string
  ): Promise<void> {
    this.pendingNoteUpdates.delete(oldPath);
    await vectorStore.deleteNoteChunks(oldPath);
    await this.indexSingleNote(newPath, newTitle, newContent);
  }

  public async purgeAll(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.pendingNoteUpdates.clear();
    await vectorStore.purgeAllVectors();
    embeddingService.unload();
  }
}

export const indexingCoordinator = new IndexingCoordinator();
