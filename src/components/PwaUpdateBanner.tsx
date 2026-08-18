/**
 * PwaUpdateBanner — Self-contained PWA update detection + UI.
 * Uses the virtual:pwa-register/react hook internally.
 * Active on ALL screens (including Welcome / Folder selection).
 * Listens for focus & visibility changes for immediate update detection.
 */
import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { PwaUpdateToast } from './PwaUpdateToast';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export const PwaUpdateBanner: React.FC = () => {
  const inTauri = isTauri();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!inTauri && registration) {
        // Poll for updates every 15 minutes
        setInterval(() => {
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
      onAccept={() => updateServiceWorker(true)}
      onDismiss={() => setNeedRefresh(false)}
    />
  );
};
