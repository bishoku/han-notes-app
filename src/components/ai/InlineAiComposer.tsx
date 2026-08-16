/**
 * InlineAiComposer.tsx — Interactive inline AI Ghostwriter / Paragraph Generator Modal.
 * Opens as a focused, centered modal with full RAG context to generate paragraphs,
 * task lists, decision drafts, or tables to be inserted directly at the target line.
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAiStore } from '@/store/aiStore';
import { ragService } from '@/services/ai/ragService';
import { MarkdownMessage } from './MarkdownMessage';
import {
  Bot,
  Sparkles,
  Square,
  RotateCcw,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export interface InlineAiSurroundingContext {
  noteId: string;
  noteTitle: string;
  beforeText: string;
  afterText: string;
}

interface InlineAiComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertMarkdown: (text: string) => void;
  surroundingContext?: InlineAiSurroundingContext;
}

export const InlineAiComposer: React.FC<InlineAiComposerProps> = ({
  isOpen,
  onClose,
  onInsertMarkdown,
  surroundingContext,
}) => {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { settings } = useAiStore();

  const [prompt, setPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Focus textarea on open
  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setGeneratedText('');
      setError(null);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isStreaming) {
          handleStop();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isStreaming, onClose]);

  if (!isOpen) return null;

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleGenerate = async (customPrompt?: string) => {
    const targetPrompt = customPrompt || prompt;
    if (!targetPrompt.trim() || isStreaming) return;

    setError(null);
    setGeneratedText('');
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Build specialized Ghostwriter prompt with local document context
      const docContext = surroundingContext
        ? isEnglish
          ? `DOCUMENT CONTEXT:\nActive Note Title: "${surroundingContext.noteTitle}"\nPreceding Text in Note:\n${surroundingContext.beforeText.slice(-1000)}\n\nSubsequent Text in Note:\n${surroundingContext.afterText.slice(0, 1000)}\n`
          : `DOKÜMAN BAĞLAMI:\nNot Başlığı: "${surroundingContext.noteTitle}"\nNotta Öncesinde Yer Alan Metin:\n${surroundingContext.beforeText.slice(-1000)}\n\nNotta Sonrasında Yer Alan Metin:\n${surroundingContext.afterText.slice(0, 1000)}\n`
        : '';

      const ghostwriterSystemPrompt = isEnglish
        ? `You are the HAN AI Ghostwriter. The user is writing a document and requests content to be inserted at a specific line position in their note.\n${docContext}\nCRITICAL INSTRUCTION: Output ONLY the exact Markdown content to be inserted directly into the document. Do NOT write conversational greetings or pleasantries like "Sure! Here is the paragraph:". Start directly with the markdown text (paragraphs, bullet lists, headers, tables, etc.).`
        : `Sen HAN Not Defteri Yapay Zeka Yazıcısısın (Ghostwriter). Kullanıcı dokümanın arasına yeni bir içerik eklemek istiyor.\n${docContext}\nKRİTİK TALİMAT: Yalnızca doğrudan dokümana eklenebilecek saf Markdown içeriği üret. Başında veya sonunda "İşte istediğiniz paragraf:" gibi sohbet cümleleri ASLA kurma. Doğrudan biçimlendirilmiş markdown metnini (paragraflar, maddeler, başlıklar, tablolar) üret.`;

      let accumulated = '';
      const activeContext = surroundingContext
        ? {
            id: surroundingContext.noteId,
            title: surroundingContext.noteTitle,
            content: `${surroundingContext.beforeText}\n${surroundingContext.afterText}`,
          }
        : undefined;

      const overrideSettings = {
        ...settings,
        systemPrompt: ghostwriterSystemPrompt,
      };

      await ragService.query(
        targetPrompt,
        overrideSettings,
        [],
        activeContext,
        undefined,
        (chunk: string) => {
          accumulated += chunk;
          setGeneratedText(accumulated);
        },
        abortController.signal
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Inline AI generation error:', err);
        setError(err.message || 'Üretim sırasında bir hata oluştu.');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleApply = () => {
    if (!generatedText.trim()) return;
    onInsertMarkdown(generatedText);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (generatedText && !isStreaming) {
        handleApply();
      } else {
        handleGenerate();
      }
    }
  };

  const quickChips = [
    { label: t('aiInlineChipExplain'), prompt: isEnglish ? 'Explain and elaborate on this topic with clear, structured paragraphs.' : 'Bu konuyu detaylıca açıkla ve paragraflarla detaylandır.' },
    { label: t('aiInlineChipTodos'), prompt: isEnglish ? 'Generate an actionable checklist (- [ ] task) for this section.' : 'Bu bölüm için aksiyona dönüştürülebilir bir yapılacaklar listesi (- [ ]) çıkar.' },
    { label: t('aiInlineChipDecision'), prompt: isEnglish ? 'Draft a decision record (- [D] decision) with context and rationales.' : 'Bu konuyla ilgili gerekçeleriyle birlikte bir karar kaydı taslağı (- [D]) oluştur.' },
    { label: t('aiInlineChipTable'), prompt: isEnglish ? 'Create a structured comparison markdown table summarizing the key aspects.' : 'Konuyu özetleyen ve karşılaştıran düzenli bir Markdown tablosu oluştur.' },
    { label: t('aiInlineChipSummary'), prompt: isEnglish ? 'Summarize the key takeaways and conclusions as concise bullet points.' : 'Temel çıkarımları ve özet maddelerini listele.' },
  ];

  return createPortal(
    <div
      onClick={(e) => {
        if (!isStreaming && e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        ref={containerRef}
        className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 select-none text-xs"
      >
        {/* 1. Header */}
        <div className="p-3.5 px-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-mac-accent/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-mac-accent text-white shadow-xs">
              <Bot size={16} />
            </div>
            <div>
              <span className="font-bold text-xs text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <span>{t('aiInlineTitle')}</span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-purple-500/20 text-purple-600 dark:text-purple-400 font-semibold font-mono">
                  {settings.model || settings.provider}
                </span>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 2. Prompt Input & Action Chips */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-start gap-2 bg-gray-50/80 dark:bg-zinc-800/80 p-2.5 rounded-xl border border-gray-200/80 dark:border-zinc-700/80 focus-within:ring-2 focus-within:ring-purple-500/30 focus-within:border-purple-500 transition-all">
            <textarea
              ref={textareaRef}
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('aiInlinePlaceholder')}
              className="w-full resize-none bg-transparent outline-none text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 leading-relaxed py-0.5"
            />

            {isStreaming ? (
              <button
                onClick={handleStop}
                className="p-2 rounded-xl bg-red-500 hover:bg-red-600 text-white shrink-0 shadow-xs cursor-pointer"
                title="Durdur"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => handleGenerate()}
                disabled={!prompt.trim()}
                className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white shrink-0 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-xs cursor-pointer flex items-center gap-1"
                title={t('aiInlineGenerate')}
              >
                <Sparkles size={13} />
              </button>
            )}
          </div>

          {/* Quick Suggestion Chips (if not generated yet) */}
          {!generatedText && !isStreaming && (
            <div className="flex flex-wrap gap-1.5">
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(chip.prompt);
                    handleGenerate(chip.prompt);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-gray-100/90 dark:bg-zinc-800/90 hover:bg-purple-500/15 hover:text-purple-600 dark:hover:text-purple-400 text-gray-700 dark:text-gray-300 text-[11px] font-medium border border-gray-200/50 dark:border-zinc-700/50 transition-colors cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50 text-[11px]">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 3. Streaming Generated Output Preview */}
          {(generatedText || isStreaming) && (
            <div className="mt-1 flex flex-col gap-2">
              <div className="p-3.5 max-h-64 overflow-y-auto rounded-xl bg-gray-50/90 dark:bg-zinc-950/80 border border-gray-200/70 dark:border-zinc-800/80 shadow-2xs select-text">
                <MarkdownMessage content={generatedText} isStreaming={isStreaming} />
              </div>

              {/* Insertion & Control Footer */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  {isStreaming ? (
                    <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                      <Loader2 size={11} className="animate-spin" />
                      <span>{t('aiInlineGenerating')}</span>
                    </span>
                  ) : (
                    <span>Enter: {t('aiInlineInsert')} • Esc: {t('aiInlineCancel')}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isStreaming && (
                    <button
                      onClick={() => handleGenerate()}
                      className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw size={11} />
                      <span>{t('aiInlineRetry')}</span>
                    </button>
                  )}

                  <button
                    onClick={handleApply}
                    disabled={!generatedText.trim() || isStreaming}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-40 transition-all"
                  >
                    <Check size={13} />
                    <span>{t('aiInlineInsert')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
