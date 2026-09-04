/**
 * pdfQuoteFormatter.ts
 *
 * Cleans, de-hyphenates, and stitches arbitrary multi-line text selections
 * from PDF documents into fluid, beautifully formatted Markdown quote callouts.
 */

import i18n from '@/i18n';

export function formatPdfQuote(
  rawText: string,
  pageNum: number,
  pdfPath: string,
  lang?: string
): string {
  if (!rawText || !rawText.trim()) return '';

  const isEnglish = lang
    ? lang.startsWith('en')
    : Boolean(i18n?.language && i18n.language.startsWith('en'));

  const headerTitle = i18n?.t
    ? i18n.t('pdfQuoteCallout', {
        page: pageNum,
        defaultValue: isEnglish ? `Quote (Page ${pageNum})` : `Alıntı (Sayfa ${pageNum})`,
        lng: isEnglish ? 'en' : 'tr',
      })
    : isEnglish
    ? `Quote (Page ${pageNum})`
    : `Alıntı (Sayfa ${pageNum})`;

  // 1. Clean line endings and de-hyphenate line breaks (e.g. "imple-\nmented" -> "implemented")
  const cleaned = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\p{L}+)-\n(\p{L}+)/gu, '$1$2')
    .trim();

  // 2. Separate into logical paragraphs (preserving intentional double newlines)
  const rawParagraphs = cleaned.split(/\n{2,}/);
  const formattedParagraphs: string[] = [];

  for (const para of rawParagraphs) {
    const rawLines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length === 0) continue;

    const paragraphLines: string[] = [];
    let currentLine = '';

    for (const line of rawLines) {
      // Check if line represents a list item or bullet
      const isListItem = /^[-*•\d+.]\s+/.test(line);

      if (isListItem) {
        if (currentLine) {
          paragraphLines.push(currentLine);
          currentLine = '';
        }
        currentLine = line;
      } else {
        if (!currentLine) {
          currentLine = line;
        } else {
          // Stitch PDF line wrap into continuous sentence with space
          currentLine += ' ' + line;
        }
      }
    }

    if (currentLine) {
      paragraphLines.push(currentLine);
    }

    if (paragraphLines.length > 0) {
      formattedParagraphs.push(paragraphLines.join('\n'));
    }
  }

  // 3. Assemble into Markdown callout block where every line is prefixed with `> `
  const calloutLines: string[] = [];
  calloutLines.push(`> [!QUOTE] ${headerTitle}`);

  for (let i = 0; i < formattedParagraphs.length; i++) {
    const lines = formattedParagraphs[i].split('\n');
    for (const l of lines) {
      // Clean leading/trailing quotes if user selected quotation marks
      const cleanLine = l.replace(/^["'“‘]+|["'”’]+$/g, '').trim();
      calloutLines.push(`> "${cleanLine}"`);
    }

    // Add empty callout separator line between paragraphs
    if (i < formattedParagraphs.length - 1) {
      calloutLines.push('>');
    }
  }

  // 4. Append clean source citation inside the callout
  calloutLines.push('>');
  calloutLines.push(`> — [[${pdfPath}#page=${pageNum}]]`);

  return '\n' + calloutLines.join('\n') + '\n\n';
}
