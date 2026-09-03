/**
 * aiStore.ts — Unified Zustand store for AI Assistant, Multi-Session Management,
 * Note-Scoped Chat History, Attached Note Context, and Background Indexing.
 *
 * Decomposed into modular slices under `src/store/ai/`.
 */
import { create } from 'zustand';
import {
  type AiState,
  DEFAULT_SETTINGS,
} from './ai/types';
import { createSettingsSlice } from './ai/aiSettingsSlice';
import { createSessionSlice } from './ai/aiSessionSlice';
import { createChatSlice } from './ai/aiChatSlice';

export type { AiState };

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

  ...createSettingsSlice(set, get),
  ...createSessionSlice(set, get),
  ...createChatSlice(set, get),
}));
