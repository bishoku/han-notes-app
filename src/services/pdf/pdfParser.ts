/**
 * pdfParser.ts — High-fidelity client-side PDF parsing & structured Markdown converter.
 * Runs 100% locally via pdfjs-dist with spatial layout heuristics (headings, 2-column detection, paragraph stitching).
 */

import * as pdfjsLib from 'pdfjs-dist';
// Vite URL worker import
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { wasm_process_pdf_page_layout } from '@/wasm/han-core/han_core';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PdfPageData {
  pageNumber: number;
  text: string;
  markdown: string;
}

export interface ParsedPdfResult {
  title: string;
  author?: string;
  pageCount: number;
  isScanned: boolean;
  totalCharacters: number;
  structuredMarkdown: string;
  pages: PdfPageData[];
}

interface TextItemWithPos {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Parses an ArrayBuffer representing a PDF document and extracts structured Markdown.
 */
export async function parsePdfDocument(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ParsedPdfResult> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer.slice(0)),
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;

  let docTitle = fileName.replace(/\.md$/, '').replace(/\.pdf$/i, '');
  let docAuthor: string | undefined;

  try {
    const metadata = await doc.getMetadata();
    const info = metadata?.info as any;
    if (info?.Title && typeof info.Title === 'string' && info.Title.trim().length > 1) {
      docTitle = info.Title.trim();
    }
    if (info?.Author && typeof info.Author === 'string') {
      docAuthor = info.Author.trim();
    }
  } catch {
    // Fallback to filename
  }

  const pages: PdfPageData[] = [];
  let totalChars = 0;
  const allFontSizes: number[] = [];

  // 1. Pass 1: Extract items and collect font size statistics
  const rawPagesData: Array<{ pageNumber: number; items: TextItemWithPos[]; width: number; height: number }> = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const content = await page.getTextContent();

    const items: TextItemWithPos[] = [];

    for (const item of content.items as any[]) {
      if (!item.str || item.str.trim().length === 0) continue;
      const tx = item.transform; // [scaleX, skewY, skewX, scaleY, x, y]
      const fontSize = Math.abs(tx[0]) || Math.abs(tx[3]) || item.height || 12;
      const x = tx[4];
      const y = tx[5];

      allFontSizes.push(fontSize);
      totalChars += item.str.length;

      items.push({
        str: item.str,
        x,
        y,
        width: item.width || 0,
        height: fontSize,
      });
    }

    rawPagesData.push({
      pageNumber: pageNum,
      items,
      width: viewport.width,
      height: viewport.height,
    });
  }

  // Calculate median body font size
  allFontSizes.sort((a, b) => a - b);
  const medianFontSize = allFontSizes.length > 0 ? allFontSizes[Math.floor(allFontSizes.length / 2)] : 12;

  // 2. Pass 2: Layout analysis & Markdown synthesis per page
  const markdownPages: string[] = [];

  for (const pageData of rawPagesData) {
    let pageMarkdown = '';
    try {
      const itemsJson = JSON.stringify(pageData.items);
      const rustResult = wasm_process_pdf_page_layout(itemsJson, pageData.width, pageData.height, medianFontSize);
      if (rustResult && rustResult.trim().length > 0) {
        pageMarkdown = rustResult;
      }
    } catch {
      // Fallback to JS layout engine
    }

    if (!pageMarkdown) {
      pageMarkdown = processPageLayout(pageData.items, pageData.width, pageData.height, medianFontSize);
    }

    pages.push({
      pageNumber: pageData.pageNumber,
      text: pageData.items.map((i) => i.str).join(' '),
      markdown: pageMarkdown,
    });
    markdownPages.push(`<!-- sayfa:${pageData.pageNumber} -->\n${pageMarkdown}`);
  }

  // Scanned detection: If document averages fewer than 80 chars per page, it's likely a scan/image
  const isScanned = totalChars < Math.max(50, pageCount * 40);

  const fullMarkdown = `# ${docTitle}\n\n` +
    (docAuthor ? `*Yazar / Kaynak: ${docAuthor}*\n\n` : '') +
    markdownPages.join('\n\n---\n\n');

  return {
    title: docTitle,
    author: docAuthor,
    pageCount,
    isScanned,
    totalCharacters: totalChars,
    structuredMarkdown: fullMarkdown,
    pages,
  };
}

/**
 * Heuristic 2-column detection, heading hierarchy, and paragraph merging for a single page.
 */
