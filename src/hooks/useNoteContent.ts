import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNoteStore, type NoteInfo } from '@/store/noteStore';
import { extractTagsFromFrontmatter } from '@/utils/lineParser';

/**
 * Custom hook to manage active note content, debounced saving to storage,
 * and debounced frontmatter tag parsing.
 */
export function useNoteContent() {
  // Individual Zustand selectors — subscribe only to fields we use, preventing
  // re-renders from unrelated store changes (fileTree, backlinks, etc.)
  const currentNoteId = useNoteStore(s => s.currentNoteId);
  const currentNoteContent = useNoteStore(s => s.currentNoteContent);
  const updateNote = useNoteStore(s => s.updateNote);
  const notes = useNoteStore(s => s.notes);
  const vaultTags = useNoteStore(s => s.vaultTags);
  const updateNoteTags = useNoteStore(s => s.updateNoteTags);
  const [localContent, setLocalContent] = useState('');
  const [showTagPopover, setShowTagPopover] = useState(false);

  // Debounce timer refs — prevent disk writes and heavy parsing on every keystroke
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagParseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanId = currentNoteId ? currentNoteId.replace(/\.md$/, '') : '';
  const currentNote = notes.find((n: NoteInfo) =>
    n.id === currentNoteId ||
    n.id === cleanId ||
    n.id.endsWith(`/${cleanId}`) ||
    (currentNoteId && n.path.endsWith(currentNoteId))
  );

  const noteStoreTags = currentNote?.tags;

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
    return Array.from(new Set([...(noteStoreTags || []), ...debouncedFrontmatterTags]));
  }, [noteStoreTags, debouncedFrontmatterTags]);

  // All other notes in vault (excluding currently active note)
  const otherNotes = useMemo(() => {
    return notes.filter((n: NoteInfo) =>
      n.id !== currentNoteId &&
      n.id !== cleanId &&
      !n.id.endsWith(`/${cleanId}`) &&
      (!currentNoteId || !n.path.endsWith(currentNoteId))
    );
  }, [notes, currentNoteId, cleanId]);

  // Track actively loaded note ID and local content ref
  const loadedNoteIdRef = useRef<string | null>(null);
  const localContentRef = useRef<string>(localContent);


  // Sync state ONLY when active note changes or on initial load
  useEffect(() => {
    if (currentNoteId !== loadedNoteIdRef.current) {
      // Flush previous note if switching notes
      if (loadedNoteIdRef.current && saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (localContentRef.current !== undefined) {
          updateNote(localContentRef.current);
        }
      }

      loadedNoteIdRef.current = currentNoteId;
      setLocalContent(currentNoteContent || '');
      localContentRef.current = currentNoteContent || '';
    }
  }, [currentNoteId, currentNoteContent, updateNote]);

  // Handle content updates with immediate local state and debounced disk persist
  const handleUpdate = useCallback((val: string) => {
    setLocalContent(val);
    localContentRef.current = val;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateNote(val);
      saveTimerRef.current = null;
    }, 400);

    // Debounced outline event for RightPanel heading extraction (1.5s)
    if (outlineTimerRef.current) clearTimeout(outlineTimerRef.current);
    outlineTimerRef.current = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('outline-content-update', { detail: val }));
      outlineTimerRef.current = null;
    }, 1500);
  }, [updateNote]);

  // Cleanup timers & flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (loadedNoteIdRef.current && localContentRef.current !== undefined) {
          updateNote(localContentRef.current);
        }
      }
      if (tagParseTimerRef.current) {
        clearTimeout(tagParseTimerRef.current);
        tagParseTimerRef.current = null;
      }
      if (outlineTimerRef.current) {
        clearTimeout(outlineTimerRef.current);
        outlineTimerRef.current = null;
      }
    };
  }, [updateNote]);

  return {
    currentNoteId,
    currentNote,
    notes,
    otherNotes,
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
