/**
 * reasoningParser.ts — Unified real-time streaming & batch reasoning parser.
 * Handles:
 * - Structured SSE delta fields (reasoning_content, reasoning, thought)
 * - XML/Inline tags (<think>...</think>, <thought>...</thought>, <|thought|>...<|endofthought|>, etc.)
 * - Prompt prefill implicit start tags (closing </think> only)
 * - Markdown thought blocks (```thought ... ```)
 * - Zero-leakage pure content extraction
 */

export interface ReasoningParseResult {
  reasoning: string;
  content: string;
  hasReasoning: boolean;
  isThinking: boolean;
  thinkingTimeMs?: number;
}

const OPEN_TAGS = [
  '<think>',
  '<thought>',
  '<thinking>',
  '<thinking_process>',
  '<|thought|>',
  '<|im_start|>thought',
  '```thought',
  '```thinking',
];

const CLOSE_TAGS = [
  '</think>',
  '</thought>',
  '</thinking>',
  '</thinking_process>',
  '<|/thought|>',
  '<|endofthought|>',
  '<|im_end|>',
  '```',
];

/**
 * Stateful streaming parser for LLM output.
 * Call `feed(chunk, isExplicitReasoningField)` on each token received.
 */
export class ReasoningStreamParser {
  private rawAccumulated = '';
  private reasoningAccumulated = '';
  private contentAccumulated = '';
  private inThinkingMode = false;
  private thinkingStartTime: number | null = null;
  private thinkingEndTime: number | null = null;

  public feed(chunk: string, isExplicitReasoning = false): {
    reasoningDelta: string;
    contentDelta: string;
    isThinking: boolean;
  } {
    if (!chunk) {
      return { reasoningDelta: '', contentDelta: '', isThinking: this.inThinkingMode };
    }

    // 1. Explicit SSE field (e.g. delta.reasoning_content or delta.reasoning)
    if (isExplicitReasoning) {
      if (!this.inThinkingMode) {
        this.inThinkingMode = true;
        this.thinkingStartTime = this.thinkingStartTime || Date.now();
      }
      this.reasoningAccumulated += chunk;
      this.rawAccumulated += chunk;
      return { reasoningDelta: chunk, contentDelta: '', isThinking: true };
    }

    this.rawAccumulated += chunk;

    // Check if transition from explicit reasoning field to content field just happened
    if (this.inThinkingMode && !isExplicitReasoning && this.reasoningAccumulated.length > 0 && !this.rawAccumulated.includes('<think>')) {
      // Transition out of explicit reasoning field
      this.inThinkingMode = false;
      this.thinkingEndTime = Date.now();
    }

    let reasoningDelta = '';
    let contentDelta = '';

    // 2. Parse inline tags in the text stream
    let remaining = chunk;

    while (remaining.length > 0) {
      if (!this.inThinkingMode) {
        // Check for opening tags
        let foundOpenIndex = -1;
        let matchedOpenTag = '';

        for (const tag of OPEN_TAGS) {
          const idx = remaining.indexOf(tag);
          if (idx !== -1 && (foundOpenIndex === -1 || idx < foundOpenIndex)) {
            foundOpenIndex = idx;
            matchedOpenTag = tag;
          }
        }

        // Check for implicit start (only closing tag arrives in stream)
        let foundCloseIndex = -1;
        let matchedCloseTag = '';
        for (const tag of CLOSE_TAGS) {
          const idx = remaining.indexOf(tag);
          if (idx !== -1 && (foundCloseIndex === -1 || idx < foundCloseIndex)) {
            foundCloseIndex = idx;
            matchedCloseTag = tag;
          }
        }

        if (foundOpenIndex !== -1) {
          // Content before open tag
          const beforeContent = remaining.slice(0, foundOpenIndex);
          if (beforeContent) {
            contentDelta += beforeContent;
            this.contentAccumulated += beforeContent;
          }

          // Enter thinking mode
          this.inThinkingMode = true;
          this.thinkingStartTime = this.thinkingStartTime || Date.now();
          remaining = remaining.slice(foundOpenIndex + matchedOpenTag.length);
        } else if (foundCloseIndex !== -1 && this.contentAccumulated.length === 0) {
          // Implicit start: text received so far was reasoning!
          const thoughtSoFar = remaining.slice(0, foundCloseIndex);
          if (thoughtSoFar) {
            reasoningDelta += thoughtSoFar;
            this.reasoningAccumulated += thoughtSoFar;
          }
          this.inThinkingMode = false;
          this.thinkingEndTime = Date.now();
          remaining = remaining.slice(foundCloseIndex + matchedCloseTag.length);
        } else {
          // Normal content text
          contentDelta += remaining;
          this.contentAccumulated += remaining;
          remaining = '';
        }
      } else {
        // In thinking mode — look for closing tags
        let foundCloseIndex = -1;
        let matchedCloseTag = '';

        for (const tag of CLOSE_TAGS) {
          const idx = remaining.indexOf(tag);
          if (idx !== -1 && (foundCloseIndex === -1 || idx < foundCloseIndex)) {
            foundCloseIndex = idx;
            matchedCloseTag = tag;
          }
        }

        if (foundCloseIndex !== -1) {
          const thoughtChunk = remaining.slice(0, foundCloseIndex);
          if (thoughtChunk) {
            reasoningDelta += thoughtChunk;
            this.reasoningAccumulated += thoughtChunk;
          }
          this.inThinkingMode = false;
          this.thinkingEndTime = Date.now();
          remaining = remaining.slice(foundCloseIndex + matchedCloseTag.length);
        } else {
          reasoningDelta += remaining;
          this.reasoningAccumulated += remaining;
          remaining = '';
        }
      }
    }

    return {
      reasoningDelta,
      contentDelta,
      isThinking: this.inThinkingMode,
    };
  }

