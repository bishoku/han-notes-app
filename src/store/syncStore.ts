/**
 * Sync Store — Manages P2P E2EE synchronization state and pairing lifecycle.
 */
import { create } from 'zustand';
import QRCode from 'qrcode';
import { generatePairingKey, importPairingKey } from '@/services/sync/crypto';
import { WebRtcSyncService } from '@/services/sync/webrtcSyncService';
import { DEFAULT_SIGNALING_URL } from '@/services/sync/signalingClient';
import type { SyncProgress, SyncReport, SyncRole, SyncState } from '@/services/sync/types';

interface SyncStoreState {
  isModalOpen: boolean;
  activeTab: 'share' | 'scan';
  syncState: SyncState;
  role: SyncRole | null;
  pairingUrl: string | null;
  qrCodeDataUrl: string | null;
  progress: SyncProgress | null;
  lastReport: SyncReport | null;
  error: string | null;
  customSignalingUrl: string;

  // Actions
  openModal: (initialTab?: 'share' | 'scan') => void;
  closeModal: () => void;
  setActiveTab: (tab: 'share' | 'scan') => void;
  startHostSession: () => Promise<void>;
  startPeerSession: (pairingInput: string) => Promise<void>;
  cancelSync: () => void;
  setCustomSignalingUrl: (url: string) => void;
}

let activeSyncService: WebRtcSyncService | null = null;

const SIGNALING_URL_KEY = 'han_custom_signaling_url';

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  isModalOpen: false,
  activeTab: 'share',
  syncState: 'idle',
  role: null,
  pairingUrl: null,
  qrCodeDataUrl: null,
  progress: null,
  lastReport: null,
  error: null,
  customSignalingUrl:
    (typeof localStorage !== 'undefined' && localStorage.getItem(SIGNALING_URL_KEY)) || DEFAULT_SIGNALING_URL,

  openModal: (initialTab = 'share') => {
    set({ isModalOpen: true, activeTab: initialTab, error: null });
    if (initialTab === 'share' && get().syncState === 'idle') {
      get().startHostSession();
    }
  },

  closeModal: () => {
    if (get().syncState !== 'syncing') {
      get().cancelSync();
    }
    set({ isModalOpen: false });
  },

  setActiveTab: (tab) => {
    if (tab !== get().activeTab) {
      get().cancelSync();
      set({ activeTab: tab, error: null });
      if (tab === 'share') {
        get().startHostSession();
      }
    }
  },

  startHostSession: async () => {
    get().cancelSync();
    set({ syncState: 'generating_key', role: 'host', error: null, progress: null });

    try {
      // 1. Generate ephemeral session ID and 256-bit AES-GCM key
      const sessionId = `han_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      const { key, keyBase64 } = await generatePairingKey();

      // 2. Build zero-knowledge pairing URL with hash fragment
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
      const pairingUrl = `${origin}${pathname}#sync=${encodeURIComponent(sessionId)}&key=${encodeURIComponent(keyBase64)}&role=peer`;

      // 3. Generate QR code Data URL
      const qrCodeDataUrl = await QRCode.toDataURL(pairingUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      set({
        pairingUrl,
        qrCodeDataUrl,
        syncState: 'connecting_signaling',
      });

      // 4. Start WebRtcSyncService in host mode
      const signalingUrl = get().customSignalingUrl || DEFAULT_SIGNALING_URL;
      const service = new WebRtcSyncService(
        sessionId,
        key,
        'host',
        signalingUrl,
        (state, error) => {
          set({ syncState: state, error: error || null });
        },
        (progress) => {
          set({ progress });
        }
      );

      activeSyncService = service;
      const report = await service.start();
      set({ lastReport: report, syncState: 'completed' });
    } catch (err: any) {
      console.error('[SyncStore] Host session error:', err);
      set({
        syncState: 'error',
        error: err?.message || 'Failed to start host sync session',
      });
    }
  },

  startPeerSession: async (pairingInput: string) => {
    get().cancelSync();
    set({ syncState: 'connecting_signaling', role: 'peer', error: null, progress: null });

    try {
      // Parse pairing input (can be full URL with hash, or query string format)
      let hash = pairingInput;
      if (pairingInput.includes('#')) {
        hash = pairingInput.split('#')[1];
      } else if (pairingInput.includes('?')) {
        hash = pairingInput.split('?')[1];
      }

      const params = new URLSearchParams(hash);
      const sessionId = params.get('sync');
      const keyBase64 = params.get('key');

      if (!sessionId || !keyBase64) {
        throw new Error('Invalid pairing QR code or link: missing session ID or encryption key.');
      }

      // Import the 256-bit AES-GCM decryption key
      const key = await importPairingKey(keyBase64);

      const signalingUrl = get().customSignalingUrl || DEFAULT_SIGNALING_URL;
      const service = new WebRtcSyncService(
        sessionId,
        key,
        'peer',
        signalingUrl,
        (state, error) => {
          set({ syncState: state, error: error || null });
        },
        (progress) => {
          set({ progress });
        }
      );

      activeSyncService = service;
      const report = await service.start();
      set({ lastReport: report, syncState: 'completed' });
    } catch (err: any) {
      console.error('[SyncStore] Peer session error:', err);
      set({
        syncState: 'error',
        error: err?.message || 'Failed to connect to host peer',
      });
    }
  },

  cancelSync: () => {
    if (activeSyncService) {
      activeSyncService.cancel();
      activeSyncService = null;
    }
    set({
      syncState: 'idle',
      role: null,
      pairingUrl: null,
      qrCodeDataUrl: null,
      progress: null,
    });
  },

  setCustomSignalingUrl: (url: string) => {
    const clean = url.trim();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SIGNALING_URL_KEY, clean);
    }
    set({ customSignalingUrl: clean });
  },
}));
