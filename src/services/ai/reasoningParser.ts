/**
 * reasoningParser.ts — Unified real-time streaming & batch reasoning parser.
 * Handles:
 * - Structured SSE delta fields (reasoning_content, reasoning, thought)
 * - XML/Inline tags (<think>...</think>, <thought>...</thought>, <|thought|>...<|endofthought|>, etc.)
 * - Qwen & on-prem models natural language thinking blocks:
 *   "Here's a thinking process:" ... "[Done.]\n*Output Generation* (Proceeds)" / "[Output Generation]"
 * - Dynamic token buffer to prevent leaking opening thinking headers during stream start
 * - Automatic stray transition marker stripping
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

const OPEN_REGEXES: RegExp[] = [
  /<think>/i,
  /<thought>/i,
  /<thinking>/i,
  /<thinking_process>/i,
  /<\|thought\|>/i,
  /<\|im_start|>thought/i,
  /```(?:thought|thinking)/i,
  /Here'?s (?:a|the) (?:step-by-step )?thinking process(?:[^\n:]*)?:?/i,
  /Here is (?:a|the|my) (?:step-by-step )?(?:thinking|thought) process(?:[^\n:]*)?:?/i,
  /(?:\*|_){0,2}Thinking Process(?:\*|_){0,2}:?/i,
  /(?:\*|_){0,2}Thought Process(?:\*|_){0,2}:?/i,
  /(?:\*|_){0,2}Reasoning Process(?:\*|_){0,2}:?/i,
  /###\s*(?:Thinking|Thought|Reasoning)(?: Process)?:?/i,
  /##\s*(?:Thinking|Thought|Reasoning)(?: Process)?:?/i,
  /#\s*(?:Thinking|Thought|Reasoning)(?: Process)?:?/i,
];

const CLOSE_REGEXES: RegExp[] = [
  /<\/think>/i,
  /<\/thought>/i,
  /<\/thinking>/i,
  /<\/thinking_process>/i,
  /<\|\/thought\|>/i,
  /<\|endofthought\|>/i,
  /<\|im_end\|>/i,
  // Full composite markers with [Done.] and *Output Generation* (Proceeds)
  /(?:\[Done\.?\]\s*)?(?:\*|_){1,2}Output Generation(?:\*|_){1,2}(?:\s*\(?Proceeds?\)?)?/i,
  /(?:\[Done\.?\]\s*)?\[Output Generation\](?:\s*(?:->|\()?Proceeds?\)?)?/i,
  /\[Done\.?\](?:\s*(?:(?:\*|_){1,2}Output Generation(?:\*|_){1,2}|\(?Proceeds?\)?)?)?/i,
  /\[Final Response\]/i,
  /\[Response\]/i,
  /\[Output\]/i,
  /(?:\*|_){1,2}Final (?:Response|Output|Answer)(?:\*|_){1,2}/i,
  /###\s*(?:Final )?(?:Response|Output|Answer)/i,
  /---\s*(?:Response|Output)\s*---/i,
  /```/i,
];

const STRAY_OUTPUT_MARKERS =
  /^\s*(?:\[Done\.?\]\s*)?(?:(?:\*|_){1,2}Output Generation(?:\*|_){1,2}(?:\s*\(?Proceeds?\)?)?|\[Output Generation\](?:\s*(?:->|\()?Proceeds?\)?)?|(?:\*|_){1,2}(?:Final )?(?:Response|Output)(?:\*|_){1,2}:?|\[Final Response\]|\[Response\]|\[Output\]|\(?Proceeds\)?)\s*/i;

function findOpenMatch(str: string): { index: number; length: number } | null {
  let earliestIdx = -1;
  let matchedLength = 0;
  for (const re of OPEN_REGEXES) {
    const match = str.match(re);
    if (match && match.index !== undefined) {
      if (earliestIdx === -1 || match.index < earliestIdx) {
        earliestIdx = match.index;
        matchedLength = match[0].length;
      }
    }
  }
  return earliestIdx !== -1 ? { index: earliestIdx, length: matchedLength } : null;
}

function findCloseMatch(str: string): { index: number; length: number } | null {
  let earliestIdx = -1;
  let matchedLength = 0;
  for (const re of CLOSE_REGEXES) {
    const match = str.match(re);
    if (match && match.index !== undefined) {
      if (earliestIdx === -1 || match.index < earliestIdx) {
        earliestIdx = match.index;
        matchedLength = match[0].length;
      }
    }
  }
  return earliestIdx !== -1 ? { index: earliestIdx, length: matchedLength } : null;
}

