/**
 * MarkdownMessage.tsx — Rich Markdown renderer for AI chat messages.
 * Contains isolated horizontal scrolling for tables and code blocks so chat layout never breaks.
 */
import React, { useMemo } from 'react';
import { marked, Renderer } from 'marked';

interface MarkdownMessageProps {
  content: string;
  isStreaming?: boolean;
}

// Custom renderer to ensure tables are always wrapped in a self-contained horizontally-scrollable box
const customRenderer = new Renderer();

customRenderer.table = function (token: any) {
  // marked v12+ token format or legacy string format
  let headerHtml = '';
  let bodyHtml = '';

  if (typeof token === 'object' && token.header && token.rows) {
    headerHtml = `<thead><tr>${token.header
      .map(
        (cell: any) =>
          `<th class="px-3 py-2 text-left text-[11px] font-bold text-gray-900 dark:text-gray-100 bg-black/5 dark:bg-white/5 border-b border-gray-200 dark:border-zinc-700 whitespace-nowrap">${cell.text}</th>`
      )
      .join('')}</tr></thead>`;

    bodyHtml = `<tbody>${token.rows
      .map(
        (row: any) =>
          `<tr class="border-b border-gray-100 dark:border-zinc-800/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">${row
            .map(
              (cell: any) =>
                `<td class="px-3 py-2 text-left text-[11px] text-gray-800 dark:text-gray-200 whitespace-normal min-w-[90px] max-w-[200px] break-words">${cell.text}</td>`
            )
            .join('')}</tr>`
      )
      .join('')}</tbody>`;
  }

  const tableInner = headerHtml ? `${headerHtml}${bodyHtml}` : '';

  return `<div class="my-2.5 max-w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-700/80 bg-white/60 dark:bg-zinc-900/60 shadow-2xs"><table class="w-full text-xs text-left border-collapse min-w-full">${tableInner}</table></div>`;
};

// Configure marked options with custom renderer
marked.use({
  renderer: customRenderer,
  gfm: true,
  breaks: true,
});

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, isStreaming }) => {
  const html = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content) as string;
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div className="relative text-xs leading-relaxed break-words ai-markdown-content select-text w-full min-w-0 max-w-full overflow-hidden">
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        className="prose prose-xs dark:prose-invert max-w-none 
          prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-headings:my-2
          prose-h1:text-sm prose-h2:text-xs prose-h3:text-xs
          prose-p:my-1.5 prose-p:leading-relaxed
          prose-ul:my-1.5 prose-ul:pl-4 prose-ul:list-disc
          prose-ol:my-1.5 prose-ol:pl-4 prose-ol:list-decimal
          prose-li:my-0.5
          prose-blockquote:border-l-2 prose-blockquote:border-mac-accent/60 prose-blockquote:pl-3 prose-blockquote:my-2 prose-blockquote:italic prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-300
          prose-strong:font-bold prose-strong:text-gray-900 dark:prose-strong:text-gray-100
          prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-black/5 dark:prose-code:bg-white/10 prose-code:font-mono prose-code:text-[11px] prose-code:before:content-none prose-code:after:content-none
          prose-pre:p-3 prose-pre:rounded-xl prose-pre:bg-zinc-900 dark:prose-pre:bg-black/80 prose-pre:text-zinc-100 prose-pre:font-mono prose-pre:text-[11px] prose-pre:my-2 prose-pre:max-w-full prose-pre:overflow-x-auto"
      />
      {isStreaming && (
        <span className="inline-block w-1.5 h-3 ml-1 bg-mac-accent animate-pulse align-middle" />
      )}
    </div>
  );
};
