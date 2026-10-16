import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  titleId?: string;
  ariaLabel?: string;
  maxWidthClass?: string;
  className?: string;
  containerClassName?: string;
  backdropClassName?: string;
  zIndexClass?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  children: React.ReactNode;
}

/**
 * ModalShell — Unified, accessible modal foundation for H.A.N. Notes.
 * Ensures every dialog across the application shares identical backdrop blur,
 * theme-reactive surface colors, border radius, Escape key handling, and portal rendering.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  titleId,
  ariaLabel,
  maxWidthClass = 'max-w-md',
  className,
  containerClassName,
  backdropClassName,
  zIndexClass = 'z-[100]',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  children,
}) => {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const content = (
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe',
        'bg-black/55 backdrop-blur-sm animate-in fade-in duration-150 select-none',
        zIndexClass,
        backdropClassName
      )}
      onClick={closeOnBackdropClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          'relative w-full flex flex-col overflow-hidden',
          'bg-white/95 dark:bg-mac-sidebarDark/95 backdrop-blur-2xl',
          'border border-mac-borderLight dark:border-mac-borderDark',
          'rounded-2xl sm:rounded-3xl shadow-2xl',
          'animate-in zoom-in-95 duration-150',
          maxWidthClass,
          containerClassName,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
};
