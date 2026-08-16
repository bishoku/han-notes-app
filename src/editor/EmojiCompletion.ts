/**
 * EmojiCompletion.ts — CodeMirror 6 inline :shortcode: autocompletion provider.
 * Triggered when user types ':' followed by characters (e.g. :roc, :fire, :star, :check).
 */
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { searchEmojis } from './emojiData';

export function emojiCompletionSource(context: CompletionContext): CompletionResult | null {
  // Match a colon followed by 1 or more alphanumeric characters
  const word = context.matchBefore(/:([a-zA-Z0-9_+-]+)$/);
  if (!word) return null;

  // Query without the leading ':'
  const query = word.text.slice(1).toLowerCase();
  if (query.length < 1) return null;

  const matches = searchEmojis(query).slice(0, 15);
  if (matches.length === 0) return null;

  return {
    from: word.from,
    options: matches.map((item) => ({
      label: `${item.emoji} :${item.shortcode}:`,
      type: 'text',
      apply: `${item.emoji} `,
      detail: item.name,
    })),
  };
}
