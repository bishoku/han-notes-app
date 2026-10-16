import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModalShell } from '@/components/ui/ModalShell';

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isDestructive = true,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClass="max-w-sm"
      zIndexClass="z-[120]"
      titleId="confirm-modal-title"
      className="p-5 select-none"
    >
      <div className="flex items-start gap-3.5">
        <div className={`w-10 h-10 rounded-xl ${isDestructive ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'} flex items-center justify-center shrink-0`}>
          {isDestructive ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 id="confirm-modal-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title || t('confirmDeleteTitle', 'Silmeyi Onayla')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            {message || t('confirmDeleteMessage', 'Bu ögeyi kaldırmak istediğinize emin misiniz?')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-w-[36px] min-h-[36px] w-9 h-9 flex items-center justify-center -mr-1 -mt-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
          aria-label={t('close')}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex items-center justify-end gap-2 mt-5">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[38px] px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 rounded-xl transition-all cursor-pointer"
        >
          {cancelLabel || t('cancel', 'Vazgeç')}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="min-h-[38px] px-4.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer"
        >
          {confirmLabel || t('delete', 'Sil')}
        </button>
      </div>
    </ModalShell>
  );
};

