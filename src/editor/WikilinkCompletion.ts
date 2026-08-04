import { autocompletion } from "@codemirror/autocomplete";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { useNoteStore } from "@/store/noteStore";

export function wikilinkCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/\[\[([^\]]*)$/);
  if (!word) return null;

  const query = word.text.slice(2).toLowerCase();
  const notes = useNoteStore.getState().notes;

  const matchingNotes = notes
    .filter((note) => note.title.toLowerCase().includes(query))
    .slice(0, 10);

  return {
    from: word.from + 2,
    options: matchingNotes.map((note) => ({
      label: note.title,
      type: "text",
      apply: `${note.title}]]`,
      detail: "Note link",
    })),
  };
}

export const wikilinkAutocomplete = autocompletion({
  override: [wikilinkCompletionSource],
  defaultKeymap: true,
});
