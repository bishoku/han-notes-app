/**
 * embedding.worker.ts — Dedicated Web Worker for offline local embedding generation.
 * Isolates ONNX Runtime Web / Transformers.js execution completely from the Main React UI Thread.
 */
import { pipeline, env } from '@xenova/transformers';

// Configure transformers to use local models from GitHub Pages/PWA or fallback to HuggingFace
const baseUrl = import.meta.env.BASE_URL || '/';
const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

env.allowLocalModels = true;
env.allowRemoteModels = true; // Fallback to HuggingFace CDN if local asset is missing
env.localModelPath = `${normalizedBase}models/`;
env.useBrowserCache = true;

let embedder: any = null;
const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';

async function getEmbedder(modelName = DEFAULT_MODEL): Promise<any> {
  if (!embedder) {
    self.postMessage({ type: 'STATUS', status: 'Model yükleniyor...', progress: 0 });
    embedder = await pipeline('feature-extraction', modelName, {
      quantized: true,
      progress_callback: (p: any) => {
        if (p && typeof p.progress === 'number') {
          self.postMessage({
            type: 'MODEL_DOWNLOAD_PROGRESS',
            file: p.file,
            progress: Math.round(p.progress),
          });
        }
      },
    });
    self.postMessage({ type: 'READY' });
  }
  return embedder;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, id, texts, text, modelName } = e.data;

  try {
    if (type === 'INIT') {
      await getEmbedder(modelName);
      self.postMessage({ type: 'INIT_DONE', id });
    } else if (type === 'EMBED_BATCH') {
      const model = await getEmbedder(modelName);
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i++) {
        const output = await model(texts[i], { pooling: 'mean', normalize: true });
        results.push(Array.from(output.data as Float32Array));
      }

      self.postMessage({ type: 'EMBED_BATCH_DONE', id, vectors: results });
    } else if (type === 'EMBED_QUERY') {
      const model = await getEmbedder(modelName);
      const output = await model(text, { pooling: 'mean', normalize: true });
      const vector = Array.from(output.data as Float32Array);

      self.postMessage({ type: 'EMBED_QUERY_DONE', id, vector });
    } else if (type === 'UNLOAD') {
      embedder = null;
      self.postMessage({ type: 'UNLOADED' });
    }
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', id, error: err?.message || String(err) });
  }
};
