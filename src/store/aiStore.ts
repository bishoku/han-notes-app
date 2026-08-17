/**
 * aiStore.ts — Zustand store for AI Assistant, Multi-Session Management,
 * Note-Scoped Chat History, Attached Note Context, and Background Indexing.
 */
import { create } from 'zustand';
import { encryptSecret, decryptSecret } from '@/services/ai/crypto';
import { indexingCoordinator } from '@/services/ai/indexingCoordinator';
import { embeddingService } from '@/services/ai/embeddingService';
import { vectorStore } from '@/services/ai/vectorStore';
import { ragService, type ActiveNoteContext, type AttachedNoteContext } from '@/services/ai/ragService';
import { storage } from '@/services/storage';
import { useNoteStore } from '@/store/noteStore';
import {
  type AiSettings,
  type ChatMessage,
  type ChatSession,
  PROVIDER_PRESETS,
} from '@/services/ai/types';

const STORAGE_KEY_SETTINGS = 'han_ai_settings_v1';
const STORAGE_KEY_SESSIONS = 'han_ai_sessions_v2';
const STORAGE_KEY_ACTIVE_NOTE_MAP = 'han_ai_active_sessions_by_note_v2';

const DEFAULT_SETTINGS: AiSettings = {
  enabled: false,
  provider: 'openrouter',
  apiKey: '',
  baseUrl: PROVIDER_PRESETS.openrouter.defaultBaseUrl,
  model: PROVIDER_PRESETS.openrouter.defaultModel,
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: 'Sen HAN not defteri yapay zeka asistanısın. Notları dikkatle analiz et ve doğrudan notlardaki gerçeklere dayanarak zengin ve düzenli Markdown formatında (alt başlıklar, madde işaretleri, kalın vurgular, tablolar) net, profesyonel yanıtlar ver.',
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
};

interface AiState {
  settings: AiSettings;
  sessions: ChatSession[];
  currentSessionId: string | null;
  activeSessionIdByNote: Record<string, string>;

  isChatDrawerOpen: boolean;
  isStreaming: boolean;
  isIndexing: boolean;
  indexingProgress: { current: number; total: number };
  vectorStats: { totalChunks: number; totalNotes: number };
  modelDownloadProgress: { progress: number; file?: string } | null;
  abortController: AbortController | null;

  // Actions
  initAiStore: () => Promise<void>;
  updateSettings: (partial: Partial<AiSettings>) => Promise<void>;
  toggleAiEnabled: (enabled: boolean) => Promise<void>;
  setChatDrawerOpen: (open: boolean) => void;

  // Session & Note Scope Actions
  createSession: (noteId?: string | null, title?: string) => string;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newTitle: string) => void;
  attachNoteToSession: (sessionId: string, noteId: string) => void;
  detachNoteFromSession: (sessionId: string, noteId: string) => void;
  syncActiveNoteSession: (noteId: string | null) => void;

  // Chat Execution
  sendMessage: (text: string) => Promise<void>;
  stopStreaming: () => void;
  clearChat: () => void;
  reindexVault: () => Promise<void>;
  purgeVectors: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

function persistSessions(sessions: ChatSession[], activeMap: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    localStorage.setItem(STORAGE_KEY_ACTIVE_NOTE_MAP, JSON.stringify(activeMap));
  } catch (err) {
    console.error('Failed to persist AI sessions:', err);
  }
}