  public getResult(): ReasoningParseResult {
    const thinkingTimeMs =
      this.thinkingStartTime
        ? (this.thinkingEndTime || Date.now()) - this.thinkingStartTime
        : undefined;

    return {
      reasoning: this.reasoningAccumulated.trim(),
      content: this.contentAccumulated.trim(),
      hasReasoning: this.reasoningAccumulated.trim().length > 0,
      isThinking: this.inThinkingMode,
      thinkingTimeMs,
    };
  }

  public reset() {
    this.rawAccumulated = '';
    this.reasoningAccumulated = '';
    this.contentAccumulated = '';
    this.inThinkingMode = false;
    this.thinkingStartTime = null;
    this.thinkingEndTime = null;
  }
}

/**
 * Pure helper function to cleanly strip any thinking/reasoning tags from final markdown.
 */
export function stripReasoning(rawText: string): string {
  if (!rawText) return '';
  let clean = rawText;

  // 1. Explicit tag pairs
  const tagPairs = [
    [/<think>[\s\S]*?<\/think>/gi, ''],
    [/<thought>[\s\S]*?<\/thought>/gi, ''],
    [/<thinking>[\s\S]*?<\/thinking>/gi, ''],
    [/<thinking_process>[\s\S]*?<\/thinking_process>/gi, ''],
    [/<\|thought\|>[\s\S]*?(?:<\|\/thought\|>|<\|endofthought\|>)/gi, ''],
    [/<\|im_start\|>thought[\s\S]*?<\|im_end\|>/gi, ''],
    [/```(?:thought|thinking)[\s\S]*?```/gi, ''],
  ];

  for (const [re, replacement] of tagPairs) {
    clean = clean.replace(re, replacement as string);
  }

  // 2. Implicit closing tags (closing tag without matching opening)
  const closeOnlyTags = [
    /^[\s\S]*?<\/think>/i,
    /^[\s\S]*?<\/thought>/i,
    /^[\s\S]*?<\/thinking>/i,
    /^[\s\S]*?<\|\/thought\|>/i,
    /^[\s\S]*?<\|endofthought\|>/i,
  ];

  for (const re of closeOnlyTags) {
    clean = clean.replace(re, '');
  }

  return clean.trim();
}
