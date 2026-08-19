/**
 * NotePreviewPane.tsx — High-performance, memoized Markdown Note Previewer for Search.
 * Automatically scrolls to and highlights matched headings or snippets with in-memory caching.
 */
import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { marked, Renderer } from 'marked';
import { FileText, ArrowRight, Loader2 } from 'lucide-react';
import { storage } from '@/services/storage';

interface NotePreviewPaneProps {
  noteId: string | null;
  title?: string;
  path?: string;
  targetHeading?: string;
  targetSnippet?: string;
  matchedKeywords?: string[];
  lineNumber?: number;
  onOpenNote?: (noteId: string) => void;
}

// In-memory cache for loaded note content and parsed HTML to guarantee 0ms instant preview switches
const previewContentCache = new Map<string, string>();
const parsedHtmlCache = new Map<string, string>();

const customPreviewRenderer = new Renderer();
customPreviewRenderer.table = function (token: any) {
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

function normalizeText(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '').trim();
}

export const NotePreviewPane: React.FC<NotePreviewPaneProps> = memo(({
  noteId,
  title,
  path,
  targetHeading,
  targetSnippet,
  matchedKeywords,
  onOpenNote,
}) => {
  const { t } = useTranslation();
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const [content, setContent] = useState<string>(() => {
    return noteId && previewContentCache.has(noteId) ? previewContentCache.get(noteId)! : '';
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !!noteId && !previewContentCache.has(noteId);
  });

  useEffect(() => {
    if (!noteId) {
      setContent('');
      setIsLoading(false);
      return;
    }

    if (previewContentCache.has(noteId)) {
      setContent(previewContentCache.get(noteId)!);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);

    storage
      .readNote(noteId)
      .then((raw) => {
        previewContentCache.set(noteId, raw);
        if (isCurrent) {
          setContent(raw);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isCurrent) {
          setContent(`Not içeriği yüklenemedi: ${err.message}`);
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [noteId]);

  const html = useMemo(() => {
    if (!content) return '';
    if (parsedHtmlCache.has(content)) {
      return parsedHtmlCache.get(content)!;
    }
    try {
      const parsed = marked.parse(content, {
        renderer: customPreviewRenderer,
        gfm: true,
        breaks: true,
      }) as string;
      parsedHtmlCache.set(content, parsed);
      return parsed;
    } catch {
      return content;
    }
  }, [content]);

  // Auto-scroll to matched section heading or snippet
  useEffect(() => {
    if (!contentContainerRef.current || !html || isLoading) return;

    const timer = setTimeout(() => {
      const container = contentContainerRef.current;
      if (!container) return;

      // 1. Try matching by Heading text (H1 - H6)
      if (targetHeading) {
        const cleanTarget = normalizeText(targetHeading);
        const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (const h of Array.from(headings)) {
          const cleanH = normalizeText(h.textContent || '');
          if (cleanH && (cleanH === cleanTarget || cleanH.includes(cleanTarget) || cleanTarget.includes(cleanH))) {
            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
            h.classList.add('bg-purple-500/20', 'dark:bg-purple-500/30', 'rounded-lg', 'px-2', 'py-1', 'transition-all');
            setTimeout(() => {
              h.classList.remove('bg-purple-500/20', 'dark:bg-purple-500/30', 'px-2', 'py-1');
            }, 2000);
            return;
          }
        }
      }

      // 2. Try matching by snippet keywords
      const firstKeyword = matchedKeywords && matchedKeywords.length > 0 ? matchedKeywords[0] : '';
      const snippetSample = targetSnippet ? targetSnippet.slice(0, 40).trim() : '';

      if (snippetSample || firstKeyword) {
        const elements = container.querySelectorAll('p, li, blockquote, pre');
        for (const el of Array.from(elements)) {
          const text = el.textContent || '';
          if (
            (snippetSample && text.includes(snippetSample)) ||
            (firstKeyword && text.toLowerCase().includes(firstKeyword.toLowerCase()))
          ) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('bg-purple-500/15', 'dark:bg-purple-500/25', 'rounded-lg', 'p-1.5', 'transition-all');
            setTimeout(() => {
              el.classList.remove('bg-purple-500/15', 'dark:bg-purple-500/25', 'p-1.5');
            }, 2000);
            return;
          }
        }
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [noteId, targetHeading, targetSnippet, matchedKeywords, html, isLoading]);

  if (!noteId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
        <FileText size={24} className="mb-2 opacity-50" />
        <p className="text-xs">{t('searchPreviewPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-text">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-mac-borderLight dark:border-mac-borderDark shrink-0">
        <div className="flex flex-col min-w-0 pr-2">
          <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
            {title || noteId.split('/').pop() || noteId}
          </h3>
          <span className="text-[10px] text-gray-400 font-mono truncate">
            {path || noteId}
          </span>
        </div>

        {onOpenNote && (
          <button
            onClick={() => onOpenNote(noteId)}
            className="px-3 py-1.5 rounded-xl bg-mac-accent hover:opacity-90 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
          >
            <span>{t('searchHintOpen')}</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* Content */}
      <div ref={contentContainerRef} className="flex-1 overflow-y-auto pt-3 pr-1 scroll-smooth">
        {isLoading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-gray-400">
            <Loader2 size={14} className="animate-spin text-mac-accent" />
            <span className="text-xs">Yükleniyor...</span>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
});

NotePreviewPane.displayName = 'NotePreviewPane';
