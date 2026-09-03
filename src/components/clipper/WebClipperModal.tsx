/**
 * WebClipperModal.tsx — User onboarding and installation modal for the
 * Web Clipper Bookmarklet. Allows dragging to browser bookmarks or copying code.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  generateBookmarkletHref,
  generateRawBookmarkletScript,
  getDefaultAppImportUrl,
} from '@/services/clipper/bookmarkletGenerator';
import {
  Globe,
  Copy,
  Check,
  ShieldCheck,
  ChevronRight,
  Code,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WebClipperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WebClipperModal: React.FC<WebClipperModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const bookmarkletHref = generateBookmarkletHref();
  const rawScript = generateRawBookmarkletScript();
  const importUrl = getDefaultAppImportUrl();

  const setAnchorProps = (el: HTMLAnchorElement | null) => {
    if (el) {
      el.href = bookmarkletHref;
      el.title = "📌 Han Notes'a Kaydet";
    }
  };

  if (!isOpen) return null;

  const handleCopyHref = async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletHref);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Kopyalama başarısız:', err);
    }
  };

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(rawScript);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    } catch (err) {
      console.error('Kopyalama başarısız:', err);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-200/80 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>Web Clipper (Yer İmi İçe Aktarıcı)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold">
                  Sıfır Backend
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Herhangi bir web sayfasını tek tıkla temiz Markdown olarak kasanıza kaydedin.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-gray-700 dark:text-gray-300">
          {/* Main Action Banner: Drag & Drop Button */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 text-center flex flex-col items-center gap-3">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              1. Adım: Yer İmleri Çubuğuna Sürükleyin
            </span>

            <div className="py-2">
              <a
                ref={setAnchorProps}
                onMouseEnter={(e) => setAnchorProps(e.currentTarget)}
                onMouseDown={(e) => setAnchorProps(e.currentTarget)}
                onPointerDown={(e) => setAnchorProps(e.currentTarget)}
                onClick={(e) => {
                  e.preventDefault();
                  alert(
                    'İpucu: Bu butona tıklamak yerine farenizle tarayıcınızın yer imleri (favoriler) çubuğuna sürükleyip bırakın!'
                  );
                }}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-grab active:cursor-grabbing select-none"
                title="📌 Han Notes'a Kaydet"
              >
                <span>📌</span>
                <span>Han Notes'a Kaydet</span>
              </a>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
              Yukarıdaki butonu tarayıcınızın yer imleri çubuğuna sürükleyin. Herhangi bir web sitesini (haber, makale, Wikipedia, Medium) gezerken bu yer imine tıklamanız yeterlidir.
            </p>

            {/* Alternative: Copy Link */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={handleCopyHref}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-750 transition-colors cursor-pointer font-medium"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? 'Bağlantı Kopyalandı!' : 'Yer İmi Kodunu Kopyala'}</span>
              </button>
            </div>
          </div>

          {/* Quick Browser Guide */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/70 dark:border-zinc-750">
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>Çubuğu Göster</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-[11px] leading-relaxed">
                <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-zinc-700 font-mono text-[10px]">
                  Ctrl+Shift+B
                </kbd>{' '}
                (Mac: <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-zinc-700 font-mono text-[10px]">⌘⇧B</kbd>) ile yer imleri çubuğunu açın.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/70 dark:border-zinc-750">
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>Sürükle & Bırak</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-[11px] leading-relaxed">
                Mor <strong>"Han Notes'a Kaydet"</strong> butonunu farenizle yer imleri çubuğuna bırakın.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/70 dark:border-zinc-750">
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>Tek Tıkla Kırp</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-[11px] leading-relaxed">
                İstediğiniz bir web sayfasındayken yer imine tıklayın. Sayfa anında temiz Markdown olarak notlarınıza aktarılır.
              </p>
            </div>
          </div>

          {/* Architecture & Privacy Highlights */}
          <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-200/60 dark:border-zinc-800 flex flex-col gap-2.5">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500" />
              <span>Güvenlik ve Gizlilik Garantisi</span>
            </h4>
            <ul className="space-y-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">•</span>
                <span>
                  <strong>%100 Yerel (Zero-Backend):</strong> Verileriniz üçüncü taraf sunuculardan geçmez. Sayfa doğrudan kendi tarayıcınız içinde işlenir ve kasanıza kaydedilir.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">•</span>
                <span>
                  <strong>Mozilla Readability & GFM:</strong> Reklamlar, menüler ve gereksiz kodlar ayıklanarak yalnızca makale metni, tablolar, kod blokları ve görseller GitHub Flavored Markdown olarak kaydedilir.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">•</span>
                <span>
                  <strong>CSP Uyumlu:</strong> Ziyaret ettiğiniz sitelere harici script veya kütüphane yüklemez, tarayıcı güvenlik politikalarını (CSP) ihlal etmez.
                </span>
              </li>
            </ul>
          </div>

          {/* Advanced / Manual Setup Accordion */}
          <div className="border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer"
            >
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                Manuel Yer İmi Ekleme & Gelişmiş Bilgiler
              </span>
              <ChevronRight
                size={16}
                className={cn('text-gray-400 transition-transform', showAdvanced && 'rotate-90')}
              />
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-3 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Tarayıcınız sürükle-bırak işlemini desteklemiyorsa: Tarayıcınızda yeni bir yer imi oluşturun, adını <code>Han Notes'a Kaydet</code> yapın ve adres (URL) kısmına aşağıdaki kodu yapıştırın:
                </p>

                <div className="relative">
                  <pre className="p-3 rounded-xl bg-gray-950 text-gray-200 font-mono text-[10px] overflow-x-auto max-h-32 select-all whitespace-pre-wrap break-all">
                    {bookmarkletHref}
                  </pre>
                  <button
                    onClick={handleCopyHref}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    title="Kopyala"
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <span>Hedef Adres:</span>
                    <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded text-[10px] font-mono">
                      {importUrl}
                    </code>
                  </div>
                  <button
                    onClick={handleCopyRaw}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Code size={12} />
                    <span>{copiedRaw ? 'Ham Kod Kopyalandı!' : 'Ham JS Kodunu Kopyala'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-semibold text-xs hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
