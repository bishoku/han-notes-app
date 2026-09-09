/**
 * pngMetadata.ts — PNG metadata injection & extraction utilities.
 *
 * Powered by yada-preview library with full backward compatibility
 * for YADA diagrams and Excalidraw sketches across HAN notes app.
 */
import {
  extractPngMetadata as yadaExtractPngMetadata,
  injectPngMetadata,
  resolveBinaryBytes,
  createTextChunk,
  calculateCrc32,
  DEFAULT_YADA_KEYWORD,
} from 'yada-preview';

export {
  injectPngMetadata,
  resolveBinaryBytes,
  createTextChunk,
  calculateCrc32,
  DEFAULT_YADA_KEYWORD as YADA_METADATA_KEYWORD,
};

export const EXCALIDRAW_METADATA_KEYWORD = 'EXCALIDRAW_SKETCH';

/**
 * Extracts and decodes JSON metadata embedded within a PNG buffer.
 * Supports generic payload types (YADA diagrams, Excalidraw sketches, custom metadata).
 */
export function extractPngMetadata<T = any>(
  pngData: ArrayBufferLike | Uint8Array,
  targetKeyword: string = DEFAULT_YADA_KEYWORD
): T | null {
  return yadaExtractPngMetadata(pngData, targetKeyword) as T | null;
}
