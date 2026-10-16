import { create } from 'zustand';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const duration = toast.duration ?? 3000;
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { ...toast, id, duration }],
    }));

    if (duration > 0 && typeof window !== 'undefined') {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }

    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export const showToast = (
  title: string,
  options?: { description?: string; type?: ToastType; duration?: number }
) => {
  return useToastStore.getState().addToast({
    title,
    description: options?.description,
    type: options?.type ?? 'info',
    duration: options?.duration ?? 3000,
  });
};
