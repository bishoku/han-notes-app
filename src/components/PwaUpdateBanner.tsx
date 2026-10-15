/**
 * PwaUpdateBanner — Self-contained PWA update detection + UI.
 * Uses the virtual:pwa-register/react hook internally.
 * Active on ALL screens (including Welcome / Folder selection).
 * Listens for focus & visibility changes for immediate update detection.
 */
import React, { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { PwaUpdateToast } from './PwaUpdateToast';
import { eventBus } from '@/lib/eventBus';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export const PwaUpdateBanner: React.FC = () => {
  const inTauri = isTauri();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!inTauri && registration) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        // Poll for updates every 15 minutes
        intervalRef.current = setInterval(() => {
          registration.update().catch(() => {});
        }, 15 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      if (!inTauri) {
        console.error('[PWA] SW registration error:', error);
      }
    },
  });

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Active check on window focus & tab visibility change
  useEffect(() => {
    if (inTauri) return;

    const handleCheckUpdate = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          reg?.update().catch(() => {});
        });
      }
    };

    window.addEventListener('focus', handleCheckUpdate);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleCheckUpdate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleCheckUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [inTauri]);

  if (inTauri) return null;

  return (
    <PwaUpdateToast
      show={needRefresh}
      onAccept={() => {
        eventBus.emit('note:flush-save');
        setTimeout(() => {
          updateServiceWorker(true);
        }, 50);
      }}
      onDismiss={() => setNeedRefresh(false)}
    />
  );
};
