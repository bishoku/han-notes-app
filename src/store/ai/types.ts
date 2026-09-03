import {
  type AiSettings,
  type ChatSession,
  PROVIDER_PRESETS,
} from '@/services/ai/types';

export const STORAGE_KEY_SETTINGS = 'han_ai_settings_v1';
export const STORAGE_KEY_SESSIONS = 'han_ai_sessions_v2';
export const STORAGE_KEY_ACTIVE_NOTE_MAP = 'han_ai_active_sessions_by_note_v2';

export const DEFAULT_SETTINGS: AiSettings = {
  enabled: false,
  provider: 'openrouter',
  apiKey: '',
  baseUrl: PROVIDER_PRESETS.openrouter.defaultBaseUrl,
  model: PROVIDER_PRESETS.openrouter.defaultModel,
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: 'Sen HAN not defteri yapay zeka asistanısın. Notları dikkatle analiz et ve doğrudan notlardaki gerçeklere dayanarak zengin ve düzenli Markdown formatında (alt başlıklar, madde işaretleri, kalın vurgular, tablolar) net, profesyonel yanıtlar ver.',
  embeddingModel: 'Xenova/multilingual-e5-small',
};

export interface AiState {
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

export function persistSessions(sessions: ChatSession[], activeMap: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    localStorage.setItem(STORAGE_KEY_ACTIVE_NOTE_MAP, JSON.stringify(activeMap));
  } catch (err) {
    console.error('Failed to persist AI sessions:', err);
  }
}
