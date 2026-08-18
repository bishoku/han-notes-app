/**
 * reasoningParser.ts — Unified real-time streaming & batch reasoning parser.
 * Handles:
 * - Structured SSE delta fields (reasoning_content, reasoning, thought)
 * - XML/Inline tags (<think>...</think>, <thought>...</thought>, <|thought|>...<|endofthought|>, etc.)
 * - Qwen & on-prem models natural language thinking blocks:
 *   "Here's a thinking process:" ... "[Output Generation] -> Proceeds"
 * - Prompt prefill implicit start tags (closing </think> / [Output Generation] only)
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
  // Qwen / DeepSeek / Open-source natural language reasoning headers
  "Here's a thinking process:",
  "Here's the thinking process:",
  "Here is the thinking process:",
  "Here is my thought process:",
  "Thinking Process:",
  "Thought Process:",
  "### Thinking Process",
  "## Thinking Process",
  "# Thinking Process",
  "### Thought Process",
  "Reasoning Process:",
];

const CLOSE_TAGS = [
  '</think>',
  '</thought>',
  '</thinking>',
  '</thinking_process>',
  '<|/thought|>',
  '<|endofthought|>',
  '<|im_end|>',
  // Qwen / Open-source output markers & transition tokens
  '[Output Generation] -> Proceeds',
  '[Output Generation]',
  '[Final Response]',
  '[Response]',
  '[Output]',
  '[Proceeds]',
  '[Proceeding with response]',
  '### Final Response',
  '### Final Answer',
  '### Output',
  '### Response',
  '--- Output ---',
  '--- Response ---',
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
        // Check for opening tags
        let foundOpenIndex = -1;
        let matchedOpenTag = '';

        for (const tag of OPEN_TAGS) {
          const idx = remaining.toLowerCase().indexOf(tag.toLowerCase());
          if (idx !== -1 && (foundOpenIndex === -1 || idx < foundOpenIndex)) {
            foundOpenIndex = idx;
            matchedOpenTag = remaining.slice(idx, idx + tag.length);
          }
        }

        // Check for implicit start (only closing tag arrives in stream)
        let foundCloseIndex = -1;
        let matchedCloseTag = '';
        for (const tag of CLOSE_TAGS) {
          const idx = remaining.toLowerCase().indexOf(tag.toLowerCase());
          if (idx !== -1 && (foundCloseIndex === -1 || idx < foundCloseIndex)) {
            foundCloseIndex = idx;
            matchedCloseTag = remaining.slice(idx, idx + tag.length);
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
        } else if (foundCloseIndex !== -1 && this.contentAccumulated.trim().length === 0) {
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
          // Check if remaining tail could be a split prefix of an open/close tag
          const prefixIdx = this.findPotentialTagPrefix(remaining);
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
        let foundCloseIndex = -1;
        let matchedCloseTag = '';

        for (const tag of CLOSE_TAGS) {
          const idx = remaining.toLowerCase().indexOf(tag.toLowerCase());
          if (idx !== -1 && (foundCloseIndex === -1 || idx < foundCloseIndex)) {
            foundCloseIndex = idx;
            matchedCloseTag = remaining.slice(idx, idx + tag.length);
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
          // Check if tail could be a split prefix of a close tag
          const prefixIdx = this.findPotentialCloseTagPrefix(remaining);
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

  private findPotentialTagPrefix(str: string): number {
    const lower = str.toLowerCase();
    const all = [...OPEN_TAGS, ...CLOSE_TAGS];
    for (let len = Math.min(lower.length, 35); len >= 2; len--) {
      const tail = lower.slice(-len);
      for (const tag of all) {
        if (tag.toLowerCase().startsWith(tail)) {
          return str.length - len;
        }
      }
    }
    return -1;
  }

  private findPotentialCloseTagPrefix(str: string): number {
    const lower = str.toLowerCase();
    for (let len = Math.min(lower.length, 35); len >= 2; len--) {
      const tail = lower.slice(-len);
      for (const tag of CLOSE_TAGS) {
        if (tag.toLowerCase().startsWith(tail)) {
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
  // e.g. "Here's a thinking process: ... [Output Generation] -> Proceeds ... <Content>"
  const nlThoughtRe =
    /^\s*(?:Here'?s (?:a|the) (?:step-by-step )?thinking process(?:[^\n:]*)?:|Thinking Process:|Thought Process:|### Thinking Process|## Thinking Process|# Thinking Process|### Thought Process|Reasoning Process:)\s*[\s\S]*?(?:\[Output Generation\](?:\s*->\s*Proceeds)?|\[Output\]|\[Final Response\]|\[Response\]|\[Proceeds\]|\[Proceeding with response\]|### (?:Final )?(?:Response|Output|Answer)|--- (?:Output|Response) ---|(?:\n\n|\r?\n)(?:Final )?(?:Response|Output):)([\s\S]*)$/i;

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
    /^[\s\S]*?\[Output Generation\](?:\s*->\s*Proceeds)?/i,
    /^[\s\S]*?\[Final Response\]/i,
  ];

  for (const re of closeOnlyTags) {
    clean = clean.replace(re, '');
  }

  return clean.trim();
}
