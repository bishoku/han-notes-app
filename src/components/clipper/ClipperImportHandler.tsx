/**
 * ClipperImportHandler.tsx — Handles incoming web clips received from the
 * browser bookmarklet via window.postMessage.
 *
 * Lifecycle:
 * 1. Checks for window.opener.
 * 2. Emits CLIPPER_READY handshake signal to window.opener.
 * 3. Listens for CLIPPER_DATA payload containing { html, url, title }.
 * 4. Transforms HTML to clean GFM Markdown using webClipperService.
 * 5. Creates a new note in the vault and saves the Markdown content.
 * 6. Navigates to the new note and shows a success confirmation.
 */
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { convertHtmlToMarkdown, sanitizeNoteTitle } from '@/services/clipper/webClipperService';
import { useNoteStore } from '@/store/noteStore';
import { storage } from '@/services/storage';
import { eventBus } from '@/lib/eventBus';
import { WebClipperModal } from './WebClipperModal';
import {
  Globe,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Sparkles,
} from 'lucide-react';

type ImportStatus = 'checking' | 'waiting' | 'processing' | 'saving' | 'success' | 'no_opener' | 'error';

export const ClipperImportHandler: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ImportStatus>('checking');
  const [statusMessage, setStatusMessage] = useState<string>('Bağlantı kuruluyor...');
  const [importedTitle, setImportedTitle] = useState<string>('');
  const [importedNoteId, setImportedNoteId] = useState<string>('');
  const [hasOtherTab, setHasOtherTab] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const processedRef = useRef(false);
  const hasOtherTabRef = useRef(false);
  const statusRef = useRef<ImportStatus>('checking');
  statusRef.current = status;

  useEffect(() => {
    // 0. Check if another main tab is active
    let syncChannel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      syncChannel = new BroadcastChannel('han_clipper_channel');
      syncChannel.onmessage = (e) => {
        if (e.data?.type === 'CLIPPER_PONG') {
          hasOtherTabRef.current = true;
          setHasOtherTab(true);
        }
      };
      syncChannel.postMessage({ type: 'CLIPPER_PING' });
    }

    // 1. Check if window.opener exists
    if (!window.opener) {
      setStatus('no_opener');
      syncChannel?.close();
      return;
    }

    setStatus('waiting');
    setStatusMessage('Açık web sayfasından veri bekleniyor...');

    // 2. Handshake loop: send CLIPPER_READY to opener
    let handshakeAttempts = 0;
    const sendReady = () => {
      if (processedRef.current) return;
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'CLIPPER_READY' }, '*');
        }
      } catch (err) {
        console.warn('[ClipperImportHandler] postMessage failed:', err);
      }
    };

    sendReady();
    const intervalId = setInterval(() => {
      handshakeAttempts++;
      if (handshakeAttempts > 10 || processedRef.current) {
        clearInterval(intervalId);
        if (!processedRef.current && statusRef.current === 'waiting') {
          setStatus('error');
          setErrorMessage('Hedef sayfadan yanıt alınamadı veya bağlantı zaman aşımına uğradı.');
        }
      } else {
        sendReady();
      }
    }, 500);

    // 3. Listen for CLIPPER_DATA
    const handleMessage = async (event: MessageEvent) => {
      // Basic security and shape checks
      if (!event.data || event.data.type !== 'CLIPPER_DATA') return;
      if (processedRef.current) return;
      processedRef.current = true;
      clearInterval(intervalId);

      const payload = event.data.payload;
      if (!payload || typeof payload !== 'object') {
        setStatus('error');
        setErrorMessage('Geçersiz web içeriği paketi alındı.');
        return;
      }

      const { html, url, title } = payload;
      if (!html || !url) {
        setStatus('error');
        setErrorMessage('Eksik sayfa verisi: HTML veya URL bulunamadı.');
        return;
      }

      try {
        setStatus('processing');
        setStatusMessage('Makale içeriği ayrıştırılıyor ve Markdown formatına dönüştürülüyor...');

        // Yield main thread slightly for smoother UI
        await new Promise((res) => setTimeout(res, 50));

        // Convert HTML to Markdown
        const clipResult = convertHtmlToMarkdown(html, url);

        // Immediate garbage collection hint: clear reference to raw DOM string
        if (event.data?.payload) {
          event.data.payload.html = null;
        }

        setStatus('saving');
        setStatusMessage('Yeni not oluşturuluyor...');

        // Ensure vault is loaded
        const noteStore = useNoteStore.getState();
        if (noteStore.notes.length === 0) {
          try {
            await noteStore.loadVault();
          } catch {
            // ignore if empty or loading
          }
        }

        // Determine unique note title
        const baseTitle = sanitizeNoteTitle(clipResult.title || title || 'Web Notu');
        const existingTitles = new Set(
          useNoteStore.getState().notes.map((n) => n.title.toLowerCase())
        );

        let finalTitle = baseTitle;
        let counter = 1;
        while (existingTitles.has(finalTitle.toLowerCase())) {
          counter++;
          finalTitle = `${baseTitle}-${counter}`;
        }

        // Create note directly with full markdown content
        const cleanId = finalTitle.endsWith('.md') ? finalTitle.slice(0, -3) : finalTitle;
        await storage.writeNote(cleanId, clipResult.markdown);
        await useNoteStore.getState().loadVault();

        // Update noteStore immediately with full content
        useNoteStore.setState({
          currentNoteId: cleanId,
          currentNoteContent: clipResult.markdown,
          activeFolderPath: '',
        });

        // Fire reload events so editor instances synchronize immediately
        eventBus.emit('note:reloaded', { noteId: cleanId, content: clipResult.markdown });
        window.dispatchEvent(
          new CustomEvent('han-note-content-reloaded', {
            detail: { noteId: cleanId, content: clipResult.markdown },
          })
        );

        // Force note selection and backlink indexing
        await useNoteStore.getState().selectNote(cleanId, true);

        setImportedTitle(finalTitle);
        setImportedNoteId(cleanId);
        setStatus('success');

        if (hasOtherTabRef.current && typeof BroadcastChannel !== 'undefined') {
          const syncChan = new BroadcastChannel('han_clipper_channel');
          syncChan.postMessage({ type: 'OPEN_IMPORTED_NOTE', noteId: cleanId });
          setTimeout(() => syncChan.close(), 200);

          setStatusMessage(`"${finalTitle}" notlarınıza eklendi! Açık olan sekmeye aktarıldı.`);

          // Automatically close this temporary import tab after 1.2s
          setTimeout(() => {
            try {
              window.close();
            } catch (e) {
              console.warn('Could not auto-close window:', e);
            }
          }, 1200);
        } else {
          setStatusMessage(`"${finalTitle}" notlarınıza eklendi!`);
          setTimeout(() => {
            navigate(`/notes/${encodeURIComponent(cleanId)}`, { replace: true });
          }, 400);
        }
      } catch (err: any) {
        console.error('[ClipperImportHandler] İçe aktarma hatası:', err);
        setStatus('error');
        setErrorMessage(err?.message || 'İçerik dönüştürülürken beklenmeyen bir hata oluştu.');
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('message', handleMessage);
      syncChannel?.close();
    };
  }, [navigate]);

  return (
    <div className="flex h-full w-full items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white">
      <div className="max-w-md w-full p-8 rounded-3xl bg-white/10 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/20 dark:border-zinc-700/50 shadow-2xl text-center">
        {/* State: Waiting or Processing */}
        {(status === 'checking' || status === 'waiting' || status === 'processing' || status === 'saving') && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 mb-5 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Loader2 size={28} className="animate-spin text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2">Web İçeriği Aktarılıyor</h2>
            <p className="text-sm text-gray-300 leading-relaxed animate-pulse">{statusMessage}</p>
          </div>
        )}

        {/* State: Success */}
        {status === 'success' && (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mb-5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-emerald-300">Başarıyla Aktarıldı!</h2>
            <p className="text-sm text-gray-300 mb-3 font-medium">{importedTitle}</p>
            {hasOtherTab ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-500/20 px-4 py-2 rounded-full border border-indigo-500/30">
                  <Sparkles size={14} className="text-yellow-400" />
                  <span>Açık olan sekmeye aktarıldı. Bu sekme kapatılıyor...</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => {
                      try {
                        window.close();
                      } catch {}
                    }}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Sekmeyi Kapat
                  </button>
                  <button
                    onClick={() => navigate(`/notes/${encodeURIComponent(importedNoteId)}`, { replace: true })}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Bu Sekmede Aç
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Sparkles size={14} className="text-yellow-400" />
                <span>Not editörüne yönlendiriliyorsunuz...</span>
              </div>
            )}
          </div>
        )}

        {/* State: Error */}
        {status === 'error' && (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mb-5 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <AlertTriangle size={32} className="text-rose-400" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-rose-300">İçe Aktarma Başarısız</h2>
            <p className="text-sm text-gray-300 mb-6">{errorMessage}</p>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => navigate('/notes')}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Notlarıma Dön</span>
              </button>
            </div>
          </div>
        )}

        {/* State: No Opener (Direct Visit) */}
        {status === 'no_opener' && (
          <div className="flex flex-col items-center animate-in fade-in duration-200">
            <div className="w-16 h-16 mb-5 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Globe size={30} className="text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2">Web Clipper Portu</h2>
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              Bu sayfa, tarayıcınızın yer imlerine ekleyeceğiniz Web Clipper butonu tarafından web
              sayfalarını Markdown olarak içe aktarmak için kullanılır.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
              >
                <Bookmark size={16} />
                <span>Web Clipper'ı Kur & İncele</span>
              </button>
              <button
                onClick={() => navigate('/notes')}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold text-gray-300 hover:bg-white/10 transition-all cursor-pointer"
              >
                <ArrowLeft size={15} />
                <span>Notlarıma Dön</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <WebClipperModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
