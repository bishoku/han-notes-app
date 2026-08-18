import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { parseLinkMetadata } from '@/utils/urlMetadata';

export interface WebLinkFullscreenData {
  url: string;
  title?: string;
}

interface WebLinkFullscreenModalProps {
  data: WebLinkFullscreenData | null;
  onClose: () => void;
}

export const WebLinkFullscreenModal: React.FC<WebLinkFullscreenModalProps> = ({
  data,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [showNotice, setShowNotice] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const meta = data ? parseLinkMetadata(data.url, data.title) : null;

  // Reset loading state on URL or reload change
  useEffect(() => {
    if (data?.url) {
      setIsLoading(true);
    }
  }, [data?.url, reloadKey]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!data) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, onClose]);

  if (!data || !meta) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(meta.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setReloadKey((prev) => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(meta.url, '_blank', 'noopener,noreferrer');
  };

  // Convert regular YouTube watch links to embed links if applicable
  let finalIframeUrl = meta.url;
  if (meta.serviceType === 'youtube') {
    try {
      const u = new URL(meta.url);
      const v = u.searchParams.get('v') || u.pathname.slice(1).split('/')[0];
      if (v) {
        finalIframeUrl = `https://www.youtube.com/embed/${v}?autoplay=1`;
      }
    } catch {
      // fallback to original url
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl h-[92vh] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Browser Navigation Header Bar ── */}
        <div className="px-4 py-2.5 bg-gray-100/90 dark:bg-zinc-950/90 border-b border-gray-200 dark:border-zinc-800/90 flex items-center justify-between gap-3 shrink-0">
          {/* Left: Favicon & Title */}
          <div className="flex items-center gap-2 min-w-0 max-w-xs md:max-w-sm">
            {meta.faviconUrl ? (
              <img
                src={meta.faviconUrl}
                alt=""
                className="w-4 h-4 rounded-xs shrink-0 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Globe className="w-4 h-4 text-mac-accent shrink-0" />
            )}
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
              {meta.displayTitle}
            </span>
          </div>

          {/* Center: Interactive Address Bar */}
          <div className="flex-1 max-w-xl mx-2 flex items-center bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300 font-mono shadow-2xs group">
            <span className="text-[10px] text-gray-400 mr-1.5 uppercase font-sans font-bold">
              {meta.protocol}
            </span>
            <span className="truncate flex-1 select-all">{meta.url}</span>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0 ml-1"
              title={copied ? "Kopyalandı!" : "URL'i Kopyala"}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Right: Refresh, Open External, Close Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Refresh Iframe */}
            <button
              type="button"
              onClick={handleRefresh}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Sayfayı Yenile"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Open in External Browser Tab */}
            <button
              type="button"
              onClick={handleOpenExternal}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Dış Tarayıcıda Aç"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            {/* Close Modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer ml-1"
              title="Kapat (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Embedding Notice / Security Banner (Dismissible) ── */}
        {showNotice && (
          <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Bazı siteler güvenlik politikaları (X-Frame-Options) nedeniyle iframe içinde engellenebilir. Yüklenmezse sağ üstteki <b>Tarayıcıda Aç</b> butonunu kullanabilirsiniz.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowNotice(false)}
              className="text-amber-700/60 dark:text-amber-300/60 hover:text-amber-700 dark:hover:text-amber-300 text-[10px] underline cursor-pointer shrink-0"
            >
              Gizle
            </button>
          </div>
        )}

        {/* ── Main Iframe Container ── */}
        <div className="flex-1 w-full h-full relative bg-gray-50 dark:bg-zinc-950 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xs">
              <Loader2 className="w-8 h-8 animate-spin text-mac-accent mb-2" />
              <span className="text-xs text-gray-500 font-medium font-mono">
                {meta.hostname} yükleniyor...
              </span>
            </div>
          )}

          <iframe
            key={reloadKey}
            ref={iframeRef}
            src={finalIframeUrl}
            title={meta.displayTitle}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation allow-downloads"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0 select-text"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
