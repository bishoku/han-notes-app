import { ragService, type ActiveNoteContext, type AttachedNoteContext } from '@/services/ai/ragService';
import { storage } from '@/services/storage';
import { useNoteStore } from '@/store/noteStore';
import type { ChatMessage, ChatSession } from '@/services/ai/types';
import { type AiState, persistSessions } from './types';

export const createChatSlice = (
  set: (partial: Partial<AiState> | ((state: AiState) => Partial<AiState>)) => void,
  get: () => AiState
) => ({
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

      let accumulatedContent = '';
      let accumulatedReasoning = '';
      let isThinking = false;
      let rafId: number | null = null;

      const scheduleFlush = () => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          set((state) => {
            const currentSessions = state.sessions.map((s) => {
              if (s.id === targetSession!.id) {
                const msgs = s.messages.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content: accumulatedContent,
                        reasoning: accumulatedReasoning,
                        isThinking,
                      }
                    : m
                );
                return { ...s, messages: msgs };
              }
              return s;
            });
            return { sessions: currentSessions };
          });
        });
      };

      const { response, reasoning, thinkingTimeMs, citations } = await ragService.query(
        text.trim(),
        settings,
        chatHistory,
        activeNoteContext,
        extraNotesContext,
        (contentChunk) => {
          accumulatedContent += contentChunk;
          isThinking = false;
          scheduleFlush();
        },
        (reasoningChunk) => {
          accumulatedReasoning += reasoningChunk;
          isThinking = true;
          scheduleFlush();
        },
        controller.signal
      );

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      // Final update with citations & reasoning metadata
      set((state) => {
        const finalSessions = state.sessions.map((s) => {
          if (s.id === targetSession!.id) {
            const msgs = s.messages.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: response,
                    reasoning: reasoning || accumulatedReasoning,
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
});
