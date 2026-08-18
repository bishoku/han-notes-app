/**
 * ragService.ts — Retrieval-Augmented Generation query execution service.
 * Connects user query, local vector store search, active note content,
 * manually attached notes, graph relationships, and dynamic multi-turn LLM generation.
 */
import { embeddingService } from './embeddingService';
import { vectorStore } from './vectorStore';
import { llmClient } from './llmClient';
import { indexingCoordinator } from './indexingCoordinator';
import { useGraphStore } from '@/store/graphStore';
import { useUiStore } from '@/store/uiStore';
import type { AiSettings, Citation } from './types';

export interface ActiveNoteContext {
  id: string;
  title: string;
  content: string;
}

export interface AttachedNoteContext {
  id: string;
  title: string;
  content: string;
}

export class RagService {
  /**
   * Executes a complete RAG workflow:
   * 1. Injects currently open active note [Source 1] (if any)
   * 2. Injects manually attached user notes [Source 2..N] with full content
   * 3. Embeds query and searches similar semantic chunks from vault (excluding active & attached notes)
   * 4. Fetches graph connections for extra context
   * 5. Synthesizes context with language-aware citation markers & system prompts
   * 6. Streams multi-turn LLM response
   */
  public async query(
    userQuery: string,
    settings: AiSettings,
    chatHistory: { role: string; content: string }[] = [],
    activeNote?: ActiveNoteContext,
    extraNotes?: AttachedNoteContext[],
    onChunk?: (text: string) => void,
    onReasoningChunk?: (text: string) => void,
    signal?: AbortSignal
  ): Promise<{ response: string; reasoning: string; hasReasoning: boolean; thinkingTimeMs?: number; citations: Citation[] }> {
    const isEnglish = useUiStore.getState().language === 'en';
    const citations: Citation[] = [];
    const contextBlocks: string[] = [];
    let citationCounter = 1;

    // Set of note IDs to exclude from duplicate RAG chunk search
    const excludedNoteIds = new Set<string>();

    // 1. If an active note is open on screen, provide it as primary Source
    if (activeNote && activeNote.content.trim()) {
      excludedNoteIds.add(activeNote.id);
      const activeCitationIndex = citationCounter++;
      citations.push({
        noteId: activeNote.id,
        title: activeNote.title,
        heading: isEnglish ? 'Active Note' : 'Açık Not',
        snippet: activeNote.content.slice(0, 160) + (activeNote.content.length > 160 ? '...' : ''),
      });

      const sourceLabel = isEnglish
        ? `[Source ${activeCitationIndex}] (Currently Open Active Note on Screen)\nTitle: ${activeNote.title}\nFile: ${activeNote.id}\nContent:\n${activeNote.content}`
        : `[Kaynak ${activeCitationIndex}] (Şu Anda Ekranda Açık Olan Not)\nBaşlık: ${activeNote.title}\nDosya: ${activeNote.id}\nİçerik:\n${activeNote.content}`;

      contextBlocks.push(sourceLabel);
    }

    // 2. If user manually attached additional notes to context, inject their FULL content
    if (extraNotes && extraNotes.length > 0) {
      for (const extra of extraNotes) {
        if (!extra.content.trim()) continue;
        excludedNoteIds.add(extra.id);
        const extraCitationIndex = citationCounter++;
        citations.push({
          noteId: extra.id,
          title: extra.title,
          heading: isEnglish ? 'Attached Note' : 'Ekli Not',
          snippet: extra.content.slice(0, 160) + (extra.content.length > 160 ? '...' : ''),
        });

        const extraLabel = isEnglish
          ? `[Source ${extraCitationIndex}] (User-Attached Reference Note)\nTitle: ${extra.title}\nFile: ${extra.id}\nContent:\n${extra.content}`
          : `[Kaynak ${extraCitationIndex}] (Kullanıcının Manuel Eklediği Referans Notu)\nBaşlık: ${extra.title}\nDosya: ${extra.id}\nİçerik:\n${extra.content}`;

        contextBlocks.push(extraLabel);
      }
    }

    // Flush any pending note edits into the vector store before embedding query to ensure 100% freshness
    try {
      await indexingCoordinator.flushPendingNotes();
    } catch (flushErr) {
      console.warn('Pre-query flush failed, proceeding with existing vector index:', flushErr);
    }

    // 3. Embed query & Search Similar Chunks from Vector Store
    let queryVector: number[] = [];
    try {
      queryVector = await embeddingService.embedQuery(userQuery);
    } catch (e) {
      console.warn('Embedding query failed, falling back to direct LLM response:', e);
    }

    const searchResults = queryVector.length > 0
      ? await vectorStore.searchSimilar(queryVector, 8, 0.18)
      : [];

    const { nodes } = useGraphStore.getState();

    // 4. Assemble additional chunks (excluding duplicate active & manually attached notes)
    for (let i = 0; i < searchResults.length; i++) {
      const { chunk } = searchResults[i];
      if (excludedNoteIds.has(chunk.noteId)) {
        // Skip since we already included the full note content above
        continue;
      }
      excludedNoteIds.add(chunk.noteId);

      if (citationCounter > 6) break; // Limit to 6 total sources for crisp, high-token context

      const citationIndex = citationCounter++;
      citations.push({
        noteId: chunk.noteId,
        title: chunk.title,
        heading: chunk.heading,
        snippet: chunk.content.slice(0, 160) + (chunk.content.length > 160 ? '...' : ''),
      });

      // Find graph connections for extra context
      const graphNode = nodes.find((n) => n.id === chunk.noteId);
      const connectionsInfo = graphNode && graphNode.outgoingLinks.length > 0
        ? isEnglish
          ? ` (Connected Notes: ${graphNode.outgoingLinks.slice(0, 3).join(', ')})`
          : ` (Bağlantılı Notlar: ${graphNode.outgoingLinks.slice(0, 3).join(', ')})`
        : '';

      const chunkLabel = isEnglish
        ? `[Source ${citationIndex}] Note: ${chunk.title}${chunk.heading ? ` > ${chunk.heading}` : ''}${connectionsInfo}\n${chunk.content}`
        : `[Kaynak ${citationIndex}] Not: ${chunk.title}${chunk.heading ? ` > ${chunk.heading}` : ''}${connectionsInfo}\n${chunk.content}`;

      contextBlocks.push(chunkLabel);
    }

    // 5. Build Language-Specific Context & Formatting Instructions
    let activeNoteHint = '';
    if (activeNote) {
      activeNoteHint = isEnglish
        ? `\nIMPORTANT: The note currently open on the user's screen is: "${activeNote.title}" ([Source 1]). When the user says "this note", "this document", "open note" or asks for a general question/summary, prioritize directly the current content in [Source 1].\n`
        : `\nÖNEMLİ: Kullanıcının şu anda ekranında açık olan aktif not: "${activeNote.title}" ([Kaynak 1]). Kullanıcı "bu not", "bu doküman", "açık not" veya benzeri bir ifade kullandığında veya genel bir özet/soru sorduğunda öncelikle doğrudan [Kaynak 1]'deki güncel içeriği dikkate al.\n`;
    }

    let contextPrompt = '';
    if (contextBlocks.length > 0) {
      contextPrompt = isEnglish
        ? `Below are relevant note excerpts and attached reference documents retrieved from the user's notebook (HAN Vault):${activeNoteHint}\n\n` +
          contextBlocks.join('\n\n---\n\n')
        : `Aşağıda kullanıcının not defterinden çekilen ilgili notlar ve ekli referans dokümanları yer almaktadır:${activeNoteHint}\n\n` +
          contextBlocks.join('\n\n---\n\n');
    } else {
      contextPrompt = isEnglish
        ? 'No directly matching notes were found in the notebook for this query. Assist using your general knowledge.'
        : 'Not defterinde bu soruyla doğrudan eşleşen bir not bulunamadı. Genel bilginle yardımcı ol.';
    }

    const formattingInstruction = isEnglish
      ? `\n\nFORMATTING & LANGUAGE RULES:\n- Always respond in rich, hierarchical, and visually well-structured GitHub-flavored Markdown.\n- Use subheadings (###), bullet points (-), numbered lists (1.), bold text (**text**), tables, and code blocks (\`\`\`lang ... \`\`\`) where helpful.\n- Cite references using exact source numbers like [1], [2]. Do NOT format numbers as wikilinks like [[1]]. When referencing notes by name, you may use [[Note Title]].\n- REASONING RULE: If you perform reasoning or thinking, wrap your entire thinking process inside <think>...</think> tags. Never output thinking headers in natural language such as "Here's a thinking process:" or transition markers like "*Output Generation*" or "[Done.]".\n- LANGUAGE DIRECTIVE: You MUST respond in ENGLISH to match the user's application language.`
      : `\n\nFORMATLAMA & DİL KURALLARI:\n- Cevaplarını daima zengin, hiyerarşik ve görsel olarak düzenli GitHub-flavored Markdown formatında ver.\n- Gerektiğinde alt başlıklar (###), madde işaretleri (-), numaralandırılmış listeler (1.), kalın vurgular (**metin**), tablolar ve kod blokları (\`\`\`dil ... \`\`\`) kullan.\n- Bilgi aldığın kaynaklara [1], [2] şeklinde kaynak numaralarıyla atıf yap. Asla [[1]] şeklinde wikilink formatında yazma. Bir nota doğrudan ismiyle atıf yapacaksan [[Not Başlığı]] kullanabilirsin.\n- DÜŞÜNCE / REASONING KURALI: Düşünce veya akıl yürütme yapıyorsan, tüm düşünce sürecini daima <think>...</think> etiketleri içerisine al. "Here's a thinking process:" gibi serbest metin başlıkları veya "*Output Generation*" / "[Done.]" gibi geçiş etiketleri üretme.\n- DİL KURALI: Cevaplarını TÜRKÇE olarak ver.`;

    const defaultRolePrompt = isEnglish
      ? 'You are the HAN (Hierarchical Adaptive Notebook) AI assistant. Carefully analyze the user\'s notes, answer questions, and cite relationships accurately.'
      : 'Sen HAN (Hierarchical Adaptive Notebook) yapay zeka asistanısın. Notları dikkatle analiz eder, soruları yanıtlar ve kaynaklara atıf yaparsın.';

    const systemMessage = {
      role: 'system',
      content: `${settings.systemPrompt || defaultRolePrompt}\n\n${contextPrompt}${formattingInstruction}`,
    };

    const messagesToSend = [
      systemMessage,
      ...chatHistory.slice(-10), // Keep last 5 turns of conversation for rich continuity
      { role: 'user', content: userQuery },
    ];

    let fullResponse = '';
    let fullReasoning = '';
    const result = await llmClient.streamChat(
      settings,
      messagesToSend,
      (chunk) => {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      },
      (reasoningChunk) => {
        fullReasoning += reasoningChunk;
        if (onReasoningChunk) {
          onReasoningChunk(reasoningChunk);
        }
      },
      signal
    );

    return {
      response: result.content || fullResponse,
      reasoning: result.reasoning || fullReasoning,
      hasReasoning: result.hasReasoning || fullReasoning.trim().length > 0,
      thinkingTimeMs: result.thinkingTimeMs,
      citations,
    };
  }
}

export const ragService = new RagService();
