import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';
import { cn } from '@/lib/utils';

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-live="polite"
      className="fixed bottom-9 right-4 z-[150] flex flex-col gap-2 max-w-xs w-full pointer-events-none select-none print:hidden"
    >
      {toasts.map((toast) => {
        const icon =
          toast.type === 'success' ? (
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle size={15} className="text-red-500 shrink-0" />
          ) : (
            <Info size={15} className="text-mac-accent shrink-0" />
          );

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl shadow-xl border backdrop-blur-xl transition-all',
              'bg-white/95 dark:bg-zinc-900/95 border-mac-borderLight dark:border-mac-borderDark',
              'animate-in fade-in slide-in-from-bottom-2 duration-150'
            )}
          >
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                {toast.title}
              </p>
              {toast.description && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="p-0.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer shrink-0"
              aria-label="Close notification"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
};
