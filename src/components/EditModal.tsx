/**
 * EditModal.tsx — Shared modal shell used by TaskEditModal and DecisionEditModal.
 * Provides consistent backdrop, container, header, form wrapper, and footer actions.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save } from 'lucide-react';

interface EditModalProps {
  /** Icon element for the header */
  icon: React.ReactNode;
  /** Title text for the header */
  title: string;
  /** Primary action button color class (e.g., "bg-mac-accent hover:bg-blue-600" or "bg-purple-600 hover:bg-purple-700") */
  accentClass: string;
  /** Optional left-side footer content (e.g., a checkbox) */
  footerLeft?: React.ReactNode;
  /** Container overflow class — use "overflow-visible" for date pickers that need to overflow */
  overflowClass?: string;
  /** Called with form submit data. Return a promise; modal will show saving state. */
  onSubmit: () => Promise<void>;
  onClose: () => void;
  children: React.ReactNode;
}

export const EditModal: React.FC<EditModalProps> = ({
  icon,
  title,
  accentClass,
  footerLeft,
  overflowClass = 'max-h-[90vh] overflow-y-auto',
  onSubmit,
  onClose,
  children,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSubmit();
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs animate-in fade-in select-none p-4">
      <div className={`bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 w-full max-w-md shadow-2xl flex flex-col gap-4 ${overflowClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3 shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
            {icon}
            {title}
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 text-xs">
          {children}

          {/* Footer */}
          <div className={`flex items-center ${footerLeft ? 'justify-between' : 'justify-end'} gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800 mt-1`}>
            {footerLeft}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={`flex items-center gap-1.5 px-4 py-1.5 ${accentClass} text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50`}
              >
                <Save size={14} /> {t('save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
