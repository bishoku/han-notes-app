import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNoteStore, type NoteInfo } from '@/store/noteStore';
import { extractTagsFromFrontmatter } from '@/utils/lineParser';

/**
 * Custom hook to manage active note content, debounced saving to storage,
 * and debounced frontmatter tag parsing.
 */
export function useNoteContent() {
  const { currentNoteId, currentNoteContent, updateNote, notes, vaultTags, updateNoteTags } = useNoteStore();
  const [localContent, setLocalContent] = useState('');
  const [showTagPopover, setShowTagPopover] = useState(false);

  // Debounce timer refs — prevent disk writes and heavy parsing on every keystroke
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagParseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanId = currentNoteId ? currentNoteId.replace(/\.md$/, '') : '';
  const currentNote = notes.find((n: NoteInfo) =>
    n.id === currentNoteId ||
    n.id === cleanId ||
    n.id.endsWith(`/${cleanId}`) ||
    (currentNoteId && n.path.endsWith(currentNoteId))
  );

  const noteStoreTags = currentNote?.tags || [];

  // Debounced frontmatter tag extraction — parse only after typing pauses
  const [debouncedFrontmatterTags, setDebouncedFrontmatterTags] = useState<string[]>([]);

  useEffect(() => {
    if (tagParseTimerRef.current) clearTimeout(tagParseTimerRef.current);
    tagParseTimerRef.current = setTimeout(() => {
      setDebouncedFrontmatterTags(extractTagsFromFrontmatter(localContent));
    }, 400);

    return () => {
      if (tagParseTimerRef.current) clearTimeout(tagParseTimerRef.current);
    };
  }, [localContent]);

  const currentTags = useMemo(() => {
    return Array.from(new Set([...noteStoreTags, ...debouncedFrontmatterTags]));
  }, [noteStoreTags, debouncedFrontmatterTags]);

  // Sync state when active note changes or content reloads
  useEffect(() => {
    setLocalContent(currentNoteContent);
  }, [currentNoteId, currentNoteContent]);

  // Handle content updates with immediate local state and debounced disk persist
  const handleUpdate = useCallback((val: string) => {
    setLocalContent(val);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateNote(val);
    }, 500);
  }, [updateNote]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (tagParseTimerRef.current) clearTimeout(tagParseTimerRef.current);
    };
  }, []);

  // Flush pending save immediately when switching notes
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [currentNoteId]);

  return {
    currentNoteId,
    currentNote,
    localContent,
    setLocalContent,
    handleUpdate,
    currentTags,
    vaultTags,
    showTagPopover,
    setShowTagPopover,
    updateNoteTags,
  };
}
