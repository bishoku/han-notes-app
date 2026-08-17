/**
 * ThinkingBlock.tsx — Antigravity & DeepSeek-style collapsible thinking & reasoning process block.
 * Features live thinking animations, duration timer, and clean markdown rendering when expanded.
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, ChevronDown, ChevronRight, Copy, Check, Sparkles } from 'lucide-react';

interface ThinkingBlockProps {
  reasoning?: string;
  thinkingTimeMs?: number;
  isThinking?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  reasoning,
  thinkingTimeMs,
  isThinking,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);

  // Live timer while isThinking is active
  useEffect(() => {
    if (!isThinking) {
      setLiveElapsedSeconds(0);
      return;
    }

    const start = Date.now();
    const timer = setInterval(() => {
      setLiveElapsedSeconds(Math.max(1, Math.round((Date.now() - start) / 1000)));
    }, 500);

    return () => clearInterval(timer);
  }, [isThinking]);

  // Don't render if there is no reasoning and not currently thinking
  if (!reasoning?.trim() && !isThinking) {
    return null;
  }

  // Format thinking duration
  const seconds = thinkingTimeMs
    ? (thinkingTimeMs / 1000).toFixed(1)
    : liveElapsedSeconds > 0
    ? liveElapsedSeconds.toString()
    : null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!reasoning) return;
    navigator.clipboard.writeText(reasoning);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 select-text w-full">
      {/* Collapsible Header Button */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        className={`group flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all duration-200 ${
          isThinking
            ? 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300 shadow-2xs'
            : isExpanded
            ? 'bg-gray-100 dark:bg-zinc-800/80 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300'
            : 'bg-gray-50/80 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-800 border-gray-200/60 dark:border-zinc-800 text-gray-500 dark:text-gray-400'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              isThinking
                ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 group-hover:text-purple-500'
            }`}
          >
            {isThinking ? (
              <Sparkles size={12} className="animate-spin text-purple-600 dark:text-purple-400" />
            ) : (
              <Brain size={12} />
            )}
          </div>

          <span className="font-medium text-[11px] truncate">
            {isThinking ? t('aiThinking') : t('aiThinkingProcess')}
          </span>

          {seconds && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-gray-500 dark:text-gray-400 shrink-0">
              {t('aiThinkingDuration', { seconds })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200">
          {reasoning && isExpanded && (
            <button
              onClick={handleCopy}
              title={copied ? t('aiThoughtCopied') : t('aiCopyThought')}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            </button>
          )}
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </div>
      </div>

      {/* Expanded Reasoning Body */}
      {isExpanded && (
        <div className="mt-2 pl-3.5 pr-3 py-2.5 rounded-xl bg-gray-50/90 dark:bg-zinc-900/70 border-l-2 border-purple-500/50 border-r border-t border-b border-gray-200/50 dark:border-zinc-800/60 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="text-[11px] font-mono leading-relaxed text-gray-600 dark:text-zinc-300 whitespace-pre-wrap break-words max-h-72 overflow-y-auto pr-1">
            {reasoning || (isThinking ? t('aiThinking') : '')}
          </div>
        </div>
      )}
    </div>
  );
};
