import React from 'react';
import { useTranslation } from 'react-i18next';

export interface InputDialogState {
  title: string;
  placeholder: string;
  defaultValue?: string;
  onConfirm: (val: string) => void;
}

export const InputDialogModal: React.FC<{
  dialog: InputDialogState | null;
  onClose: () => void;
}> = ({ dialog, onClose }) => {
  const { t } = useTranslation();
  if (!dialog) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
      <div className="w-80 bg-white dark:bg-zinc-900 border border-mac-borderLight dark:border-mac-borderDark rounded-2xl shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {dialog.title}
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const input = form.elements.namedItem('dialogInput') as HTMLInputElement;
            dialog.onConfirm(input.value);
            onClose();
          }}
        >
          <input
            autoFocus
            name="dialogInput"
            defaultValue={dialog.defaultValue || ''}
            placeholder={dialog.placeholder}
            className="w-full px-3 py-2.5 sm:py-2 text-sm sm:text-xs bg-gray-50 dark:bg-zinc-800 border border-mac-borderLight dark:border-mac-borderDark rounded-xl focus:outline-none focus:ring-2 focus:ring-mac-accent mb-4 text-gray-900 dark:text-gray-100"
          />
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] px-3.5 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 active:scale-95 transition-all cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="min-h-[38px] px-4 py-2 bg-mac-accent text-white rounded-xl font-medium hover:bg-blue-600 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              {t('ok')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
