/**
 * MarkdownMessage.tsx — Rich Markdown renderer for AI chat messages.
 * Integrates ThinkingBlock for reasoning, guarantees clean content rendering,
 * and renders interactive citation badges ([1], [2]) linking to vault notes.
 */
import React, { useMemo } from 'react';
import { marked, Renderer } from 'marked';
import { ThinkingBlock } from './ThinkingBlock';
import { stripReasoning } from '@/services/ai/reasoningParser';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import type { Citation } from '@/services/ai/types';

interface MarkdownMessageProps {
  content: string;
  reasoning?: string;
  thinkingTimeMs?: number;
  isThinking?: boolean;
  isStreaming?: boolean;
  citations?: Citation[];
  onCitationClick?: (noteId: string) => void;
}

// Custom renderer to ensure tables are always wrapped in a self-contained horizontally-scrollable box
const customRenderer = new Renderer();

customRenderer.table = function (token: any) {
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  content,
  reasoning,
  thinkingTimeMs,
  isThinking,
  isStreaming,
  citations,
  onCitationClick,
}) => {
  // Strip any residual thinking tags from final content
  const cleanContent = useMemo(() => {
    return stripReasoning(content);
  }, [content]);

  // Preprocess text to convert citation numbers and wikilinks to interactive HTML elements
  const processedMarkdown = useMemo(() => {
    if (!cleanContent) return '';
    let text = cleanContent;

    // 1. Convert [[1]], [[2]] or [[Kaynak 1]] to citation buttons
    text = text.replace(/\[\[(?:Kaynak|Source)?\s*(\d+)\]\]/gi, (_match, p1) => {
      const idx = parseInt(p1, 10);
      const citation = citations && citations[idx - 1];
      const noteId = citation ? citation.noteId : '';
      const tooltip = citation ? `${citation.title}${citation.heading ? ` > ${citation.heading}` : ''}` : `Kaynak ${idx}`;
      return `<button type="button" class="ai-citation-pill" data-citation-idx="${idx}" data-note-id="${escapeHtml(noteId)}" title="${escapeHtml(tooltip)}">[${idx}]</button>`;
    });

    // 2. Convert [1], [2], [Kaynak 1], [Source 1] (not followed by '(') to citation buttons
    text = text.replace(/\[(?:Kaynak|Source)?\s*(\d+)\](?!\()/gi, (_match, p1) => {
      const idx = parseInt(p1, 10);
      const citation = citations && citations[idx - 1];
      const noteId = citation ? citation.noteId : '';
      const tooltip = citation ? `${citation.title}${citation.heading ? ` > ${citation.heading}` : ''}` : `Kaynak ${idx}`;
      return `<button type="button" class="ai-citation-pill" data-citation-idx="${idx}" data-note-id="${escapeHtml(noteId)}" title="${escapeHtml(tooltip)}">[${idx}]</button>`;
    });

    // 3. Convert [[Note Title]] or [[Note Title|Display]] to interactive wikilinks
    text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, p1, p2) => {
      const target = p1.trim();
      const display = (p2 || target).trim();
      return `<a href="#" class="ai-wikilink" data-wikilink="${escapeHtml(target)}">[[${escapeHtml(display)}]]</a>`;
    });

    return text;
  }, [cleanContent, citations]);

  const html = useMemo(() => {
    if (!processedMarkdown) return '';
    try {
      return marked.parse(processedMarkdown) as string;
    } catch {
      return processedMarkdown;
    }
  }, [processedMarkdown]);

  // Delegated click handler for citation pills & wikilinks inside AI response
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // 1. Handle clicking on [1], [2] Citation Pill
    const citationBtn = target.closest('.ai-citation-pill') as HTMLElement | null;
    if (citationBtn) {
      e.preventDefault();
      e.stopPropagation();
      const noteId = citationBtn.getAttribute('data-note-id');
      const idxStr = citationBtn.getAttribute('data-citation-idx');

      if (noteId && onCitationClick) {
        onCitationClick(noteId);
      } else if (idxStr && citations && onCitationClick) {
        const idx = parseInt(idxStr, 10);
        if (idx > 0 && idx <= citations.length) {
          onCitationClick(citations[idx - 1].noteId);
        }
      }
      return;
    }

    // 2. Handle clicking on Wikilinks [[Note Title]] in AI response
    const wikilinkEl = target.closest('.ai-wikilink') as HTMLElement | null;
    if (wikilinkEl) {
      e.preventDefault();
      e.stopPropagation();
      const targetTitle = wikilinkEl.getAttribute('data-wikilink');
      if (targetTitle) {
        const { notes, selectNote, createNote } = useNoteStore.getState();
        const targetNote = notes.find(
          (n) =>
            n.id.toLowerCase() === targetTitle.toLowerCase() ||
            n.title.toLowerCase() === targetTitle.toLowerCase() ||
            n.id.toLowerCase().endsWith(`/${targetTitle.toLowerCase()}`) ||
            n.id.toLowerCase().endsWith(`/${targetTitle.toLowerCase()}.md`)
        );
        if (targetNote) {
          selectNote(targetNote.id);
        } else {
          createNote(targetTitle);
        }
        useUiStore.getState().setViewMode('notes');
      }
      return;
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className="relative text-xs leading-relaxed break-words ai-markdown-content select-text w-full min-w-0 max-w-full overflow-hidden"
    >
      {/* Antigravity / DeepSeek Style Collapsible Thinking Block */}
      {(reasoning || isThinking) && (
        <ThinkingBlock
          reasoning={reasoning}
          thinkingTimeMs={thinkingTimeMs}
          isThinking={isThinking}
        />
      )}

      {/* Clean Response Body with Interactive Citations & Wikilinks */}
      {html ? (
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
      ) : null}

      {isStreaming && !isThinking && (
        <span className="inline-block w-1.5 h-3 ml-1 bg-mac-accent animate-pulse align-middle" />
      )}
    </div>
  );
};
