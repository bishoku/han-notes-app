import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Globe, X, Link, Check, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface EmbedSavePayload {
  url: string;
  height: number;
  from?: number;
  to?: number;
}

interface EmbedInputModalProps {
  isOpen: boolean;
  initialUrl?: string;
  initialHeight?: number | null;
  from?: number;
  to?: number;
  onClose: () => void;
  onSave: (payload: EmbedSavePayload) => void;
}

export const EmbedInputModal: React.FC<EmbedInputModalProps> = ({
  isOpen,
  initialUrl = '',
  initialHeight = 480,
  from,
  to,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string>(initialUrl);
  const [height, setHeight] = useState<number>(initialHeight || 480);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl || '');
      setHeight(initialHeight || 480);
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialUrl, initialHeight]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError(t('embedUrlRequired', 'Lütfen geçerli bir bağlantı adresi girin.'));
      return;
    }

    onSave({
      url: trimmed,
      height: Math.max(160, Math.min(1600, Number(height) || 480)),
      from,
      to,
    });
    onClose();
  };

  const isEditing = Boolean(from !== undefined && to !== undefined);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 p-5 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Globe size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {isEditing ? t('embedEditTitle', 'Gömülü Bağlantıyı Düzenle') : t('embedModalTitle', 'Bağlantı Göm / Embed')}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                {t('embedModalDesc', 'YADA diyagramı, YouTube videosu veya web bağlantısı')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('url', 'Bağlantı URL')}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-gray-400 dark:text-zinc-500">
                <Link size={14} />
              </span>
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t('embedInputPlaceholder', 'https://bishoku.github.io/yada/#ref=...')}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              />
            </div>
            {error && (
              <p className="text-[11px] text-red-500 dark:text-red-400 mt-1">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                {t('height', 'Yükseklik (px):')}
              </label>
              <input
                type="number"
                min={160}
                max={1600}
                step={20}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-20 px-2 py-1 text-xs text-center rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 rounded-md">
              <Sparkles size={11} />
              <span>YADA & YouTube optimize</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            >
              {t('cancel', 'Vazgeç')}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Check size={14} />
              <span>{isEditing ? t('save', 'Güncelle') : t('embedButton', 'Göm')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
