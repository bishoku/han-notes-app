/**
 * llmClient.ts — Unified multi-provider streaming LLM client with Reasoning Extraction.
 * Supports OpenRouter, Gemini, Anthropic, OpenAI, Ollama, and Custom/On-Prem vLLM (Qwen, DeepSeek).
 */
import type { AiSettings } from './types';
import { ReasoningStreamParser } from './reasoningParser';

export interface StreamChatResult {
  content: string;
  reasoning: string;
  hasReasoning: boolean;
  thinkingTimeMs?: number;
}

export class LlmClient {
  /**
   * Tests API connection with a minimal prompt.
   */
  public async testConnection(settings: AiSettings): Promise<{ success: boolean; message: string }> {
    try {
      let testOutput = '';
      await this.streamChat(
        settings,
        [{ role: 'user', content: 'Cevap olarak sadece "HAN_OK" yaz.' }],
        (chunk) => {
          testOutput += chunk;
        }
      );

      if (testOutput.trim()) {
        return { success: true, message: `Bağlantı başarılı! Model: ${settings.model}` };
      }
      return { success: false, message: 'Modelden yanıt alınamadı.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Bağlantı hatası oluştu.' };
    }
  }

  /**
   * Streams chat completions across different provider protocols.
   * Extracts reasoning / thinking tokens into separate callbacks.
   */
  public async streamChat(
    settings: AiSettings,
    messages: { role: string; content: string }[],
    onChunk: (cleanContentChunk: string) => void,
    onReasoningChunk?: (reasoningChunk: string) => void,
    signal?: AbortSignal
  ): Promise<StreamChatResult> {
    const { provider, apiKey, baseUrl, model, temperature } = settings;
    const parser = new ReasoningStreamParser();

    if (provider === 'gemini') {
      return this.streamGemini(baseUrl, apiKey, model, messages, temperature, parser, onChunk, onReasoningChunk, signal);
    } else if (provider === 'anthropic') {
      return this.streamAnthropic(baseUrl, apiKey, model, messages, temperature, parser, onChunk, onReasoningChunk, signal);
    } else if (provider === 'ollama') {
      return this.streamOllama(baseUrl, model, messages, temperature, parser, onChunk, onReasoningChunk, signal);
    } else {
      // Default: OpenAI / OpenRouter / Custom compatible endpoint (vLLM, LM Studio, Qwen)
      return this.streamOpenAiCompatible(baseUrl, apiKey, model, messages, temperature, provider, parser, onChunk, onReasoningChunk, signal);
    }
  }

  // ── OpenRouter & OpenAI & Custom & vLLM ──────────────────────────────────

