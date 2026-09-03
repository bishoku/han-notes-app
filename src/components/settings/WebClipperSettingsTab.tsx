/**
 * WebClipperSettingsTab.tsx — Settings panel section for Web Clipper.
 * Displays the bookmarklet installation link, instructions, and features.
 */
import React, { useState } from 'react';
import { generateBookmarkletHref } from '@/services/clipper/bookmarkletGenerator';
import {
  Globe,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';

export const WebClipperSettingsTab: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const bookmarkletHref = generateBookmarkletHref();

  const setAnchorProps = (el: HTMLAnchorElement | null) => {
    if (el) {
      el.href = bookmarkletHref;
      el.title = "📌 Han Notes'a Kaydet";
    }
  };

  const handleCopyHref = async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletHref);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Kopyalama başarısız:', err);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-xs text-gray-800 dark:text-gray-200">
      {/* 1. Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-sm mt-0.5">
            <Globe size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <span>Web Clipper (Tarayıcı Yer İmi)</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold">
                Sıfır Backend
              </span>
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-[11px] leading-relaxed">
              İnternette gezinirken tek bir tıkla makaleleri, dokümanları ve sayfaları temiz Markdown formatında H.A.N. Not Defteri'ne aktarın.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Drag & Drop Bookmarklet Button */}
      <div className="p-5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700/60 flex flex-col items-center text-center gap-3">
        <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
          Yer İmleri Çubuğuna Sürükleyin
        </span>

        <div className="py-2">
          <a
            ref={setAnchorProps}
            onMouseEnter={(e) => setAnchorProps(e.currentTarget)}
            onMouseDown={(e) => setAnchorProps(e.currentTarget)}
            onPointerDown={(e) => setAnchorProps(e.currentTarget)}
            onClick={(e) => {
              e.preventDefault();
              alert('İpucu: Bu butona tıklamak yerine farenizle tarayıcınızın yer imleri (favoriler) çubuğuna sürükleyip bırakın!');
            }}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-grab active:cursor-grabbing select-none"
            title="📌 Han Notes'a Kaydet"
          >
            <span>📌</span>
            <span>Han Notes'a Kaydet</span>
          </a>
        </div>

        <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-sm">
          Butonu yer imleri çubuğuna sürükleyin. Herhangi bir web sitesindeyken yer imine tıkladığınızda sayfa anında notlarınıza eklenir.
        </p>

        <button
          onClick={handleCopyHref}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-750 transition-colors cursor-pointer font-medium text-[11px]"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          <span>{copied ? 'Yer İmi Kodu Kopyalandı!' : 'Yer İmi Kodunu Kopyala'}</span>
        </button>
      </div>

      {/* 3. Steps Guide */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-xs">Nasıl Kurulur?</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-200/60 dark:border-zinc-800 space-y-1">
            <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px]">
                1
              </span>
              <span>Çubuğu Açın</span>
            </span>
            <p className="text-gray-500 dark:text-gray-400 text-[11px]">
              Tarayıcınızda <kbd className="px-1 py-0.5 rounded bg-gray-200 dark:bg-zinc-700 font-mono text-[10px]">Ctrl+Shift+B</kbd> veya <kbd className="px-1 py-0.5 rounded bg-gray-200 dark:bg-zinc-700 font-mono text-[10px]">⌘⇧B</kbd> ile yer imleri çubuğunu görünür yapın.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-200/60 dark:border-zinc-800 space-y-1">
            <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px]">
                2
              </span>
              <span>Sürükleyin</span>
            </span>
            <p className="text-gray-500 dark:text-gray-400 text-[11px]">
              Yukarıdaki <strong>"Han Notes'a Kaydet"</strong> butonunu farenizle yer imleri çubuğuna bırakın.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-200/60 dark:border-zinc-800 space-y-1">
            <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px]">
                3
              </span>
              <span>Kullanın</span>
            </span>
            <p className="text-gray-500 dark:text-gray-400 text-[11px]">
              İstediğiniz bir web sayfasındayken yer imine tıklayın. Sayfa otomatik olarak temiz Markdown formatında kasanıza eklenir.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Privacy and Technology */}
      <div className="p-4 rounded-2xl bg-gray-50/60 dark:bg-zinc-800/30 border border-gray-200/60 dark:border-zinc-800 flex flex-col gap-2">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <ShieldCheck size={15} className="text-emerald-500" />
          <span>Gizlilik ve Mimari</span>
        </h4>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
          Clipper, hedef sayfadaki DOM verisini <code>window.postMessage</code> el sıkışma protokolü ile doğrudan tarayıcınız içindeki H.A.N. Notes sekmesine aktarır. Mozilla Readability ve Turndown ile tamamen istemci tarafında işlenir; hiçbir sunucuya veya üçüncü tarafa veri gitmez.
        </p>
      </div>
    </div>
  );
};
