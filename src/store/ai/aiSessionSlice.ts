import { useNoteStore } from '@/store/noteStore';
import type { ChatSession } from '@/services/ai/types';
import { type AiState, persistSessions } from './types';

export const createSessionSlice = (
  set: (partial: Partial<AiState> | ((state: AiState) => Partial<AiState>)) => void,
  get: () => AiState
) => ({
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
});
