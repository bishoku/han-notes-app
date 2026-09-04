import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import jsQR from 'jsqr';
import { useSyncStore } from '@/store/syncStore';
import {
  X,
  QrCode,
  Camera,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  FlipHorizontal,
  ArrowDownUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const P2PSyncModal: React.FC = () => {
  const { t } = useTranslation();
  const {
    isModalOpen,
    closeModal,
    activeTab,
    setActiveTab,
    syncState,
    role,
    pairingUrl,
    qrCodeDataUrl,
    progress,
    lastReport,
    error,
    startHostSession,
    startPeerSession,
    cancelSync,
  } = useSyncStore();

  const [copied, setCopied] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const hasScannedRef = useRef(false);
  const isStartingCameraRef = useRef(false);

  // ── Keyboard Escape Handler ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, closeModal]);

  const stopCamera = React.useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn('[SyncModal] Error stopping tracks:', err);
      }
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch (err) {
        // Ignore video pause errors during teardown
      }
    }
  }, []);

  const scanQrCodeLoop = React.useCallback(() => {
    if (hasScannedRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanQrCodeLoop);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Check with jsQR
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data && code.data.includes('sync=') && code.data.includes('key=')) {
        hasScannedRef.current = true;
        // Haptic feedback if available
        if (typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate(80);
          } catch {}
        }
        stopCamera();
        startPeerSession(code.data);
        return;
      }
    }

    if (!hasScannedRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanQrCodeLoop);
    }
  }, [startPeerSession, stopCamera]);

  const startCamera = React.useCallback(async () => {
    if (isStartingCameraRef.current) return;
    isStartingCameraRef.current = true;
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(t('syncCameraNotSupported'));
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });

      // If user closed modal, changed tab, or QR code was detected while waiting for camera permission
      if (hasScannedRef.current || !isModalOpen || activeTab !== 'scan') {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        try {
          await videoRef.current.play();
        } catch (playErr: any) {
          if (playErr?.name === 'AbortError') {
            return;
          }
          throw playErr;
        }

        if (!hasScannedRef.current) {
          animationFrameRef.current = requestAnimationFrame(scanQrCodeLoop);
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      console.warn('[SyncModal] Camera access error:', err);
      setCameraError(err?.message || t('syncCameraPermissionDenied'));
    } finally {
      isStartingCameraRef.current = false;
    }
  }, [cameraFacing, scanQrCodeLoop, t, isModalOpen, activeTab]);

  // Reset hasScannedRef when opening modal or switching back to scan tab in idle state
  useEffect(() => {
    if (isModalOpen && activeTab === 'scan' && syncState === 'idle') {
      hasScannedRef.current = false;
    }
  }, [isModalOpen, activeTab, syncState]);

  // ── Camera Scanner Lifecycle for Scan Tab ──
  useEffect(() => {
    const isScanTabActive = isModalOpen && activeTab === 'scan';
    const isWaitingForScan = syncState === 'idle';
    const shouldCameraRun = isScanTabActive && isWaitingForScan && !hasScannedRef.current;

    if (!shouldCameraRun) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isModalOpen, activeTab, syncState, startCamera, stopCamera]);

  const handleCopyLink = async () => {
    if (!pairingUrl) return;
    try {
      await navigator.clipboard.writeText(pairingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    hasScannedRef.current = true;
    stopCamera();
    startPeerSession(manualInput.trim());
  };

  if (!isModalOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 pt-safe pb-safe">
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
              <ArrowDownUp size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('syncModalTitle')}</h2>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <ShieldCheck size={12} className="text-emerald-500" />
                <span>{t('syncE2eeBadge')}</span>
              </div>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex p-1.5 mx-5 mt-4 bg-gray-100 dark:bg-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('share')}
            disabled={syncState === 'syncing' || syncState === 'connecting_signaling' || syncState === 'connecting_peer'}
            className={cn(
              'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
              activeTab === 'share'
                ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            )}
          >
            <QrCode size={14} />
            <span>{t('syncTabShare')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            disabled={syncState === 'syncing' || syncState === 'connecting_signaling' || syncState === 'connecting_peer'}
            className={cn(
              'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
              activeTab === 'scan'
                ? 'bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            )}
          >
            <Camera size={14} />
            <span>{t('syncTabScan')}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* ── Active Transfer / Connecting Progress Display ── */}
          {syncState === 'syncing' || (role === 'peer' && (syncState === 'connecting_signaling' || syncState === 'connecting_peer')) ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <RefreshCw size={26} className="animate-spin" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
                {syncState === 'syncing' ? t('syncInProgress') : t('syncConnectingPeer')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
                {syncState === 'connecting_signaling'
                  ? t('syncConnectingSignaling')
                  : syncState === 'connecting_peer'
                  ? t('syncPleaseWait')
                  : progress?.currentNoteTitle
                  ? t('syncTransferringNote', { title: progress.currentNoteTitle })
                  : t('syncDiffingManifests')}
              </p>

              {progress && progress.totalNotes > 0 && (
                <div className="w-full max-w-xs">
                  <div className="flex justify-between text-[11px] font-medium text-gray-500 mb-1.5">
                    <span>{t('syncProgressLabel')}</span>
                    <span>
                      {progress.transferredNotes} / {progress.totalNotes}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (progress.transferredNotes / progress.totalNotes) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={cancelSync}
                className="mt-6 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
            </div>
          ) : syncState === 'completed' && lastReport ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                <CheckCircle2 size={30} />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">{t('syncCompletedTitle')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('syncCompletedSubtitle')}</p>

              {/* Stats Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full mb-4">
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 text-center">
                  <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {lastReport.sentNotesCount}
                  </div>
                  <div className="text-[10px] text-gray-400">{t('syncSentNotes')}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 text-center">
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {lastReport.receivedNotesCount}
                  </div>
                  <div className="text-[10px] text-gray-400">{t('syncReceivedNotes')}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 text-center">
                  <div className="text-lg font-bold text-amber-500">{lastReport.deletedNotesCount}</div>
                  <div className="text-[10px] text-gray-400">{t('syncDeletedTombstones')}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 text-center">
                  <div className="text-lg font-bold text-emerald-500">{lastReport.conflictsCount}</div>
                  <div className="text-[10px] text-gray-400">{t('syncConflictsCount')}</div>
                </div>
              </div>

              <button
                onClick={closeModal}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold hover:shadow-lg transition-all cursor-pointer"
              >
                {t('done')}
              </button>
            </div>
          ) : activeTab === 'share' ? (
            /* ── SHARE / SHOW QR CODE TAB ── */
            <div className="flex flex-col items-center text-center">
              {/* QR Code Container */}
              <div className="p-3 bg-white rounded-2xl shadow-md border border-gray-200 mb-3">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Pairing QR Code"
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
                    <RefreshCw className="animate-spin text-gray-400" size={24} />
                  </div>
                )}
              </div>

              {/* Status Message */}
              <div className="mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium mb-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span>
                    {syncState === 'waiting_peer'
                      ? t('syncWaitingPeerScan')
                      : syncState === 'connecting_peer'
                      ? t('syncConnectingPeer')
                      : t('syncGeneratingPairing')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">{t('syncShareInstructions')}</p>
              </div>

              {/* Copy Link & Refresh Buttons */}
              {pairingUrl && (
                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 text-xs font-semibold transition-all cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    <span>{copied ? t('copied') : t('syncCopyPairingLink')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startHostSession()}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 text-xs font-semibold transition-all cursor-pointer shrink-0"
                    title={t('syncRefreshQr')}
                  >
                    <RefreshCw size={14} />
                    <span className="hidden sm:inline">{t('syncRefreshQr')}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── SCAN / CONNECT TAB ── */
            <div className="flex flex-col items-center">
              {/* Camera Video Viewport */}
              <div className="relative w-full aspect-square max-w-[280px] bg-black rounded-2xl overflow-hidden shadow-lg border border-gray-800 mb-3 flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />

                {/* Reticle Scanner Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="w-full h-full border-2 border-indigo-400/80 rounded-xl relative shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                    {/* Glowing scanning laser line */}
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Flip camera toggle button */}
                <button
                  type="button"
                  onClick={() => setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                  className="absolute bottom-2.5 right-2.5 p-2 rounded-xl bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition-all cursor-pointer"
                  title={t('syncFlipCamera')}
                >
                  <FlipHorizontal size={15} />
                </button>
              </div>

              {cameraError ? (
                <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 text-center w-full">
                  <div className="flex items-center justify-center gap-1.5 font-semibold mb-0.5">
                    <AlertTriangle size={13} />
                    <span>{t('syncCameraNotice')}</span>
                  </div>
                  {cameraError}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
                  {t('syncScanInstructions')}
                </p>
              )}

              {/* Manual Input Form Accordion */}
              <form onSubmit={handleManualSubmit} className="w-full flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder={t('syncManualInputPlaceholder')}
                    className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!manualInput.trim()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-all shrink-0"
                  >
                    {t('syncConnect')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => (activeTab === 'share' ? startHostSession() : cancelSync())}
                className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
              >
                {t('syncRetry')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
