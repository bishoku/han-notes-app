/**
 * chunker.ts — Semantic Markdown Chunker with Heading Hierarchy & Hash Tracking.
 */
import type { VectorChunk } from './types';

/**
 * Fast 32-bit FNV-1a non-cryptographic hash for quick chunk content diffing.
 */
export function fastHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Strips YAML frontmatter from markdown.
 */
function stripFrontmatter(content: string): string {
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) {
      return content.slice(end + 3).trim();
    }
  }
  return content;
}

/**
 * Splits a markdown note into logical semantic chunks based on headings and block boundaries.
 * Max chunk target: ~300-500 words / 1500 characters.
 */
export function chunkMarkdownNote(
  noteId: string,
  noteTitle: string,
  rawContent: string
): VectorChunk[] {
  const content = stripFrontmatter(rawContent);
  if (!content.trim()) {
    return [];
  }

  const lines = content.split('\n');
  const chunks: VectorChunk[] = [];

  let currentHeading = noteTitle;
  let currentBuffer: string[] = [];
  let chunkIndex = 0;

  const flushBuffer = () => {
    const text = currentBuffer.join('\n').trim();
    if (text.length > 20) {
      // Include title and heading breadcrumb for rich contextual embedding
      const contextualText = currentHeading !== noteTitle
        ? `[${noteTitle} > ${currentHeading}]\n${text}`
        : `[${noteTitle}]\n${text}`;

      chunks.push({
        id: `${noteId}#chunk-${chunkIndex++}`,
        noteId,
        title: noteTitle,
        heading: currentHeading,
        content: contextualText,
        hash: fastHash(contextualText),
      });
    }
    currentBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);

    if (headingMatch) {
      // Heading encountered: flush previous block and update current heading
      flushBuffer();
      currentHeading = headingMatch[2].trim();
      currentBuffer.push(line);
    } else if (line.trim() === '---' || line.trim() === '***') {
      // Horizontal rule: natural semantic split
      flushBuffer();
    } else {
      currentBuffer.push(line);

      // If buffer exceeds ~1200 characters and we are at an empty line or paragraph break
      const currentLength = currentBuffer.reduce((acc, l) => acc + l.length + 1, 0);
      if (currentLength > 1200 && line.trim() === '') {
        flushBuffer();
      }
    }
  }

  // Flush remaining buffer
  flushBuffer();

  return chunks;
}
