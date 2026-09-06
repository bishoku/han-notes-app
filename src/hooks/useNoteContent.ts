import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNoteStore, type NoteInfo } from '@/store/noteStore';
import { extractTagsFromFrontmatter } from '@/utils/lineParser';
import { clearLivePreviewCaches } from '@/editor/LivePreviewPlugin';
import { eventBus } from '@/lib/eventBus';
import { normalizeNoteId, isNoteIdMatch } from '@/utils/pathUtils';

/**
 * Custom hook to manage active note content, debounced saving to storage,
 * and debounced frontmatter tag parsing.
 */
export function useNoteContent() {
  // Individual Zustand selectors — subscribe only to fields we use, preventing
  // re-renders from unrelated store changes (fileTree, backlinks, etc.)
  const currentNoteId = useNoteStore((s) => s.currentNoteId);
  const currentNoteContent = useNoteStore((s) => s.currentNoteContent);
  const updateNote = useNoteStore((s) => s.updateNote);
  const notes = useNoteStore((s) => s.notes);
  const vaultTags = useNoteStore((s) => s.vaultTags);
  const updateNoteTags = useNoteStore((s) => s.updateNoteTags);
  const [localContent, setLocalContent] = useState(() => useNoteStore.getState().currentNoteContent || '');
  const [showTagPopover, setShowTagPopover] = useState(false);

  // Debounce timer refs
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagParseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanId = useMemo(() => (currentNoteId ? normalizeNoteId(currentNoteId) : ''), [currentNoteId]);

  const currentNote = useMemo(() => {
    if (!cleanId) return undefined;
    return notes.find((n: NoteInfo) => isNoteIdMatch(n.id, cleanId));
  }, [notes, cleanId]);

  const noteStoreTags = currentNote?.tags;

  // Debounced frontmatter tag extraction
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
    if (!cleanId) return notes;
    return notes.filter((n: NoteInfo) => !isNoteIdMatch(n.id, cleanId));
  }, [notes, cleanId]);

  // Track actively loaded note ID and local content ref
  const loadedNoteIdRef = useRef<string | null>(null);
  const localContentRef = useRef<string>(localContent);

  // Sync state when active note changes or on initial load
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
      clearLivePreviewCaches();
      const newContent = currentNoteContent || '';
      if (localContentRef.current !== newContent) {
        setLocalContent(newContent);
        localContentRef.current = newContent;
      }
    } else if (currentNoteContent !== localContentRef.current && !saveTimerRef.current) {
      // Note content in noteStore was refreshed externally (e.g. by sync/git)
      clearLivePreviewCaches();
      setLocalContent(currentNoteContent || '');
      localContentRef.current = currentNoteContent || '';
    }
  }, [currentNoteId, currentNoteContent, updateNote]);

  // Listen for explicit note content reloads and flush requests
  useEffect(() => {
    const unbindReload = eventBus.on('note:reloaded', (payload) => {
      if (isNoteIdMatch(payload.noteId, currentNoteId)) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        const newContent = payload.content || '';
        if (localContentRef.current !== newContent) {
          clearLivePreviewCaches();
          setLocalContent(newContent);
          localContentRef.current = newContent;
        }
      }
    });

    const unbindFlush = eventBus.on('note:flush-save', () => {
      if (saveTimerRef.current && localContentRef.current !== undefined) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        updateNote(localContentRef.current);
      }
    });

    // Window event listeners for backward compatibility
    const handleWinReload = (e: CustomEvent<{ noteId: string; content: string }>) => {
      if (isNoteIdMatch(e.detail?.noteId, currentNoteId)) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        const newContent = e.detail?.content || '';
        if (localContentRef.current !== newContent) {
          clearLivePreviewCaches();
          setLocalContent(newContent);
          localContentRef.current = newContent;
        }
      }
    };

    const handleWinFlush = () => {
      if (saveTimerRef.current && localContentRef.current !== undefined) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        updateNote(localContentRef.current);
      }
    };

    window.addEventListener('han-note-content-reloaded' as any, handleWinReload);
    window.addEventListener('han-flush-note-save' as any, handleWinFlush);

    return () => {
      unbindReload();
      unbindFlush();
      window.removeEventListener('han-note-content-reloaded' as any, handleWinReload);
      window.removeEventListener('han-flush-note-save' as any, handleWinFlush);
    };
  }, [currentNoteId, updateNote]);

  // Handle content updates with immediate local state and debounced disk persist
  const handleUpdate = useCallback(
    (val: string) => {
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
        eventBus.emit('editor:outline-update', val);
        window.dispatchEvent(new CustomEvent('outline-content-update', { detail: val }));
        outlineTimerRef.current = null;
      }, 1500);
    },
    [updateNote]
  );

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
