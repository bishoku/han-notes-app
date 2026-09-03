import { encryptSecret, decryptSecret } from '@/services/ai/crypto';
import { indexingCoordinator } from '@/services/ai/indexingCoordinator';
import { embeddingService } from '@/services/ai/embeddingService';
import { vectorStore } from '@/services/ai/vectorStore';
import { useNoteStore } from '@/store/noteStore';
import type { AiSettings, ChatSession } from '@/services/ai/types';
import {
  type AiState,
  DEFAULT_SETTINGS,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_SESSIONS,
  STORAGE_KEY_ACTIVE_NOTE_MAP,
  persistSessions,
} from './types';

export const createSettingsSlice = (
  set: (partial: Partial<AiState> | ((state: AiState) => Partial<AiState>)) => void,
  get: () => AiState
) => ({
  initAiStore: async () => {
    // 1. Load Settings
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        const decryptedKey = parsed.encryptedKey ? await decryptSecret(parsed.encryptedKey) : '';
        set({
          settings: {
            ...DEFAULT_SETTINGS,
            ...parsed,
            apiKey: decryptedKey,
          },
        });
      }
    } catch (e) {
      console.warn('Failed to load AI settings:', e);
    }

    // 2. Load Sessions & Active Note Mapping
    let loadedSessions: ChatSession[] = [];
    let loadedActiveMap: Record<string, string> = {};
    try {
      const rawSessions = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (rawSessions) {
        loadedSessions = JSON.parse(rawSessions);
      }
      const rawActiveMap = localStorage.getItem(STORAGE_KEY_ACTIVE_NOTE_MAP);
      if (rawActiveMap) {
        loadedActiveMap = JSON.parse(rawActiveMap);
      }
    } catch (e) {
      console.warn('Failed to load AI sessions:', e);
    }

    // Connect to current active note in noteStore
    const currentNoteId = useNoteStore.getState().currentNoteId;
    const noteKey = currentNoteId || 'global';
    let initialSessionId = loadedActiveMap[noteKey];

    // Find session or create initial one if none exists
    const matchingSession = loadedSessions.find((s) => s.id === initialSessionId);
    if (!matchingSession) {
      const noteTitle = currentNoteId
        ? useNoteStore.getState().notes.find((n) => n.id === currentNoteId)?.title || currentNoteId
        : 'Genel Sohbet';
      const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newSession: ChatSession = {
        id: newSessionId,
        noteId: currentNoteId,
        title: `${noteTitle} - Yeni Sohbet`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attachedNoteIds: [],
        messages: [],
      };
      loadedSessions = [newSession, ...loadedSessions];
      loadedActiveMap[noteKey] = newSessionId;
      initialSessionId = newSessionId;
      persistSessions(loadedSessions, loadedActiveMap);
    }

    set({
      sessions: loadedSessions,
      currentSessionId: initialSessionId,
      activeSessionIdByNote: loadedActiveMap,
    });

    // 3. Connect progress callbacks
    indexingCoordinator.setProgressCallback((status) => {
      set({
        isIndexing: status.isIndexing,
        indexingProgress: { current: status.current, total: status.total },
      });
      if (!status.isIndexing) {
        get().refreshStats();
      }
    });

    embeddingService.setProgressCallback((progress, file) => {
      set({ modelDownloadProgress: { progress, file } });
      if (progress >= 100) {
        setTimeout(() => set({ modelDownloadProgress: null }), 1500);
      }
    });

    // 4. Embedding model migration
    const EMBEDDING_MODEL_KEY = 'han_ai_last_embedding_model';
    embeddingService.setModelResolvedCallback((actualModel: string) => {
      const lastUsedModel = localStorage.getItem(EMBEDDING_MODEL_KEY);

      if (lastUsedModel && lastUsedModel !== actualModel) {
        console.info(
          `[AI Migration] Embedding model changed: "${lastUsedModel}" → "${actualModel}". Purging vectors and re-indexing...`
        );
        indexingCoordinator.purgeAll().then(() => {
          const notes = useNoteStore.getState().notes;
          if (notes.length > 0) {
            indexingCoordinator.startVaultIndexing(notes);
          }
        });
      }

      localStorage.setItem(EMBEDDING_MODEL_KEY, actualModel);
    });

    await get().refreshStats();
  },

  updateSettings: async (partial: Partial<AiSettings>) => {
    const updated = { ...get().settings, ...partial };
    set({ settings: updated });

    try {
      const encryptedKey = updated.apiKey ? await encryptSecret(updated.apiKey) : '';
      const toPersist = {
        ...updated,
        apiKey: undefined, // Never store plaintext key
        encryptedKey,
      };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(toPersist));
    } catch (err) {
      console.error('Failed to persist AI settings:', err);
    }
  },

  toggleAiEnabled: async (enabled: boolean) => {
    await get().updateSettings({ enabled });

    if (enabled) {
      // First time activation: index the entire current vault
      const notes = useNoteStore.getState().notes;
      if (notes.length > 0) {
        indexingCoordinator.startVaultIndexing(notes);
      }
    } else {
      // Deactivation: clean up vector database and unload model
      await indexingCoordinator.purgeAll();
      await get().refreshStats();
    }
  },

  setChatDrawerOpen: (open: boolean) => {
    set({ isChatDrawerOpen: open });
  },

  reindexVault: async () => {
    const notes = useNoteStore.getState().notes;
    await indexingCoordinator.purgeAll();
    if (notes.length > 0) {
      indexingCoordinator.startVaultIndexing(notes);
    }
    await get().refreshStats();
  },

  purgeVectors: async () => {
    await indexingCoordinator.purgeAll();
    await get().refreshStats();
  },

  refreshStats: async () => {
    try {
      const stats = await vectorStore.getStats();
      set({ vectorStats: stats });
    } catch {
      // Ignored
    }
  },
});
