import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  Play,
  Code2,
  BookOpen,
} from 'lucide-react';
import { parseLinkMetadata } from '@/utils/urlMetadata';

export interface LinkPreviewData {
  url: string;
  label?: string;
  rect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
}

interface LinkPreviewPopoverProps {
  data: LinkPreviewData | null;
  onOpenFullscreen: (url: string, title?: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClose?: () => void;
}

export const LinkPreviewPopover: React.FC<LinkPreviewPopoverProps> = ({
  data,
  onOpenFullscreen,
  onMouseEnter,
  onMouseLeave,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  const meta = useMemo(() => {
    if (!data?.url) return null;
    return parseLinkMetadata(data.url, data.label);
  }, [data?.url, data?.label]);

  if (!data || !meta) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(meta.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExternalOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(meta.url, '_blank', 'noopener,noreferrer');
    onClose?.();
  };

  const handleFullscreenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenFullscreen(meta.url, meta.displayTitle);
    onClose?.();
  };

  // Position calculation: place below link, or above if close to bottom of screen
  const popoverWidth = 320;
  const popoverHeight = meta.thumbnailUrl ? 220 : 130;
  const margin = 8;

  const spaceBelow = window.innerHeight - data.rect.bottom;
  const placeAbove = spaceBelow < popoverHeight + 20 && data.rect.top > popoverHeight;

  const top = placeAbove
    ? Math.max(10, data.rect.top - popoverHeight - margin)
    : Math.min(window.innerHeight - popoverHeight - 10, data.rect.bottom + margin);

  // Center horizontally relative to link, clamped to viewport boundaries
  const preferredLeft = data.rect.left + (data.rect.width / 2) - (popoverWidth / 2);
  const left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, preferredLeft));

  const renderServiceIcon = () => {
    if (meta.serviceType === 'github') return <Code2 className="w-3.5 h-3.5 text-gray-800 dark:text-gray-200 shrink-0" />;
    if (meta.serviceType === 'wikipedia') return <BookOpen className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 shrink-0" />;
    if (meta.faviconUrl && !faviconError) {
      return (
        <img
          src={meta.faviconUrl}
          alt=""
          className="w-3.5 h-3.5 rounded-xs shrink-0 object-contain"
          onError={() => setFaviconError(true)}
        />
      );
    }
    return <Globe className="w-3.5 h-3.5 text-mac-accent shrink-0" />;
  };

  return createPortal(
    <div
      style={{ top: `${top}px`, left: `${left}px`, width: `${popoverWidth}px` }}
      className="fixed z-[100] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200/90 dark:border-zinc-800/90 rounded-xl shadow-2xl overflow-hidden text-gray-900 dark:text-gray-100 select-none animate-in fade-in zoom-in-95 duration-150"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Top Header: Domain / Favicon & Quick Action Buttons ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50/80 dark:bg-zinc-800/60 border-b border-gray-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          {renderServiceIcon()}
          <span className="text-[11px] font-mono font-medium text-gray-600 dark:text-gray-300 truncate">
            {meta.domain}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Copy URL button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={copied ? "Kopyalandı!" : "URL'i Kopyala"}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Open in external browser button */}
          <button
            type="button"
            onClick={handleExternalOpen}
            className="p-1 rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Yeni Sekmede Aç"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Fullscreen Iframe Modal button */}
          <button
            type="button"
            onClick={handleFullscreenClick}
            className="p-1 rounded-md text-mac-accent hover:bg-mac-accent/10 transition-colors cursor-pointer font-semibold"
            title="Tam Ekran Önizleme (Iframe)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── YouTube Video Cover (If applicable) ── */}
      {meta.thumbnailUrl && (
        <div
          className="relative w-full h-28 bg-black overflow-hidden cursor-pointer group"
          onClick={handleFullscreenClick}
        >
          <img
            src={meta.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
            <div className="p-2 rounded-full bg-red-600 text-white shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
          </div>
        </div>
      )}

      {/* ── Card Content Body ── */}
      <div
        className="p-3 cursor-pointer hover:bg-black/2 dark:hover:bg-white/2 transition-colors"
        onClick={handleFullscreenClick}
      >
        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 mb-1">
          {meta.displayTitle}
        </h4>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">
          {meta.snippet}
        </p>
      </div>
    </div>,
    document.body
  );
};
