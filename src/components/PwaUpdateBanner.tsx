/**
 * PwaUpdateBanner — Self-contained PWA update detection + UI.
 * Uses the virtual:pwa-register/react hook internally.
 * Only render this in browser mode (not Tauri).
 */
import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { PwaUpdateToast } from './PwaUpdateToast';

export const PwaUpdateBanner: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Poll for updates every 30 minutes
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 30 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] SW registration error:', error);
    },
  });

  return (
    <PwaUpdateToast
      show={needRefresh}
      onAccept={() => updateServiceWorker(true)}
      onDismiss={() => setNeedRefresh(false)}
    />
  );
};