function processPageLayout(
  items: TextItemWithPos[],
  pageWidth: number,
  _pageHeight: number,
  bodyFontSize: number
): string {
  if (items.length === 0) return '';

  // Check for 2-column layout (e.g. ArXiv, IEEE, ACM papers)
  // Determine if there's a strong split around x = pageWidth * 0.45 .. 0.55
  const midX = pageWidth / 2;
  const leftItems: TextItemWithPos[] = [];
  const rightItems: TextItemWithPos[] = [];
  let isTwoColumn = false;

  const leftCount = items.filter((i) => i.x + i.width < midX).length;
  const rightCount = items.filter((i) => i.x > midX * 0.9).length;

  if (items.length > 15 && leftCount > items.length * 0.3 && rightCount > items.length * 0.3) {
    isTwoColumn = true;
  }

  let orderedItems: TextItemWithPos[];

  if (isTwoColumn) {
    // Separate into left and right columns
    for (const item of items) {
      if (item.x + item.width / 2 < midX) {
        leftItems.push(item);
      } else {
        rightItems.push(item);
      }
    }
    // Sort each column top-to-bottom (y descending in PDF coordinate space)
    leftItems.sort((a, b) => b.y - a.y || a.x - b.x);
    rightItems.sort((a, b) => b.y - a.y || a.x - b.x);
    orderedItems = [...leftItems, ...rightItems];
  } else {
    // Single column: sort top-to-bottom
    orderedItems = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  }

  // 3. Group lines and detect headings vs body paragraphs
  const lines: Array<{ text: string; fontSize: number; isHeading: boolean; headingLevel: number }> = [];

  let currentLineText = '';
  let currentY = -1;
  let currentFontSize = bodyFontSize;

  for (const item of orderedItems) {
    if (currentY === -1) {
      currentY = item.y;
      currentLineText = item.str;
      currentFontSize = item.height;
      continue;
    }

    // Same horizontal line if y difference is small (within half font height)
    if (Math.abs(item.y - currentY) < currentFontSize * 0.6) {
      currentLineText += ' ' + item.str;
      currentFontSize = Math.max(currentFontSize, item.height);
    } else {
      // Commit previous line
      pushLine(lines, currentLineText.trim(), currentFontSize, bodyFontSize);
      currentY = item.y;
      currentLineText = item.str;
      currentFontSize = item.height;
    }
  }

  if (currentLineText.trim().length > 0) {
    pushLine(lines, currentLineText.trim(), currentFontSize, bodyFontSize);
  }

  // 4. Merge broken paragraph lines
  return stitchParagraphs(lines);
}

function pushLine(
  lines: Array<{ text: string; fontSize: number; isHeading: boolean; headingLevel: number }>,
  text: string,
  fontSize: number,
  bodyFontSize: number
) {
  if (!text) return;

  // Filter out standalone page numbers (e.g. "12", "- 12 -")
  if (/^[-—–]?\s*\d+\s*[-—–]?$/.test(text)) {
    return;
  }

  let isHeading = false;
  let headingLevel = 0;

  if (fontSize >= bodyFontSize * 1.45) {
    isHeading = true;
    headingLevel = 1;
  } else if (fontSize >= bodyFontSize * 1.25) {
    isHeading = true;
    headingLevel = 2;
  } else if (fontSize >= bodyFontSize * 1.1) {
    isHeading = true;
    headingLevel = 3;
  }

  lines.push({ text, fontSize, isHeading, headingLevel });
}

function stitchParagraphs(
  lines: Array<{ text: string; fontSize: number; isHeading: boolean; headingLevel: number }>
): string {
  const outputBlocks: string[] = [];
  let currentParagraph = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.isHeading) {
      if (currentParagraph) {
        outputBlocks.push(currentParagraph.trim());
        currentParagraph = '';
      }
      const prefix = '#'.repeat(Math.min(4, line.headingLevel + 1));
      outputBlocks.push(`${prefix} ${line.text}`);
      continue;
    }

    // Bullet points
    if (/^[•–—*]\s+/.test(line.text) || /^\d+[.)]\s+/.test(line.text)) {
      if (currentParagraph) {
        outputBlocks.push(currentParagraph.trim());
        currentParagraph = '';
      }
      const formatted = line.text.replace(/^[•–—*]\s+/, '- ');
      outputBlocks.push(formatted);
      continue;
    }

    // De-hyphenation (e.g. "com- / puter" -> "computer")
    if (currentParagraph.endsWith('-')) {
      currentParagraph = currentParagraph.slice(0, -1) + line.text;
    } else if (currentParagraph) {
      // Connect lines with space if current line does not end with sentence break
      currentParagraph += ' ' + line.text;
    } else {
      currentParagraph = line.text;
    }

    // Sentence break ends paragraph
    if (line.text.endsWith('.') || line.text.endsWith(':') || line.text.endsWith('!')) {
      outputBlocks.push(currentParagraph.trim());
      currentParagraph = '';
    }
  }

  if (currentParagraph) {
    outputBlocks.push(currentParagraph.trim());
  }

  return outputBlocks.join('\n\n');
}