export const useAiStore = create<AiState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  sessions: [],
  currentSessionId: null,
  activeSessionIdByNote: {},

  isChatDrawerOpen: false,
  isStreaming: false,
  isIndexing: false,
  indexingProgress: { current: 0, total: 0 },
  vectorStats: { totalChunks: 0, totalNotes: 0 },
  modelDownloadProgress: null,
  abortController: null,

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

  // ─── Session Management Actions ───────────────────────────────────

  createSession: (noteId?: string | null, title?: string) => {
    const currentNoteId = noteId !== undefined ? noteId : useNoteStore.getState().currentNoteId;
    const noteKey = currentNoteId || 'global';
    const noteTitle = currentNoteId
      ? useNoteStore.getState().notes.find((n) => n.id === currentNoteId)?.title || currentNoteId
      : 'Genel Sohbet';

    const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newSession: ChatSession = {
      id: newSessionId,
      noteId: currentNoteId,
      title: title || `${noteTitle} - Yeni Sohbet`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attachedNoteIds: [],
      messages: [],
    };

    const updatedSessions = [newSession, ...get().sessions];
    const updatedMap = { ...get().activeSessionIdByNote, [noteKey]: newSessionId };

    set({
      sessions: updatedSessions,
      currentSessionId: newSessionId,
      activeSessionIdByNote: updatedMap,
    });

    persistSessions(updatedSessions, updatedMap);
    return newSessionId;
  },

  switchSession: (sessionId: string) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const noteKey = session.noteId || 'global';
    const updatedMap = { ...get().activeSessionIdByNote, [noteKey]: sessionId };

    set({
      currentSessionId: sessionId,
      activeSessionIdByNote: updatedMap,
    });
    persistSessions(get().sessions, updatedMap);
  },

  deleteSession: (sessionId: string) => {
    const { sessions, currentSessionId, activeSessionIdByNote } = get();
    const sessionToDelete = sessions.find((s) => s.id === sessionId);
    if (!sessionToDelete) return;

    const remainingSessions = sessions.filter((s) => s.id !== sessionId);
    const noteKey = sessionToDelete.noteId || 'global';
    const updatedMap = { ...activeSessionIdByNote };

    let newCurrentSessionId = currentSessionId;
    if (currentSessionId === sessionId) {
      // Find another session for the same note, or create a fresh one
      const siblingSession = remainingSessions.find((s) => s.noteId === sessionToDelete.noteId);
      if (siblingSession) {
        newCurrentSessionId = siblingSession.id;
        updatedMap[noteKey] = siblingSession.id;
      } else {
        const noteTitle = sessionToDelete.noteId
          ? useNoteStore.getState().notes.find((n) => n.id === sessionToDelete.noteId)?.title || sessionToDelete.noteId
          : 'Genel Sohbet';
        const freshId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const freshSession: ChatSession = {
          id: freshId,
          noteId: sessionToDelete.noteId,
          title: `${noteTitle} - Yeni Sohbet`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          attachedNoteIds: [],
          messages: [],
        };
        remainingSessions.unshift(freshSession);
        newCurrentSessionId = freshId;
        updatedMap[noteKey] = freshId;
      }
    }

    set({
      sessions: remainingSessions,
      currentSessionId: newCurrentSessionId,
      activeSessionIdByNote: updatedMap,
    });

    persistSessions(remainingSessions, updatedMap);
  },

  renameSession: (sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    const updatedSessions = get().sessions.map((s) =>
      s.id === sessionId ? { ...s, title: newTitle.trim(), updatedAt: Date.now() } : s
    );
    set({ sessions: updatedSessions });
    persistSessions(updatedSessions, get().activeSessionIdByNote);
  },

  attachNoteToSession: (sessionId: string, noteId: string) => {
    const updatedSessions = get().sessions.map((s) => {
      if (s.id === sessionId) {
        if (s.attachedNoteIds.includes(noteId)) return s;
        return {
          ...s,
          attachedNoteIds: [...s.attachedNoteIds, noteId],
          updatedAt: Date.now(),
        };
      }
      return s;
    });
    set({ sessions: updatedSessions });
    persistSessions(updatedSessions, get().activeSessionIdByNote);
  },

  detachNoteFromSession: (sessionId: string, noteId: string) => {
    const updatedSessions = get().sessions.map((s) => {
      if (s.id === sessionId) {
        return {
          ...s,
          attachedNoteIds: s.attachedNoteIds.filter((id) => id !== noteId),
          updatedAt: Date.now(),
        };
      }
      return s;
    });
    set({ sessions: updatedSessions });
    persistSessions(updatedSessions, get().activeSessionIdByNote);
  },

  syncActiveNoteSession: (noteId: string | null) => {
    const { sessions, activeSessionIdByNote } = get();
    const noteKey = noteId || 'global';
    const existingSessionId = activeSessionIdByNote[noteKey];

    if (existingSessionId && sessions.some((s) => s.id === existingSessionId)) {
      set({ currentSessionId: existingSessionId });
      return;
    }

    // Try finding any existing session for this note
    const matchingSession = sessions.find((s) => s.noteId === noteId);
    if (matchingSession) {
      const updatedMap = { ...activeSessionIdByNote, [noteKey]: matchingSession.id };
      set({
        currentSessionId: matchingSession.id,
        activeSessionIdByNote: updatedMap,
      });
      persistSessions(sessions, updatedMap);
      return;
    }

    // Otherwise create a fresh session for this note
    get().createSession(noteId);
  },

  // ─── Chat Execution Actions ───────────────────────────────────────

  sendMessage: async (text: string) => {
    const { settings, sessions, currentSessionId } = get();
    if (!text.trim() || !currentSessionId) return;

    let targetSession = sessions.find((s) => s.id === currentSessionId);
    if (!targetSession) {
      const newId = get().createSession();
      targetSession = get().sessions.find((s) => s.id === newId)!;
    }

    const userMessageId = `msg_u_${Date.now()}`;
    const assistantMessageId = `msg_a_${Date.now()}`;

    const userMsg: ChatMessage = {
      id: userMessageId,
      sessionId: targetSession.id,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      sessionId: targetSession.id,
      role: 'assistant',
      content: '',
      reasoning: '',
      isThinking: false,
      timestamp: Date.now(),
    };

    // Auto-update session title from first prompt if it is default
    const isDefaultTitle = targetSession.title.includes('Yeni Sohbet') || targetSession.title.includes('New Conversation');
    const updatedTitle = (isDefaultTitle && targetSession.messages.length === 0)
      ? text.trim().slice(0, 32) + (text.trim().length > 32 ? '...' : '')
      : targetSession.title;

    const updatedMessages = [...targetSession.messages, userMsg, assistantPlaceholder];
    const sessionWithUserMsg: ChatSession = {
      ...targetSession,
      title: updatedTitle,
      updatedAt: Date.now(),
      messages: updatedMessages,
    };

    const newSessions = sessions.map((s) => (s.id === targetSession!.id ? sessionWithUserMsg : s));
    set({
      sessions: newSessions,
      isStreaming: true,
    });
    persistSessions(newSessions, get().activeSessionIdByNote);

    const controller = new AbortController();
    set({ abortController: controller });

    try {
      // 1. Build conversation history from target session
      const chatHistory = targetSession.messages.map((m) => ({ role: m.role, content: m.content }));

      // 2. Dynamically resolve currently open active note
      const noteStoreState = useNoteStore.getState();
      let activeNoteContext: ActiveNoteContext | undefined = undefined;
      if (noteStoreState.currentNoteId && noteStoreState.currentNoteContent) {
        const foundNote = noteStoreState.notes.find((n) => n.id === noteStoreState.currentNoteId);
        const title = foundNote?.title || noteStoreState.currentNoteId.split('/').pop() || noteStoreState.currentNoteId;
        activeNoteContext = {
          id: noteStoreState.currentNoteId,
          title,
          content: noteStoreState.currentNoteContent,
        };
      }

      // 3. Resolve full contents of manually attached notes
      const extraNotesContext: AttachedNoteContext[] = [];
      for (const attachedId of targetSession.attachedNoteIds) {
        if (activeNoteContext && attachedId === activeNoteContext.id) {
          // Avoid duplicate if it's already the active note
          continue;
        }
        try {
          const content = await storage.readNote(attachedId);
          const foundNote = noteStoreState.notes.find((n) => n.id === attachedId);
          const title = foundNote?.title || attachedId.split('/').pop() || attachedId;
          if (content.trim()) {
            extraNotesContext.push({
              id: attachedId,
              title,
              content,
            });
          }
        } catch (readErr) {
          console.warn(`Failed to read attached note ${attachedId}:`, readErr);
        }
      }

      const { response, reasoning, thinkingTimeMs, citations } = await ragService.query(
        text.trim(),
        settings,
        chatHistory,
        activeNoteContext,
        extraNotesContext,
        (contentChunk) => {
          set((state) => {
            const currentSessions = state.sessions.map((s) => {
              if (s.id === targetSession!.id) {
                const msgs = s.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: m.content + contentChunk, isThinking: false }
                    : m
                );
                return { ...s, messages: msgs };
              }
              return s;
            });
            return { sessions: currentSessions };
          });
        },
        (reasoningChunk) => {
          set((state) => {
            const currentSessions = state.sessions.map((s) => {
              if (s.id === targetSession!.id) {
                const msgs = s.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, reasoning: (m.reasoning || '') + reasoningChunk, isThinking: true }
                    : m
                );
                return { ...s, messages: msgs };
              }
              return s;
            });
            return { sessions: currentSessions };
          });
        },
        controller.signal
      );

      // Final update with citations & reasoning metadata
      set((state) => {
        const finalSessions = state.sessions.map((s) => {
          if (s.id === targetSession!.id) {
            const msgs = s.messages.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: response,
                    reasoning: reasoning || m.reasoning,
                    thinkingTimeMs,
                    isThinking: false,
                    citations,
                  }
                : m
            );
            return { ...s, messages: msgs, updatedAt: Date.now() };
          }
          return s;
        });
        persistSessions(finalSessions, state.activeSessionIdByNote);
        return { sessions: finalSessions, isStreaming: false, abortController: null };
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        set({ isStreaming: false, abortController: null });
        return;
      }
      set((state) => {
        const erroredSessions = state.sessions.map((s) => {
          if (s.id === targetSession!.id) {
            const msgs = s.messages.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: `Hata: ${err?.message || 'Yanıt alınırken bir sorun oluştu.'}`, error: true }
                : m
            );
            return { ...s, messages: msgs, updatedAt: Date.now() };
          }
          return s;
        });
        persistSessions(erroredSessions, state.activeSessionIdByNote);
        return { sessions: erroredSessions, isStreaming: false, abortController: null };
      });
    }
  },

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isStreaming: false });
    }
  },

  clearChat: () => {
    const { sessions, currentSessionId } = get();
    if (!currentSessionId) return;

    const updatedSessions = sessions.map((s) =>
      s.id === currentSessionId ? { ...s, messages: [], updatedAt: Date.now() } : s
    );
    set({ sessions: updatedSessions });
    persistSessions(updatedSessions, get().activeSessionIdByNote);
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
}));
