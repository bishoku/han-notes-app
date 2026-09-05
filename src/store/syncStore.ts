/**
 * Sync Store — Manages P2P E2EE synchronization state and pairing lifecycle.
 */
import { create } from 'zustand';
import QRCode from 'qrcode';
import { generatePairingKey, importPairingKey } from '@/services/sync/crypto';
import { WebRtcSyncService } from '@/services/sync/webrtcSyncService';
import { DEFAULT_SIGNALING_URL } from '@/services/sync/signalingClient';
import { isTauriEnvironment, isFileSystemAccessSupported } from '@/services/storage';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { workspaceManager } from '@/services/workspace';
import type { SyncProgress, SyncReport, SyncRole, SyncState } from '@/services/sync/types';

export interface PendingWorkspacePrompt {
  remoteWorkspaceName: string;
  remoteWorkspaceId?: string;
  hasExistingWorkspace: boolean;
  needsDirectoryPicker: boolean;
  existingWorkspaceId?: string;
}

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
  pendingWorkspacePrompt: PendingWorkspacePrompt | null;

  // Actions
  openModal: (initialTab?: 'share' | 'scan') => void;
  closeModal: () => void;
  setActiveTab: (tab: 'share' | 'scan') => void;
  startHostSession: () => Promise<void>;
  startPeerSession: (pairingInput: string) => Promise<void>;
  resolveWorkspacePrompt: (action: 'merge' | 'create_new' | 'pick_directory') => Promise<void>;
  cancelSync: () => void;
  setCustomSignalingUrl: (url: string) => void;
}

