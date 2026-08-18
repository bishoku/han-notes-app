/**
 * reasoningParser.ts — Unified real-time streaming & batch reasoning parser.
 * Handles:
 * - Structured SSE delta fields (reasoning_content, reasoning, thought)
 * - XML/Inline tags (<think>...</think>, <thought>...</thought>, <|thought|>...<|endofthought|>, etc.)
 * - Qwen & on-prem models natural language thinking blocks:
 *   "Here's a thinking process:" ... "[Done.]\n*Output Generation* (Proceeds)" / "[Output Generation]"
 * - Prompt prefill implicit start tags (closing </think> / [Done.] / [Output Generation] only)
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
  /Here'?s (?:a|the) (?:step-by-step )?thinking process(?:[^\n:]*)?:/i,
  /Here is (?:a|the|my) (?:step-by-step )?thought process(?:[^\n:]*)?:/i,
  /Thinking Process:/i,
  /Thought Process:/i,
  /Reasoning Process:/i,
  /###\s*(?:Thinking|Thought|Reasoning) Process/i,
  /##\s*(?:Thinking|Thought|Reasoning) Process/i,
  /#\s*(?:Thinking|Thought|Reasoning) Process/i,
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
  /\[Done\.?\](?:\s*(?:\(?Proceeds?\)?|\*Proceeds\*|\[Proceeds\]|Proceeds))?/i,
  /\[Final Response\]/i,
  /\[Response\]/i,
  /\[Output\]/i,
  /(?:\*|_){1,2}Final (?:Response|Output|Answer)(?:\*|_){1,2}/i,
  /###\s*(?:Final )?(?:Response|Output|Answer)/i,
  /---\s*(?:Response|Output)\s*---/i,
  /```/i,
];

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

    let remaining = this.pendingBuffer + chunk;
    this.pendingBuffer = '';
    let reasoningDelta = '';
    let contentDelta = '';

    // 2. Parse inline tags & reasoning headers in the text stream
    while (remaining.length > 0) {
      if (!this.inThinkingMode) {
        const openMatch = findOpenMatch(remaining);
        const closeMatch = findCloseMatch(remaining);

        if (openMatch) {
          // Content before open tag
          const beforeContent = remaining.slice(0, openMatch.index);
          if (beforeContent) {
            contentDelta += beforeContent;
            this.contentAccumulated += beforeContent;
          }

          // Enter thinking mode
          this.inThinkingMode = true;
          this.thinkingStartTime = this.thinkingStartTime || Date.now();
          remaining = remaining.slice(openMatch.index + openMatch.length);
        } else if (closeMatch && this.contentAccumulated.trim().length === 0) {
          // Implicit start: text received so far was reasoning!
          const thoughtSoFar = remaining.slice(0, closeMatch.index);
          if (thoughtSoFar) {
            reasoningDelta += thoughtSoFar;
            this.reasoningAccumulated += thoughtSoFar;
          }
          this.inThinkingMode = false;
          this.thinkingEndTime = Date.now();
          remaining = remaining.slice(closeMatch.index + closeMatch.length);
        } else {
          // Check if remaining tail could be a split prefix of an open/close tag
          const prefixIdx = this.findPotentialPrefix(remaining);
          if (prefixIdx !== -1 && prefixIdx > 0) {
            const safe = remaining.slice(0, prefixIdx);
            contentDelta += safe;
            this.contentAccumulated += safe;
            this.pendingBuffer = remaining.slice(prefixIdx);
            remaining = '';
          } else if (prefixIdx === 0) {
            this.pendingBuffer = remaining;
            remaining = '';
          } else {
            // Normal content text
            contentDelta += remaining;
            this.contentAccumulated += remaining;
            remaining = '';
          }
        }
      } else {
        // In thinking mode — look for closing tags / output markers
        const closeMatch = findCloseMatch(remaining);

        if (closeMatch) {
          const thoughtChunk = remaining.slice(0, closeMatch.index);
          if (thoughtChunk) {
            reasoningDelta += thoughtChunk;
            this.reasoningAccumulated += thoughtChunk;
          }
          this.inThinkingMode = false;
          this.thinkingEndTime = Date.now();
          remaining = remaining.slice(closeMatch.index + closeMatch.length);
        } else {
          // Check if tail could be a split prefix of a close tag
          const prefixIdx = this.findPotentialClosePrefix(remaining);
          if (prefixIdx !== -1 && prefixIdx > 0) {
            const safe = remaining.slice(0, prefixIdx);
            reasoningDelta += safe;
            this.reasoningAccumulated += safe;
            this.pendingBuffer = remaining.slice(prefixIdx);
            remaining = '';
          } else if (prefixIdx === 0) {
            this.pendingBuffer = remaining;
            remaining = '';
          } else {
            reasoningDelta += remaining;
            this.reasoningAccumulated += remaining;
            remaining = '';
          }
        }
      }
    }

    return {
      reasoningDelta,
      contentDelta,
      isThinking: this.inThinkingMode,
    };
  }

  private findPotentialPrefix(str: string): number {
    const lower = str.toLowerCase();
    const prefixes = [
      '<think',
      '<thought',
      '<thinking',
      "here's",
      'thinking',
      'thought',
      'reasoning',
      '[done',
      '*output',
      '[output',
      '###',
    ];
    for (let len = Math.min(lower.length, 30); len >= 2; len--) {
      const tail = lower.slice(-len);
      for (const p of prefixes) {
        if (p.startsWith(tail)) {
          return str.length - len;
        }
      }
    }
    return -1;
  }

  private findPotentialClosePrefix(str: string): number {
    const lower = str.toLowerCase();
    const prefixes = [
      '</think',
      '</thought',
      '</thinking',
      '[done',
      '*output',
      '[output',
      '[final',
      '[response',
      '### final',
      '### output',
      '--- output',
    ];
    for (let len = Math.min(lower.length, 30); len >= 2; len--) {
      const tail = lower.slice(-len);
      for (const p of prefixes) {
        if (p.startsWith(tail)) {
          return str.length - len;
        }
      }
    }
    return -1;
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
  // e.g. "Here's a thinking process: ... [Done.]\n*Output Generation* (Proceeds) ... <Content>"
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
