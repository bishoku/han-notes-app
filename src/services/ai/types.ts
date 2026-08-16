/**
 * types.ts — Core TypeScript definitions for HAN AI, RAG & LLM Integration.
 */

export type AiProvider = 'openrouter' | 'gemini' | 'anthropic' | 'openai' | 'ollama' | 'custom';

export interface AiSettings {
  enabled: boolean;
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  embeddingModel: string;
}

export interface VectorChunk {
  id: string; // e.g. "projects/alpha#chunk-0"
  noteId: string;
  title: string;
  heading: string;
  content: string;
  hash: string;
  vector?: number[];
}

export interface Citation {
  noteId: string;
  title: string;
  heading?: string;
  snippet: string;
}

export interface SearchResult {
  chunk: VectorChunk;
  similarity: number;
  connectedBacklinks?: string[];
  relatedDecisions?: string[];
}

export interface AttachedNoteRef {
  id: string; // File path / note ID (e.g. 'docs/database.md')
  title: string;
}

export interface ChatMessage {
  id: string;
  sessionId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  citations?: Citation[];
  error?: boolean;
}

export interface ChatSession {
  id: string;
  noteId: string | null; // null for global/workspace chat, string for note-specific chat
  title: string;
  createdAt: number;
  updatedAt: number;
  attachedNoteIds: string[];
  messages: ChatMessage[];
}

export interface ProviderPreset {
  id: AiProvider;
  name: string;
  defaultBaseUrl: string;
  defaultModel: string;
  recommendedModels: { id: string; name: string; description: string }[];
  requiresApiKey: boolean;
  docUrl: string;
}

export const PROVIDER_PRESETS: Record<AiProvider, ProviderPreset> = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter (Tüm Modeller)',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.0-flash-001',
    recommendedModels: [
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', description: 'Ultra hızlı ve zeki' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Gelişmiş akıl yürütme' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', description: 'Yüksek kalite ve ekonomik' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Güçlü açık kaynak model' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Hızlı ve dengeli' },
    ],
    requiresApiKey: true,
    docUrl: 'https://openrouter.ai/keys',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    recommendedModels: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Yeni nesil çok hızlı model' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Geniş bağlam penceresi' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Derin analiz ve karmaşık muhakeme' },
    ],
    requiresApiKey: true,
    docUrl: 'https://aistudio.google.com/app/apikey',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    recommendedModels: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'En yetenekli model' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Ultra hızlı ve hafif' },
    ],
    requiresApiKey: true,
    docUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    recommendedModels: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Hızlı ve uygun maliyetli' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'En güçlü çok modlu model' },
      { id: 'o3-mini', name: 'o3-mini', description: 'Gelişmiş akıl yürütme modeli' },
    ],
    requiresApiKey: true,
    docUrl: 'https://platform.openai.com/api-keys',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Lokal / Çevrimdışı)',
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    recommendedModels: [
      { id: 'llama3.2', name: 'Llama 3.2 (3B)', description: 'Hızlı, hafif ve yerel' },
      { id: 'qwen2.5', name: 'Qwen 2.5 (7B)', description: 'Çok dilli ve zeki' },
      { id: 'mistral', name: 'Mistral (7B)', description: 'Dengeli açık kaynak' },
      { id: 'deepseek-r1:7b', name: 'DeepSeek R1 (7B)', description: 'Yerel düşünme ve akıl yürütme' },
    ],
    requiresApiKey: false,
    docUrl: 'https://ollama.com',
  },
  custom: {
    id: 'custom',
    name: 'Özel / OpenAI Uyumlu (Groq, LM Studio vb.)',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    recommendedModels: [
      { id: 'llama-3.3-70b-versatile', name: 'Groq Llama 3.3 70B', description: 'Işık hızında çıkarsama' },
      { id: 'deepseek-chat', name: 'DeepSeek API', description: 'Doğrudan DeepSeek endpoint' },
    ],
    requiresApiKey: true,
    docUrl: '',
  },
};