  private async streamOpenAiCompatible(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: { role: string; content: string }[],
    temperature: number,
    provider: string,
    parser: ReasoningStreamParser,
    onChunk: (text: string) => void,
    onReasoningChunk?: (text: string) => void,
    signal?: AbortSignal
  ): Promise<StreamChatResult> {
    const url = baseUrl.endsWith('/chat/completions')
      ? baseUrl
      : `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://han-notes.app';
      headers['X-Title'] = 'HAN Notes';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.7,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Hatası (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response stream reader could not be created.');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta;
            if (!delta) continue;

            // 1. Explicit reasoning fields from DeepSeek, OpenRouter, vLLM
            const explicitReasoning = delta.reasoning_content || delta.reasoning || delta.thought || '';
            if (explicitReasoning) {
              const { reasoningDelta } = parser.feed(explicitReasoning, true);
              if (reasoningDelta && onReasoningChunk) {
                onReasoningChunk(reasoningDelta);
              }
            }

            // 2. Main content (may contain inline <think> tags from Qwen/Ollama)
            const contentChunk = delta.content || '';
            if (contentChunk) {
              const { reasoningDelta, contentDelta } = parser.feed(contentChunk, false);
              if (reasoningDelta && onReasoningChunk) {
                onReasoningChunk(reasoningDelta);
              }
              if (contentDelta) {
                onChunk(contentDelta);
              }
            }
          } catch {
            // Partial JSON slice, continue
          }
        }
      }
    }

    return parser.getResult();
  }

  // ── Google Gemini ─────────────────────────────────────────────────────────

  private async streamGemini(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: { role: string; content: string }[],
    temperature: number,
    parser: ReasoningStreamParser,
    onChunk: (text: string) => void,
    onReasoningChunk?: (text: string) => void,
    signal?: AbortSignal
  ): Promise<StreamChatResult> {
    const cleanModel = model.replace(/^models\//, '');
    const url = `${baseUrl.replace(/\/+$/, '')}/models/${cleanModel}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemMsg = messages.find((m) => m.role === 'system');
    const systemInstruction = systemMsg
      ? { parts: [{ text: systemMsg.content }] }
      : undefined;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          temperature: temperature ?? 0.7,
        },
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Hatası (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response stream reader could not be created.');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const parts = data.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.thought) {
                const { reasoningDelta } = parser.feed(part.thought, true);
                if (reasoningDelta && onReasoningChunk) onReasoningChunk(reasoningDelta);
              }
              if (part.text) {
                const { reasoningDelta, contentDelta } = parser.feed(part.text, false);
                if (reasoningDelta && onReasoningChunk) onReasoningChunk(reasoningDelta);
                if (contentDelta) onChunk(contentDelta);
              }
            }
          } catch {
            // Partial JSON slice
          }
        }
      }
    }

    return parser.getResult();
  }

  // ── Anthropic Claude ──────────────────────────────────────────────────────

  private async streamAnthropic(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: { role: string; content: string }[],
    temperature: number,
    parser: ReasoningStreamParser,
    onChunk: (text: string) => void,
    onReasoningChunk?: (text: string) => void,
    signal?: AbortSignal
  ): Promise<StreamChatResult> {
    const url = `${baseUrl.replace(/\/+$/, '')}/messages`;

    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true',
      },
      body: JSON.stringify({
        model,
        messages: chatMessages,
        system: systemMsg?.content,
        max_tokens: 4096,
        temperature: temperature ?? 0.7,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API Hatası (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response stream reader could not be created.');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.type === 'content_block_delta') {
            const delta = data.delta;
            if (delta?.type === 'thinking_delta' && delta.thinking) {
              const { reasoningDelta } = parser.feed(delta.thinking, true);
              if (reasoningDelta && onReasoningChunk) onReasoningChunk(reasoningDelta);
            } else if (delta?.text) {
              const { reasoningDelta, contentDelta } = parser.feed(delta.text, false);
              if (reasoningDelta && onReasoningChunk) onReasoningChunk(reasoningDelta);
              if (contentDelta) onChunk(contentDelta);
            }
          }
        } catch {
          // Partial JSON
        }
      }
    }

    return parser.getResult();
  }

  // ── Ollama Local ──────────────────────────────────────────────────────────

  private async streamOllama(
    baseUrl: string,
    model: string,
    messages: { role: string; content: string }[],
    temperature: number,
    parser: ReasoningStreamParser,
    onChunk: (text: string) => void,
    onReasoningChunk?: (text: string) => void,
    signal?: AbortSignal
  ): Promise<StreamChatResult> {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        options: {
          temperature: temperature ?? 0.7,
        },
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama Hatası (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response stream reader could not be created.');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed);
          const explicitReasoning = data.message?.reasoning || '';
          if (explicitReasoning) {
            const { reasoningDelta } = parser.feed(explicitReasoning, true);
            if (reasoningDelta && onReasoningChunk) onReasoningChunk(reasoningDelta);
          }

          const contentChunk = data.message?.content || '';
          if (contentChunk) {
            const { reasoningDelta, contentDelta } = parser.feed(contentChunk, false);
            if (reasoningDelta && onReasoningChunk) onReasoningChunk(reasoningDelta);
            if (contentDelta) onChunk(contentDelta);
          }
        } catch {
          // Partial JSON
        }
      }
    }

    return parser.getResult();
  }
}

export const llmClient = new LlmClient();
