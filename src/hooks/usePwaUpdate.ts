/**
 * PWA Update Prompt — Shows a toast when a new version is available.
 * Uses vite-plugin-pwa's virtual:pwa-register/react module.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Check for updates every 30 minutes
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 30 * 60 * 1000);
      }
      console.log('[PWA] Service Worker registered:', swUrl);
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration error:', error);
    },
  });

  const acceptUpdate = () => {
    updateServiceWorker(true);
  };

  const dismissUpdate = () => {
    setNeedRefresh(false);
  };

  return { needRefresh, acceptUpdate, dismissUpdate };
}