let activeSyncService: WebRtcSyncService | null = null;
let workspacePromptResolver: ((action: 'merge' | 'create_new' | 'pick_directory') => Promise<void>) | null = null;

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
  pendingWorkspacePrompt: null,

  openModal: (initialTab = 'share') => {
    set({ isModalOpen: true, activeTab: initialTab, error: null });
    if (initialTab === 'share' && get().syncState !== 'syncing') {
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
      let baseUrl = 'https://bishoku.github.io/han-notes-app/';
      if (
        typeof window !== 'undefined' &&
        !isTauriEnvironment() &&
        window.location.protocol.startsWith('http') &&
        !window.location.hostname.includes('tauri')
      ) {
        const origin = window.location.origin;
        const pathname = window.location.pathname;
        baseUrl = `${origin}${pathname}`;
      }
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const pairingUrl = `${cleanBase}#sync=${encodeURIComponent(sessionId)}&key=${encodeURIComponent(keyBase64)}&role=peer`;

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

      // 4. Start WebRtcSyncService in host mode with active workspace details
      const activeWs = useWorkspaceStore.getState().getActiveWorkspace();
      const signalingUrl = get().customSignalingUrl || DEFAULT_SIGNALING_URL;
      const service = new WebRtcSyncService(
        sessionId,
        key,
        'host',
        signalingUrl,
        (state, error) => {
          if (activeSyncService === service) {
            set({ syncState: state, error: error || null });
          }
        },
        (progress) => {
          if (activeSyncService === service) {
            set({ progress });
          }
        },
        {
          workspaceId: activeWs?.id,
          workspaceName: activeWs?.name,
        }
      );

      activeSyncService = service;
      const report = await service.start();
      if (activeSyncService === service) {
        set({ lastReport: report, syncState: 'completed' });
      }
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
      let hash = pairingInput.trim();
      if (hash.includes('#')) {
        hash = hash.split('#')[1];
      } else if (hash.includes('?')) {
        hash = hash.split('?')[1];
      }
      if (hash.startsWith('/')) {
        hash = hash.slice(1);
      }

      const params = new URLSearchParams(hash);
      const sessionId = params.get('sync');
      const keyBase64 = params.get('key');

      if (!sessionId || !keyBase64) {
        throw new Error('Geçersiz eşleşme QR kodu veya bağlantısı: Oturum ID veya şifreleme anahtarı eksik.');
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
          if (activeSyncService === service) {
            set({ syncState: state, error: error || null });
          }
        },
        (progress) => {
          if (activeSyncService === service) {
            set({ progress });
          }
        },
        {
          onRemoteManifestReceived: async (remoteManifest) => {
            const remoteName = remoteManifest.workspaceName || 'Senkronize Edilen Notlar';
            const { workspaces, switchWorkspace, createWorkspace } = useWorkspaceStore.getState();
            const isFSA = isFileSystemAccessSupported() && !isTauriEnvironment();

            const existingWs = workspaces.find(
              (w) => w.name.trim().toLowerCase() === remoteName.trim().toLowerCase()
            );

            if (isFSA) {
              // Desktop FSA: check if an existing workspace with valid handle is available
              let hasValidHandle = false;
              if (existingWs && existingWs.storageType === 'browser') {
                const handle = await workspaceManager.getDirectoryHandle(existingWs.id);
                if (handle) {
                  try {
                    const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
                    if (perm === 'granted') hasValidHandle = true;
                  } catch {}
                }
              }

              if (hasValidHandle && existingWs) {
                await switchWorkspace(existingWs.id);
                return;
              }

              // Prompt user to pick a folder via native dialog
              return new Promise<void>((resolve, reject) => {
                set({
                  pendingWorkspacePrompt: {
                    remoteWorkspaceName: remoteName,
                    remoteWorkspaceId: remoteManifest.workspaceId,
                    hasExistingWorkspace: !!existingWs,
                    needsDirectoryPicker: true,
                    existingWorkspaceId: existingWs?.id,
                  },
                });

                workspacePromptResolver = async (action) => {
                  try {
                    if (action === 'pick_directory') {
                      const newWs = await useWorkspaceStore.getState().createBrowserWorkspace();
                      if (!newWs) throw new Error('Klasör seçimi yapılmadı.');
                    }
                    set({ pendingWorkspacePrompt: null });
                    resolve();
                  } catch (e) {
                    set({ pendingWorkspacePrompt: null });
                    reject(e);
                  }
                };
              });
            } else {
              // IndexedDB / Mobile
              if (!existingWs) {
                // Auto-create matching workspace seamlessly
                await createWorkspace({
                  name: remoteName,
                  storageType: 'indexeddb',
                });
                return;
              }

              // Workspace with same name already exists: prompt merge vs new
              return new Promise<void>((resolve, reject) => {
                set({
                  pendingWorkspacePrompt: {
                    remoteWorkspaceName: remoteName,
                    remoteWorkspaceId: remoteManifest.workspaceId,
                    hasExistingWorkspace: true,
                    needsDirectoryPicker: false,
                    existingWorkspaceId: existingWs.id,
                  },
                });

                workspacePromptResolver = async (action) => {
                  try {
                    if (action === 'merge') {
                      await switchWorkspace(existingWs.id);
                    } else if (action === 'create_new') {
                      await createWorkspace({
                        name: `${remoteName} (Kopya)`,
                        storageType: 'indexeddb',
                      });
                    }
                    set({ pendingWorkspacePrompt: null });
                    resolve();
                  } catch (e) {
                    set({ pendingWorkspacePrompt: null });
                    reject(e);
                  }
                };
              });
            }
          },
        }
      );

      activeSyncService = service;
      const report = await service.start();
      if (activeSyncService === service) {
        set({ lastReport: report, syncState: 'completed' });
      }
    } catch (err: any) {
      console.error('[SyncStore] Peer session error:', err);
      set({
        syncState: 'error',
        error: err?.message || 'Failed to connect to host peer',
      });
    }
  },

  resolveWorkspacePrompt: async (action) => {
    if (workspacePromptResolver) {
      await workspacePromptResolver(action);
    }
  },

  cancelSync: () => {
    if (activeSyncService) {
      const s = activeSyncService;
      activeSyncService = null;
      s.cancel();
    }
    workspacePromptResolver = null;
    set({
      syncState: 'idle',
      role: null,
      pairingUrl: null,
      qrCodeDataUrl: null,
      progress: null,
      error: null,
      pendingWorkspacePrompt: null,
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
