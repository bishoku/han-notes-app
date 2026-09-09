/**
 * pngMetadata.ts — PNG metadata injection & extraction utilities.
 *
 * Powered by yada-preview library with full backward compatibility
 * for YADA diagrams and Excalidraw sketches across HAN notes app.
 */
export {
  injectPngMetadata,
  extractPngMetadata,
  resolveBinaryBytes,
  createTextChunk,
  calculateCrc32,
  DEFAULT_YADA_KEYWORD as YADA_METADATA_KEYWORD,
} from 'yada-preview';

export const EXCALIDRAW_METADATA_KEYWORD = 'EXCALIDRAW_SKETCH';
