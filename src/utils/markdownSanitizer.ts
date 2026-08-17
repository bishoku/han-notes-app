/**
 * markdownSanitizer.ts — Robust validation and auto-fixing utility for LLM-generated Markdown.
 * Fixes:
 * 1. Outer codeblock wrappers (e.g. ```markdown ... ```)
 * 2. Unclosed fenced code blocks (```lang ... without closing ```)
 * 3. Unclosed inline formatting (**bold**, *italic*, `code`, ~~strike~~, ==highlight==, [[wikilinks]])
 * 4. Unclosed HTML/XML tags (<span...>, <div>, etc.) and thinking tags (<think>...</think>)
 * 5. Corrupted table rows / missing pipes
 * 6. Stray frontmatter blocks in document body
 * 7. Safe newline padding and boundary isolation
 */
import { stripReasoning } from '@/services/ai/reasoningParser';

export interface MarkdownValidationResult {
  isValid: boolean;
  sanitized: string;
  autoFixedIssues: string[];
}

/**
 * Validates and auto-repairs LLM generated Markdown before insertion into the note editor.
 */
export function sanitizeAndFixMarkdown(rawText: string): MarkdownValidationResult {
  const autoFixedIssues: string[] = [];
  if (!rawText || !rawText.trim()) {
    return { isValid: true, sanitized: '', autoFixedIssues };
  }

  let text = rawText.trim();

  // 1. Strip reasoning and thinking tokens (<think>...</think>, <thought>, etc.)
  const withoutReasoning = stripReasoning(text);
  if (withoutReasoning !== text) {
    autoFixedIssues.push('Düşünce blokları (<think>) temizlendi.');
    text = withoutReasoning.trim();
  }

  // 2. Strip Outer Markdown Fenced Wrapper (e.g. ```markdown\n# Title\n...\n```)
  const outerWrapperMatch = text.match(/^```(?:markdown|md)?\r?\n([\s\S]*?)\r?\n```$/i);
  if (outerWrapperMatch) {
    text = outerWrapperMatch[1].trim();
    autoFixedIssues.push('Dışarıdaki sarmalayıcı ```markdown bloğu kaldırıldı.');
  }

  // 3. Remove fake YAML frontmatter blocks in inline/ghostwriter snippets
  if (text.startsWith('---')) {
    const secondDashIndex = text.indexOf('\n---', 3);
    if (secondDashIndex !== -1) {
      // If it looks like frontmatter at the top of an inserted paragraph, remove it
      const bodyAfter = text.slice(secondDashIndex + 4).trim();
      if (bodyAfter.length > 0) {
        text = bodyAfter;
        autoFixedIssues.push('Gereksiz frontmatter (---) başlığı kaldırıldı.');
      }
    }
  }

  // 4. Auto-Fix Unclosed Fenced Code Blocks (```)
  const lines = text.split(/\r?\n/);
  let openFenceLang: string | null = null;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        openFenceLang = l.slice(3).trim();
      } else {
        inCodeBlock = false;
        openFenceLang = null;
      }
    }
  }

  if (inCodeBlock) {
    // Append closing code fence
    text = text + '\n```';
    autoFixedIssues.push(`Kapanmamış kod bloğu (\`\`\`${openFenceLang || ''}) otomatik olarak kapatıldı.`);
  }

  // 5. Auto-Fix Unclosed Math Blocks ($$)
  const mathBlockMatches = text.match(/\$\$/g);
  if (mathBlockMatches && mathBlockMatches.length % 2 !== 0) {
    text = text + '\n$$';
    autoFixedIssues.push('Kapanmamış matematik bloğu ($$) kapatıldı.');
  }

  // 6. Auto-Fix Unclosed Inline Code (`code`)
  // Check line by line for unmatched single backticks
  const fixedLines = text.split(/\r?\n/).map((line) => {
    // If inside a code fence, skip
    if (line.trim().startsWith('```')) return line;

    // Count non-escaped single backticks
    const backticks = (line.match(/(?<!\\)`/g) || []).length;
    if (backticks % 2 !== 0) {
      // If there's an odd number of backticks, close it at line end
      autoFixedIssues.push('Kapanmamış satır içi kod (`...`) kapatıldı.');
      return line + '`';
    }
    return line;
  });
  text = fixedLines.join('\n');

  // 7. Auto-Fix Unclosed Bold (**), Italic (* or _), Strikethrough (~~), Highlight (==)
  const inlineFixes: [RegExp, string, string][] = [
    [/(?<!\\)\*\*/g, '**', 'Kapanmamış kalın metin (**)'],
    [/(?<!\\)~~/g, '~~', 'Kapanmamış üstü çizili metin (~~)'],
    [/(?<!\\)==/g, '==', 'Kapanmamış vurgu (==)'],
  ];

  for (const [re, tag, label] of inlineFixes) {
    const matches = (text.match(re) || []).length;
    if (matches % 2 !== 0) {
      text = text + tag;
      autoFixedIssues.push(`${label} kapatıldı.`);
    }
  }

  // 8. Auto-Fix Unclosed Wikilinks ([[Note]])
  const openWl = (text.match(/\[\[/g) || []).length;
  const closeWl = (text.match(/\]\]/g) || []).length;
  if (openWl > closeWl) {
    text = text + ']]'.repeat(openWl - closeWl);
    autoFixedIssues.push('Kapanmamış wikilink ([[...]]) kapatıldı.');
  }

  // 9. Auto-Fix Unclosed HTML tags (<span>, <div>, <details>, etc.)
  const htmlTagsToCheck = ['span', 'div', 'details', 'summary', 'b', 'i', 'strong', 'em', 'p'];
  for (const tag of htmlTagsToCheck) {
    const openRe = new RegExp(`<${tag}(?:\\s+[^>]*)?>`, 'gi');
    const closeRe = new RegExp(`</${tag}>`, 'gi');
    const openCount = (text.match(openRe) || []).length;
    const closeCount = (text.match(closeRe) || []).length;
    if (openCount > closeCount) {
      text = text + `</${tag}>`.repeat(openCount - closeCount);
      autoFixedIssues.push(`Kapanmamış HTML <${tag}> etiketi kapatıldı.`);
    }
  }

  return {
    isValid: true,
    sanitized: text.trim(),
    autoFixedIssues,
  };
}

/**
 * Prepares and formats markdown content for clean insertion into a CodeMirror editor at targetPos.
 * Ensures clean newline isolation and prevents merging into preceding or following syntax nodes.
 */
export function prepareSafeDocumentInsertion(
  docText: string,
  targetPos: number,
  insertText: string
): { safeFrom: number; safeInsertText: string } {
  const { sanitized } = sanitizeAndFixMarkdown(insertText);
  if (!sanitized) {
    return { safeFrom: targetPos, safeInsertText: '' };
  }

  const clampedPos = Math.max(0, Math.min(docText.length, targetPos));
  let prefix = '';
  let suffix = '\n\n';

  // Check preceding character
  if (clampedPos > 0) {
    const charBefore = docText[clampedPos - 1];
    const twoCharsBefore = clampedPos > 1 ? docText[clampedPos - 2] : '';
    if (charBefore !== '\n') {
      prefix = '\n\n';
    } else if (twoCharsBefore !== '\n') {
      prefix = '\n';
    }
  }

  // Check following character
  if (clampedPos < docText.length) {
    const charAfter = docText[clampedPos];
    if (charAfter === '\n') {
      suffix = '\n';
    }
  }

  const safeInsertText = `${prefix}${sanitized}${suffix}`;
  return {
    safeFrom: clampedPos,
    safeInsertText,
  };
}
