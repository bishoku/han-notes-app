import { autocompletion } from "@codemirror/autocomplete";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { useNoteStore } from "@/store/noteStore";
import { emojiCompletionSource } from "./EmojiCompletion";

export function wikilinkCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/\[\[([^\]]*)$/);
  if (!word) return null;

  const query = word.text.slice(2).toLowerCase();
  const { notes, currentNoteId } = useNoteStore.getState();
  const cleanId = currentNoteId ? currentNoteId.replace(/\.md$/, '') : '';

  const matchingNotes = notes
    .filter((note) => {
      // Exclude current note
      if (note.id === currentNoteId || note.id === cleanId || (currentNoteId && note.path.endsWith(currentNoteId))) {
        return false;
      }
      return note.title.toLowerCase().includes(query) || note.id.toLowerCase().includes(query);
    })
    .slice(0, 20);

  return {
    from: word.from + 2,
    options: matchingNotes.map((note) => ({
      label: note.title,
      type: "text",
      apply: `${note.id}]]`,
      detail: note.id.includes('/') ? note.id.split('/')[0] : "Note link",
    })),
  };
}

export const editorAutocomplete = autocompletion({
  override: [wikilinkCompletionSource, emojiCompletionSource],
  defaultKeymap: true,
});

// Alias for backwards compatibility
export const wikilinkAutocomplete = editorAutocomplete;
