/**
 * PdfSplitViewer.tsx — Side-by-side interactive PDF Reader & Deep-Linked Citation Tool.
 * Renders vector-sharp PDF pages with text selection layer and one-click note quote insertion.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
  Quote,
  Loader2,
  Check,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import { storage } from '@/services/storage';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

interface PdfSplitViewerProps {
  pdfPath: string;
  pdfName: string;
  initialPage?: number;
  jumpKey?: number;
  onClose: () => void;
  onInsertQuote: (quoteText: string, pageNumber: number) => void;
}

export const PdfSplitViewer: React.FC<PdfSplitViewerProps> = ({
  pdfPath,
  pdfName,
  initialPage = 1,
  jumpKey,
  onClose,
  onInsertQuote,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [doc, setDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(isMobile ? 0.75 : 1.25);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageDims, setPageDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Split-view pane width state (resizable)
  const [width, setWidth] = useState<number>(480);
  const [isDraggingResizer, setIsDraggingResizer] = useState<boolean>(false);

  // Floating quote pill state
  const [selectedText, setSelectedText] = useState<string>('');
  const [pillPos, setPillPos] = useState<{ top: number; left: number } | null>(null);
  const [justQuoted, setJustQuoted] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageWrapperRef = useRef<HTMLDivElement | null>(null);

  // Auto fit & pinch gesture refs
  const unscaledPageWidthRef = useRef<number>(595);
  const hasAutoFittedRef = useRef<boolean>(false);
  const pinchStartDistRef = useRef<number>(0);
  const pinchStartScaleRef = useRef<number>(scale);
  const isPinchingRef = useRef<boolean>(false);
  const currentPinchScaleRef = useRef<number>(scale);
  const lastTapTimeRef = useRef<number>(0);

  // Helper to calculate Fit-to-Width scale based on container width
  const getFitWidthScale = useCallback((baseWidth?: number) => {
    const containerW = containerRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 480);
    const w = baseWidth || unscaledPageWidthRef.current || 595;
    const padding = isMobile ? 16 : 32;
    const fit = (containerW - padding) / w;
    return Math.min(2.5, Math.max(0.35, Number(fit.toFixed(2))));
  }, [isMobile]);

  // Jump to initialPage when prop or jumpKey changes
  useEffect(() => {
    if (initialPage && initialPage >= 1) {
      setCurrentPage(initialPage);
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }
  }, [initialPage, jumpKey]);

  // Reset auto-fit on new document
  useEffect(() => {
    hasAutoFittedRef.current = false;
  }, [pdfPath]);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setLoadError(null);

    const loadDoc = async () => {
      try {
        let pdfSource: any;
        if (pdfPath.startsWith('http') || pdfPath.startsWith('data:')) {
          pdfSource = pdfPath;
        } else {
          const dataUrl = await storage.getImageDataUrl(pdfPath);
          pdfSource = dataUrl;
        }

        let loadingTask: any;
        if (typeof pdfSource === 'string' && pdfSource.startsWith('data:')) {
          const base64 = pdfSource.split(',')[1];
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          loadingTask = pdfjsLib.getDocument({ data: bytes, useSystemFonts: true });
        } else {
          loadingTask = pdfjsLib.getDocument({ url: pdfSource, useSystemFonts: true });
        }

        const loadedDoc = await loadingTask.promise;
        if (!isCancelled) {
          setDoc(loadedDoc);
          setNumPages(loadedDoc.numPages);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load PDF in SplitViewer:', err);
          setLoadError(err.message || 'PDF dokümanı yüklenemedi.');
          setIsLoading(false);
        }
      }
    };

    loadDoc();

    return () => {
      isCancelled = true;
    };
  }, [pdfPath]);

  // Render Page onto Canvas
  useEffect(() => {
    if (!doc || !canvasRef.current) return;
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await doc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        unscaledPageWidthRef.current = unscaledViewport.width;

        // Auto fit to width on first mobile render
        if (!hasAutoFittedRef.current && isMobile) {
          hasAutoFittedRef.current = true;
          const autoScale = getFitWidthScale(unscaledViewport.width);
          setScale(autoScale);
          return;
        }

        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale });
        const w = Math.floor(viewport.width);
        const h = Math.floor(viewport.height);

        setPageDims({ width: w, height: h });

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const transform = pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null;

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          transform,
        });

        await renderTask.promise;

        // Render TextLayer for high-accuracy text selection
        const textContent = await page.getTextContent();
        if (textLayerRef.current) {
          textLayerRef.current.innerHTML = '';
          textLayerRef.current.style.width = `${w}px`;
          textLayerRef.current.style.height = `${h}px`;

          const textLayer = new (pdfjsLib as any).TextLayer({
            textContentSource: textContent,
            container: textLayerRef.current,
            viewport,
          });
          await textLayer.render();
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Page render failed:', err);
        }
      }
    };

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [doc, currentPage, scale, isMobile, getFitWidthScale]);

  // Touch Gesture Handling: Pinch-to-Zoom & Double-Tap
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        pinchStartDistRef.current = dist;
        pinchStartScaleRef.current = scale;
        currentPinchScaleRef.current = scale;
        isPinchingRef.current = true;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTimeRef.current < 300) {
          // Double tap detected
          e.preventDefault();
          const fitScale = getFitWidthScale();
          setScale((curr) => {
            const isNearFit = Math.abs(curr - fitScale) < 0.15;
            return isNearFit ? Math.min(2.5, Number((fitScale * 1.6).toFixed(2))) : fitScale;
          });
          lastTapTimeRef.current = 0;
        } else {
          lastTapTimeRef.current = now;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinchingRef.current) {
        e.preventDefault(); // Prevent native browser page zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        const ratio = dist / (pinchStartDistRef.current || 1);
        const targetScale = Math.min(2.5, Math.max(0.35, Number((pinchStartScaleRef.current * ratio).toFixed(2))));
        currentPinchScaleRef.current = targetScale;
        if (pageWrapperRef.current) {
          pageWrapperRef.current.style.transform = `scale(${ratio})`;
          pageWrapperRef.current.style.transformOrigin = 'center top';
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isPinchingRef.current && e.touches.length < 2) {
        isPinchingRef.current = false;
        if (pageWrapperRef.current) {
          pageWrapperRef.current.style.transform = '';
          pageWrapperRef.current.style.transformOrigin = '';
        }
        if (currentPinchScaleRef.current && Math.abs(currentPinchScaleRef.current - scale) > 0.02) {
          setScale(currentPinchScaleRef.current);
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isMobile, scale, getFitWidthScale]);

  // Orientation Change / Window Resize Auto Re-fit
  useEffect(() => {
    if (!isMobile) return;
    const handleResize = () => {
      const newFit = getFitWidthScale();
      setScale(newFit);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, getFitWidthScale]);

  // Handle Text Selection for Floating Quote Pill
  const handleMouseUp = useCallback((e?: React.MouseEvent) => {
    // If the mouseup happened inside the quote pill container, ignore
    if (e && (e.target as HTMLElement)?.closest?.('.quote-pill-container')) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPillPos(null);
      setSelectedText('');
      return;
    }

    const text = selection.toString().trim();
    if (text.length >= 1 && containerRef.current) {
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        // Check if selection is within the PDF scroll container
        if (
          rect.bottom < containerRect.top ||
          rect.top > containerRect.bottom ||
          rect.right < containerRect.left ||
          rect.left > containerRect.right
        ) {
          setPillPos(null);
          return;
        }

        // Relative coordinates inside container taking scroll into account
        const scrollTop = containerRef.current.scrollTop;
        const scrollLeft = containerRef.current.scrollLeft;

        // Position pill immediately below the bottom of the selected word/range (6px gap)
        const relBottom = rect.bottom - containerRect.top + scrollTop;
        const relTop = rect.top - containerRect.top + scrollTop;
        const relCenterX = rect.left - containerRect.left + scrollLeft + rect.width / 2;

        let top = relBottom + 6;
        // If placing it below would overflow the visible viewport, flip to 6px above
        if (rect.bottom + 42 > containerRect.bottom && relTop - 36 > 0) {
          top = relTop - 36;
        }

        setSelectedText(text);
        setPillPos({
          top: Math.max(10, Math.round(top)),
          left: Math.round(relCenterX),
        });
      } catch {
        setPillPos(null);
      }
    } else {
      setPillPos(null);
      setSelectedText('');
    }
  }, []);

  // Insert Quote Action
  const handleQuoteClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!selectedText) return;
    onInsertQuote(selectedText, currentPage);
    setJustQuoted(true);
    setTimeout(() => {
      setJustQuoted(false);
      setPillPos(null);
      setSelectedText('');
      window.getSelection()?.removeAllRanges();
    }, 1200);
  };

  // Resizer Dragging (Desktop Only)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingResizer) return;
      const newWidth = Math.min(Math.max(e.clientX - 200, 320), window.innerWidth * 0.65);
      setWidth(newWidth);
    };

    const handleMouseUpResizer = () => {
      setIsDraggingResizer(false);
    };

    if (isDraggingResizer) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUpResizer);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUpResizer);
    };
  }, [isDraggingResizer]);

  return (
    <div
      style={isMobile ? undefined : { width: `${width}px` }}
      className={cn(
        "border-r border-gray-200 dark:border-zinc-800 flex flex-col relative shrink-0",
        isMobile
          ? "fixed inset-0 z-[90] w-full h-[100dvh] max-h-[100dvh] bg-zinc-200 dark:bg-zinc-950 pt-safe pb-safe shadow-2xl animate-in fade-in duration-200 overflow-hidden"
          : "h-full z-20 bg-gray-50/80 dark:bg-zinc-950"
      )}
    >
      {/* Top Header & Page Navigation Toolbar */}
      <div className="h-12 min-h-[48px] px-2 sm:px-3 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-1 sm:gap-2 shrink-0 select-none">
        <div className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0 pr-1 max-w-[90px] sm:max-w-xs">
          <FileText size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
          <span
            className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate cursor-help"
            title={pdfName}
          >
            {pdfName}
          </span>
        </div>

        {/* Page Switcher */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || isLoading}
            className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer active:scale-95"
            title={t('previousPage')}
          >
            <ChevronLeft size={16} />
          </button>

          <span className="text-[11px] font-mono text-gray-600 dark:text-gray-400 px-0.5 sm:px-1">
            {currentPage} / {numPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages || isLoading}
            className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer active:scale-95"
            title={t('nextPage')}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Zoom & Close Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setScale((s) => Math.max(0.35, Number((s - 0.15).toFixed(2))))}
              className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer active:scale-95"
              title={t('zoomOut')}
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => setScale(getFitWidthScale())}
              className="text-[11px] sm:text-[10px] font-mono font-medium text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 px-1 sm:px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded cursor-pointer transition-colors"
              title={t('fitToWidth')}
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))))}
              className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer active:scale-95"
              title={t('zoomIn')}
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-7 sm:h-7 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 bg-gray-100/80 dark:bg-zinc-800/80 transition-all cursor-pointer ml-0.5 sm:ml-1 active:scale-95 shrink-0"
            title={t('pdfCloseReader')}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* PDF Canvas & Text Selection Container */}
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        onTouchEnd={() => {
          setTimeout(handleMouseUp, 150);
        }}
        className="pdfViewer flex-1 overflow-auto p-2 sm:p-4 relative select-text touch-pan-x touch-pan-y"
        style={{
          '--scale-factor': `${scale}`,
        } as any}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 h-64 text-gray-400">
            <Loader2 size={24} className="animate-spin text-purple-600" />
            <span className="text-xs">{t('loading')}</span>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-2 h-64 text-red-500 text-xs text-center px-4">
            <p className="font-semibold">{t('pdfDocumentOpenError')}</p>
            <p className="text-gray-400 text-[11px]">{loadError}</p>
          </div>
        ) : (
          <div
            ref={pageWrapperRef}
            className="page relative shadow-lg rounded-sm overflow-hidden bg-white select-text mx-auto will-change-transform"
            style={{
              width: pageDims.width ? `${pageDims.width}px` : undefined,
              height: pageDims.height ? `${pageDims.height}px` : undefined,
              '--scale-factor': `${scale}`,
            } as any}
          >
            <div className="canvasWrapper" style={{ width: '100%', height: '100%' }}>
              <canvas ref={canvasRef} className="block max-w-none pointer-events-none" />
            </div>
            <div
              ref={textLayerRef}
              className="textLayer"
              style={{
                width: pageDims.width ? `${pageDims.width}px` : undefined,
                height: pageDims.height ? `${pageDims.height}px` : undefined,
              }}
            />
          </div>
        )}

        {/* Floating Quick Quote Pill */}
        {pillPos && (
          <div
            style={{
              top: `${pillPos.top}px`,
              left: `${pillPos.left}px`,
              transform: 'translateX(-50%)',
            }}
            className="quote-pill-container absolute z-40 animate-in fade-in zoom-in-95 duration-100 pointer-events-auto"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={handleQuoteClick}
              className="flex items-center gap-1.5 px-3 py-1 bg-gray-950/95 dark:bg-zinc-100/95 text-white dark:text-gray-900 rounded-full shadow-2xl text-[11px] font-semibold hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20 dark:border-black/20 select-none whitespace-nowrap"
            >
              {justQuoted ? (
                <>
                  <Check size={12} className="text-emerald-400 dark:text-emerald-600" />
                  <span>{t('pdfQuoteAdded')}</span>
                </>
              ) : (
                <>
                  <Quote size={11} className="text-purple-400 dark:text-purple-600" />
                  <span>{t('pdfQuoteSnippet')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Draggable Resizer Handle on Right Border (Desktop Only) */}
      {!isMobile && (
        <div
          onMouseDown={() => setIsDraggingResizer(true)}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-purple-500/40 active:bg-purple-600 transition-colors z-30"
        />
      )}
    </div>
  );
};
