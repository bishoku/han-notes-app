/**
 * embedding.worker.ts — Dedicated Web Worker for offline local embedding generation.
 * Isolates ONNX Runtime Web / Transformers.js execution completely from the Main React UI Thread.
 *
 * Model Strategy (Fallback):
 *   1. PREFERRED: `Xenova/multilingual-e5-small` — 100+ language support (incl. Turkish), downloaded from HuggingFace CDN.
 *   2. FALLBACK:  `Xenova/all-MiniLM-L6-v2`     — English-only but bundled locally in public/models/ for offline/restricted networks.
 *
 * If HuggingFace CDN is unreachable (e.g. corporate firewalls), the worker transparently falls back
 * to the local model so AI features remain functional without internet access.
 *
 * E5 models require "query: " / "passage: " prefixes for optimal retrieval quality.
 */
import { pipeline, env } from '@xenova/transformers';

// Configure transformers to use local models from GitHub Pages/PWA or fallback to HuggingFace
const baseUrl = import.meta.env.BASE_URL || '/';
const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

env.allowLocalModels = true;
env.allowRemoteModels = true;
env.localModelPath = `${normalizedBase}models/`;
env.useBrowserCache = true;

let embedder: any = null;
let currentModelName: string | null = null;

/** Preferred model: multilingual, better for Turkish content */
const PREFERRED_MODEL = 'Xenova/multilingual-e5-small';
/** Fallback model: English-only but bundled locally for offline/restricted networks */
const FALLBACK_MODEL = 'Xenova/all-MiniLM-L6-v2';

/**
 * E5 family models require specific text prefixes for asymmetric retrieval:
 * - "query: " for search queries
 * - "passage: " for documents/passages being indexed
 */
function isE5Model(modelName: string): boolean {
  return modelName.toLowerCase().includes('e5');
}

/**
 * Attempts to load the preferred model first. If it fails (network error, CDN blocked),
 * falls back to the locally bundled model.
 */
async function getEmbedder(requestedModel?: string): Promise<any> {
  const targetModel = requestedModel || PREFERRED_MODEL;

  // If model changed, unload previous one
  if (embedder && currentModelName && currentModelName !== targetModel) {
    embedder = null;
    currentModelName = null;
  }

  if (!embedder) {
    self.postMessage({ type: 'STATUS', status: 'Model yükleniyor...', progress: 0 });

    const progressCallback = (p: any) => {
      if (p && typeof p.progress === 'number') {
        self.postMessage({
          type: 'MODEL_DOWNLOAD_PROGRESS',
          file: p.file,
          progress: Math.round(p.progress),
        });
      }
    };

    // Try preferred model first
    try {
      embedder = await pipeline('feature-extraction', targetModel, {
        quantized: true,
        progress_callback: progressCallback,
      });
      currentModelName = targetModel;
    } catch (preferredErr: any) {
      // If the requested model was already the fallback, don't retry
      if (targetModel === FALLBACK_MODEL) {
        throw preferredErr;
      }

      console.warn(
        `[EmbeddingWorker] Preferred model "${targetModel}" failed to load: ${preferredErr?.message}. Falling back to local model "${FALLBACK_MODEL}"...`
      );

      self.postMessage({
        type: 'STATUS',
        status: 'Çevrimdışı model yükleniyor...',
        progress: 0,
      });

      // Fallback to locally bundled model
      embedder = await pipeline('feature-extraction', FALLBACK_MODEL, {
        quantized: true,
        progress_callback: progressCallback,
      });
      currentModelName = FALLBACK_MODEL;
    }

    // Notify main thread which model was actually loaded
    self.postMessage({ type: 'READY', loadedModel: currentModelName });
  }
  return embedder;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, id, texts, text, modelName } = e.data;

  try {
    if (type === 'INIT') {
      await getEmbedder(modelName);
      self.postMessage({ type: 'INIT_DONE', id, loadedModel: currentModelName });
    } else if (type === 'EMBED_BATCH') {
      const model = await getEmbedder(modelName);
      const useE5Prefix = isE5Model(currentModelName || '');
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i++) {
        const inputText = useE5Prefix ? `passage: ${texts[i]}` : texts[i];
        const output = await model(inputText, { pooling: 'mean', normalize: true });
        results.push(Array.from(output.data as Float32Array));
      }

      self.postMessage({ type: 'EMBED_BATCH_DONE', id, vectors: results, loadedModel: currentModelName });
    } else if (type === 'EMBED_QUERY') {
      const model = await getEmbedder(modelName);
      const useE5Prefix = isE5Model(currentModelName || '');
      const inputText = useE5Prefix ? `query: ${text}` : text;
      const output = await model(inputText, { pooling: 'mean', normalize: true });
      const vector = Array.from(output.data as Float32Array);

      self.postMessage({ type: 'EMBED_QUERY_DONE', id, vector, loadedModel: currentModelName });
    } else if (type === 'UNLOAD') {
      embedder = null;
      currentModelName = null;
      self.postMessage({ type: 'UNLOADED' });
    }
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', id, error: err?.message || String(err) });
  }
};