/**
 * Stateful streaming parser for LLM output.
 * Call `feed(chunk, isExplicitReasoningField)` on each token received.
 */
export class ReasoningStreamParser {
  private rawAccumulated = '';
  private reasoningAccumulated = '';
  private contentAccumulated = '';
  private inThinkingMode = false;
  private inExplicitReasoningMode = false;
  private thinkingStartTime: number | null = null;
  private thinkingEndTime: number | null = null;
  private pendingBuffer = '';

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
      if (!this.inExplicitReasoningMode) {
        this.inExplicitReasoningMode = true;
        this.inThinkingMode = true;
        this.thinkingStartTime = this.thinkingStartTime || Date.now();
      }
      this.reasoningAccumulated += chunk;
      this.rawAccumulated += chunk;
      return { reasoningDelta: chunk, contentDelta: '', isThinking: true };
    }

    // Transition out of explicit SSE reasoning mode when content arrives
    if (this.inExplicitReasoningMode && !isExplicitReasoning) {
      this.inExplicitReasoningMode = false;
      this.inThinkingMode = false;
      this.thinkingEndTime = Date.now();
    }

    this.rawAccumulated += chunk;
    this.pendingBuffer += chunk;

    let reasoningDelta = '';
    let contentDelta = '';

    // 2. Initial buffering at start of stream to accurately detect natural language thinking header
    if (!this.inThinkingMode && this.contentAccumulated.length === 0 && this.reasoningAccumulated.length === 0) {
      const openMatch = findOpenMatch(this.pendingBuffer);
      if (openMatch) {
        if (openMatch.index > 0) {
          const before = this.pendingBuffer.slice(0, openMatch.index);
          contentDelta += before;
          this.contentAccumulated += before;
        }
        this.inThinkingMode = true;
        this.thinkingStartTime = this.thinkingStartTime || Date.now();
        this.pendingBuffer = this.pendingBuffer.slice(openMatch.index + openMatch.length);
      } else {
        const startsWithPossibleHeader =
          /^(?:H(?:e(?:r(?:e(?:'s?)?)?)?)?|T(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?|R(?:e(?:a(?:s(?:o(?:n(?:i(?:n(?:g)?)?)?)?)?)?)?)?|<(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?|\*(?:T|\*T))/i.test(
            this.pendingBuffer
          );

        if (startsWithPossibleHeader && this.pendingBuffer.length < 80 && !this.pendingBuffer.includes('\n\n')) {
          // Buffer until full header arrives or non-header confirmed
          return { reasoningDelta: '', contentDelta: '', isThinking: false };
        } else {
          // Normal content text
          contentDelta += this.pendingBuffer;
          this.contentAccumulated += this.pendingBuffer;
          this.pendingBuffer = '';
          return { reasoningDelta: '', contentDelta, isThinking: false };
        }
      }
    }

    // 3. Process remaining buffer
    while (this.pendingBuffer.length > 0) {
      if (this.inThinkingMode) {
        const closeMatch = findCloseMatch(this.pendingBuffer);
        if (closeMatch) {
          const thought = this.pendingBuffer.slice(0, closeMatch.index);
          if (thought) {
            reasoningDelta += thought;
            this.reasoningAccumulated += thought;
          }
          this.inThinkingMode = false;
          this.thinkingEndTime = Date.now();
          this.pendingBuffer = this.pendingBuffer.slice(closeMatch.index + closeMatch.length);

          // Strip any immediate trailing stray output markers like *Output Generation* (Proceeds)
          const stray = this.pendingBuffer.match(STRAY_OUTPUT_MARKERS);
          if (stray) {
            this.pendingBuffer = this.pendingBuffer.slice(stray[0].length);
          }
        } else {
          // In thinking mode, emit safe reasoning chunk
          const tailMatch = this.pendingBuffer.match(/(?:\[|\*|<|#|-)[^[<#*-]*$/);
          if (tailMatch && tailMatch.index !== undefined && this.pendingBuffer.length - tailMatch.index < 40) {
            const safe = this.pendingBuffer.slice(0, tailMatch.index);
            reasoningDelta += safe;
            this.reasoningAccumulated += safe;
            this.pendingBuffer = this.pendingBuffer.slice(tailMatch.index);
            break;
          } else {
            reasoningDelta += this.pendingBuffer;
            this.reasoningAccumulated += this.pendingBuffer;
            this.pendingBuffer = '';
          }
        }
      } else {
        // Content mode — strip stray output markers if at start of content
        if (this.contentAccumulated.trim().length === 0) {
          const stray = this.pendingBuffer.match(STRAY_OUTPUT_MARKERS);
          if (stray) {
            this.pendingBuffer = this.pendingBuffer.slice(stray[0].length);
          }
        }

        const openMatch = findOpenMatch(this.pendingBuffer);
        if (openMatch) {
          const before = this.pendingBuffer.slice(0, openMatch.index);
          if (before) {
            contentDelta += before;
            this.contentAccumulated += before;
          }
          this.inThinkingMode = true;
          this.pendingBuffer = this.pendingBuffer.slice(openMatch.index + openMatch.length);
        } else {
          contentDelta += this.pendingBuffer;
          this.contentAccumulated += this.pendingBuffer;
          this.pendingBuffer = '';
        }
      }
    }

    return {
      reasoningDelta,
      contentDelta,
      isThinking: this.inThinkingMode,
    };
  }

  private flush() {
    if (this.pendingBuffer) {
      if (this.inThinkingMode) {
        this.reasoningAccumulated += this.pendingBuffer;
      } else {
        this.contentAccumulated += this.pendingBuffer;
      }
      this.pendingBuffer = '';
    }
  }

  public getResult(): ReasoningParseResult {
    this.flush();
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
    this.pendingBuffer = '';
    this.inThinkingMode = false;
    this.inExplicitReasoningMode = false;
    this.thinkingStartTime = null;
    this.thinkingEndTime = null;
  }
}

/**
 * Pure helper function to cleanly strip any thinking/reasoning tags and Qwen reasoning headers from final markdown.
 */
export function stripReasoning(rawText: string): string {
  if (!rawText) return '';
  let clean = rawText;

  // 1. Explicit XML/Bracket tag pairs (<think>...</think>, <thought>...</thought>, etc.)
  const tagPairs: [RegExp, string][] = [
    [/<think>[\s\S]*?<\/think>/gi, ''],
    [/<thought>[\s\S]*?<\/thought>/gi, ''],
    [/<thinking>[\s\S]*?<\/thinking>/gi, ''],
    [/<thinking_process>[\s\S]*?<\/thinking_process>/gi, ''],
    [/<\|thought\|>[\s\S]*?(?:<\|\/thought\|>|<\|endofthought\|>)/gi, ''],
    [/<\|im_start\|>thought[\s\S]*?<\|im_end\|>/gi, ''],
    [/```(?:thought|thinking)[\s\S]*?```/gi, ''],
  ];

  for (const [re, replacement] of tagPairs) {
    clean = clean.replace(re, replacement);
  }

  // 2. Qwen & Open-source Natural Language Thinking blocks
  const nlThoughtRe =
    /^\s*(?:Here'?s (?:a|the) (?:step-by-step )?thinking process(?:[^\n:]*)?:|Thinking Process:|Thought Process:|### Thinking Process|## Thinking Process|# Thinking Process|### Thought Process|Reasoning Process:)\s*[\s\S]*?(?:(?:\[Done\.?\]\s*)?(?:\*|_){1,2}Output Generation(?:\*|_){1,2}(?:\s*\(?Proceeds?\)?)?|(?:\[Done\.?\]\s*)?\[Output Generation\](?:\s*(?:->|\()?Proceeds?\)?)?|\[Done\.?\]|\[Output\]|\[Final Response\]|\[Response\]|\[Proceeds\]|\[Proceeding with response\]|### (?:Final )?(?:Response|Output|Answer)|--- (?:Output|Response) ---|(?:\n\n|\r?\n)(?:Final )?(?:Response|Output):)([\s\S]*)$/i;

  const nlMatch = clean.match(nlThoughtRe);
  if (nlMatch && nlMatch[1] !== undefined) {
    clean = nlMatch[1];
  }

  // 3. Implicit closing tags & isolated output markers
  const closeOnlyTags = [
    /^[\s\S]*?<\/think>/i,
    /^[\s\S]*?<\/thought>/i,
    /^[\s\S]*?<\/thinking>/i,
    /^[\s\S]*?<\|\/thought\|>/i,
    /^[\s\S]*?<\|endofthought\|>/i,
    /^[\s\S]*?(?:\[Done\.?\]\s*)?(?:\*|_){1,2}Output Generation(?:\*|_){1,2}(?:\s*\(?Proceeds?\)?)?/i,
    /^[\s\S]*?(?:\[Done\.?\]\s*)?\[Output Generation\](?:\s*->\s*Proceeds)?/i,
    /^[\s\S]*?\[Final Response\]/i,
  ];

  for (const re of closeOnlyTags) {
    clean = clean.replace(re, '');
  }

  return clean.trim();
}
