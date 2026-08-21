/**
 * streamingJsonDecoder.ts — Real-time incremental JSON string unescaper.
 * Decodes serialized JSON string values (such as `{"response": "..."}` or raw JSON strings)
 * chunk-by-chunk while streaming from LLM tool call arguments.
 */

export class StreamingJsonStringDecoder {
  private targetKey: string;
  private buffer = '';
  private insideTargetString = false;
  private keyEncountered = false;
  private isEscaping = false;
  private unicodeHexBuffer = '';
  private completed = false;

  constructor(targetKey = 'response') {
    this.targetKey = targetKey;
  }

  /**
   * Feeds a raw chunk from tool_calls arguments stream.
   * Returns only the newly decoded, unescaped string slice belonging to the response.
   */
  public feed(chunk: string): string {
    if (!chunk || this.completed) return '';

    let output = '';

    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];

      if (this.completed) break;

      if (!this.insideTargetString) {
        this.buffer += char;
        const trimmed = this.buffer.trimStart();

        // 1. Check if direct string literal without enclosing object: e.g. "Hello world..."
        if (!this.keyEncountered && trimmed.startsWith('"') && !trimmed.startsWith('{"')) {
          this.insideTargetString = true;
          this.keyEncountered = true;
          this.buffer = '';
          continue;
        }

        // 2. Check for target key: e.g. "response" : "
        const keyPattern = new RegExp(`"${this.targetKey}"\\s*:\\s*"`, 'i');
        const match = this.buffer.match(keyPattern);
        if (match && match.index !== undefined) {
          this.insideTargetString = true;
          this.keyEncountered = true;
          this.buffer = '';
          continue;
        }

        // 3. Fallback: Any property with string value: e.g. "answer": " or "text": "
        if (!this.keyEncountered) {
          const fallbackMatch = this.buffer.match(/:\s*"/);
          if (fallbackMatch && fallbackMatch.index !== undefined) {
            this.insideTargetString = true;
            this.keyEncountered = true;
            this.buffer = '';
            continue;
          }
        }
        continue;
      }

      // ── INSIDE STRING LITERAL ─────────────────────────────────────────────

      // Handling unicode \uXXXX (4 hex characters)
      if (this.unicodeHexBuffer.length > 0 || (this.isEscaping && char === 'u')) {
        if (this.isEscaping && char === 'u') {
          this.isEscaping = false;
          this.unicodeHexBuffer = 'u';
          continue;
        }

        this.unicodeHexBuffer += char;
        if (this.unicodeHexBuffer.length === 5) {
          // 'u' + 4 hex chars
          const hex = this.unicodeHexBuffer.slice(1);
          try {
            const codePoint = parseInt(hex, 16);
            if (!isNaN(codePoint)) {
              output += String.fromCharCode(codePoint);
            }
          } catch {
            // Ignore decode error and pass through
          }
          this.unicodeHexBuffer = '';
        }
        continue;
      }

      // Handling single escape sequences
      if (this.isEscaping) {
        this.isEscaping = false;
        if (char === 'n') {
          output += '\n';
        } else if (char === 'r') {
          output += '\r';
        } else if (char === 't') {
          output += '\t';
        } else if (char === '"') {
          output += '"';
        } else if (char === '\\') {
          output += '\\';
        } else if (char === '/') {
          output += '/';
        } else if (char === 'b') {
          output += '\b';
        } else if (char === 'f') {
          output += '\f';
        } else {
          output += char;
        }
        continue;
      }

      if (char === '\\') {
        this.isEscaping = true;
        continue;
      }

      if (char === '"') {
        // Closing quote encountered
        this.insideTargetString = false;
        this.completed = true;
        break;
      }

      output += char;
    }

    return output;
  }

  public reset() {
    this.buffer = '';
    this.insideTargetString = false;
    this.keyEncountered = false;
    this.isEscaping = false;
    this.unicodeHexBuffer = '';
    this.completed = false;
  }

  public isDone(): boolean {
    return this.completed;
  }

  public hasStarted(): boolean {
    return this.insideTargetString || this.completed;
  }
}
