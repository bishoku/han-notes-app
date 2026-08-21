/**
 * embeddingService.ts — Main thread bridge to the embedding Web Worker.
 *
 * Tracks which model was actually loaded by the worker (preferred vs fallback)
 * so the rest of the system can react to model changes (e.g. re-index vectors).
 */

class EmbeddingService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private isReady = false;
  private onProgressCallback: ((progress: number, file?: string) => void) | null = null;

  /** The model name actually loaded by the worker (may differ from requested if fallback was used) */
  private _loadedModel: string | null = null;
  private onModelResolvedCallback: ((modelName: string) => void) | null = null;

  public setProgressCallback(cb: (progress: number, file?: string) => void) {
    this.onProgressCallback = cb;
  }

  /**
   * Register a callback to be notified when the worker resolves which model was actually loaded.
   * This fires once after the first embedding operation or INIT, and reports the actual model name
   * (which may be the fallback if the preferred model's CDN was unreachable).
   */
  public setModelResolvedCallback(cb: (modelName: string) => void) {
    this.onModelResolvedCallback = cb;
  }

  /** Returns the model name that was actually loaded by the worker, or null if not yet loaded. */
  public getLoadedModel(): string | null {
    return this._loadedModel;
  }

  private initWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./embedding.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (e: MessageEvent) => {
        const { type, id, vectors, vector, error, progress, file, loadedModel } = e.data;

        // Track which model was actually loaded (preferred or fallback)
        if (loadedModel && loadedModel !== this._loadedModel) {
          this._loadedModel = loadedModel;
          if (this.onModelResolvedCallback) {
            this.onModelResolvedCallback(loadedModel);
          }
        }

        if (type === 'MODEL_DOWNLOAD_PROGRESS' && this.onProgressCallback) {
          this.onProgressCallback(progress, file);
        } else if (type === 'READY') {
          this.isReady = true;
        }

        if (id && this.pendingRequests.has(id)) {
          const { resolve, reject } = this.pendingRequests.get(id)!;
          this.pendingRequests.delete(id);

          if (type === 'ERROR') {
            reject(new Error(error));
          } else if (type === 'EMBED_BATCH_DONE') {
            resolve(vectors);
          } else if (type === 'EMBED_QUERY_DONE') {
            resolve(vector);
          } else {
            resolve(null);
          }
        }
      };

      this.worker.onerror = (err) => {
        console.error('Embedding worker error:', err);
      };
    }
    return this.worker;
  }

  public async embedTexts(texts: string[], modelName?: string): Promise<number[][]> {
    if (texts.length === 0) return [];
    const worker = this.initWorker();
    const id = `batch_${Date.now()}_${Math.random()}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      worker.postMessage({ type: 'EMBED_BATCH', id, texts, modelName });
    });
  }

  public async embedQuery(text: string, modelName?: string): Promise<number[]> {
    if (!text.trim()) return [];
    const worker = this.initWorker();
    const id = `query_${Date.now()}_${Math.random()}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      worker.postMessage({ type: 'EMBED_QUERY', id, text, modelName });
    });
  }

  public isModelReady(): boolean {
    return this.isReady;
  }

  public unload() {
    if (this.worker) {
      this.worker.postMessage({ type: 'UNLOAD' });
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      this._loadedModel = null;
      this.pendingRequests.clear();
    }
  }
}

export const embeddingService = new EmbeddingService();
