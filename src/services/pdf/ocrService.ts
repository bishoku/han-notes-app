/**
 * ocrService.ts — 100% Local offline OCR engine for scanned PDF documents.
 * Extracts high-accuracy text from scanned pages using Tesseract WASM in a background worker.
 */
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

export interface OcrProgressInfo {
  page: number;
  totalPages: number;
  status: string;
  percent: number;
}

export type OcrProgressCallback = (info: OcrProgressInfo) => void;

/**
 * Performs local optical character recognition on scanned PDF pages.
 */
export async function performLocalOcrOnPdf(
  buffer: ArrayBuffer,
  onProgress?: OcrProgressCallback
): Promise<Array<{ pageNumber: number; text: string }>> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer.slice(0)),
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;
  const numPages = doc.numPages;

  onProgress?.({
    page: 1,
    totalPages: numPages,
    status: 'OCR motoru hazırlanıyor...',
    percent: 0,
  });

  let worker: any = null;

  try {
    // Initialize multilingual worker (Turkish + English)
    worker = await createWorker(['tur', 'eng']);
  } catch (initErr) {
    console.warn('Failed to load tur+eng dictionary, falling back to eng:', initErr);
    try {
      worker = await createWorker('eng');
    } catch (fallbackErr) {
      console.error('OCR worker init failed:', fallbackErr);
      throw new Error('Yerel OCR motoru başlatılamadı.');
    }
  }

  const results: Array<{ pageNumber: number; text: string }> = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.({
      page: pageNum,
      totalPages: numPages,
      status: `Sayfa ${pageNum}/${numPages} optik taranıyor...`,
      percent: Math.round(((pageNum - 0.5) / numPages) * 100),
    });

    const page = await doc.getPage(pageNum);
    // 2.0x scale provides optimal DPI for high accuracy text recognition
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      try {
        const { data } = await worker.recognize(canvas);
        results.push({
          pageNumber: pageNum,
          text: (data?.text || '').trim(),
        });
      } catch (recErr) {
        console.warn(`OCR error on page ${pageNum}:`, recErr);
        results.push({ pageNumber: pageNum, text: '' });
      }
    } else {
      results.push({ pageNumber: pageNum, text: '' });
    }
  }

  onProgress?.({
    page: numPages,
    totalPages: numPages,
    status: 'OCR tamamlandı.',
    percent: 100,
  });

  if (worker) {
    await worker.terminate();
  }

  return results;
}
