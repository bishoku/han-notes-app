import type { EditorView } from "@codemirror/view";
import { useNoteStore } from "@/store/noteStore";
import { useUiStore } from "@/store/uiStore";

export function handleEditorMouseDown(event: MouseEvent, view: EditorView): boolean | void {
  const target = event.target as Node;
  const element = target.nodeType === Node.TEXT_NODE ? target.parentElement : (target as HTMLElement);

  // 1. Handle clicking on Callout Type Badge to cycle type
  const calloutBadge = element?.closest(".cm-callout-badge");
  if (calloutBadge) {
    event.preventDefault();
    event.stopPropagation();
    const currentType = calloutBadge.getAttribute("data-callout-type");
    const posStr = calloutBadge.getAttribute("data-callout-pos");
    if (currentType && posStr) {
      const pos = parseInt(posStr, 10);
      const types = ["NOTE", "TIP", "WARNING", "IMPORTANT", "CAUTION"];
      const nextIdx = (types.indexOf(currentType) + 1) % types.length;
      const nextType = types[nextIdx];
      
      const line = view.state.doc.lineAt(pos);
      const tagIndex = line.text.indexOf("[!");
      if (tagIndex !== -1) {
        const tagFrom = line.from + tagIndex;
        const tagTo = line.from + line.text.indexOf("]", tagFrom) + 1;
        view.dispatch({
          changes: { from: tagFrom, to: tagTo, insert: `[!${nextType}]` },
        });
      }
    }
    return true;
  }

  // 2. Handle clicking on Wikilinks [[Note Title]]
  const wikilink = element?.closest(".cm-wikilink");
  if (wikilink) {
    event.preventDefault();
    event.stopPropagation();

    const rawText = wikilink.textContent?.trim();
    if (rawText) {
      let cleanTitle = rawText.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
      if (cleanTitle.includes('|')) {
        cleanTitle = cleanTitle.split('|')[0].trim();
      }

      const { notes, selectNote, createNote } = useNoteStore.getState();
      
      const targetNote = notes.find((n) => 
        n.id.toLowerCase() === cleanTitle.toLowerCase() ||
        n.title.toLowerCase() === cleanTitle.toLowerCase() ||
        n.id.toLowerCase().endsWith(`/${cleanTitle.toLowerCase()}`)
      );

      if (targetNote) {
        selectNote(targetNote.id);
        window.location.hash = `/notes/${encodeURIComponent(targetNote.id)}`;
      } else {
        createNote(cleanTitle).then((newId) => {
          window.location.hash = `/notes/${encodeURIComponent(newId)}`;
        });
      }
      useUiStore.getState().setViewMode("notes");
    }
    return true;
  }

  // 3. Handle clicking directly on standard checkboxes (- [ ] or - [x])
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos !== null) {
    const line = view.state.doc.lineAt(pos);
    const boxMatch = line.text.match(/^(\s*[-*+]\s+)\[([ xX])\]/);
    if (boxMatch) {
      const boxStart = line.from + boxMatch[1].length;
      const boxEnd = boxStart + 3;
      if (pos >= line.from && pos <= line.to) {
        if (pos >= boxStart - 2 && pos <= boxEnd + 2) {
          event.preventDefault();
          event.stopPropagation();
          const isChecked = boxMatch[2] !== ' ';
          const newText = isChecked ? '[ ]' : '[x]';
          view.dispatch({
            changes: { from: boxStart, to: boxEnd, insert: newText },
          });
          return true;
        }
      }
    }
  }
}
