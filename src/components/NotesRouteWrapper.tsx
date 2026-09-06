/**
 * NotesRouteWrapper.tsx — Route adapter connecting URL parameters to note selection.
 * Handles /notes and /notes/* routes and synchronizes with noteStore and MainEditor.
 */
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import { MainEditor } from '@/components/MainEditor';

export const NotesRouteWrapper: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const rawPath = params['*']; // Wildcard path (e.g. "01-genel/not1" or "test")

  const { currentNoteId, notes, selectNote } = useNoteStore();
  const setViewMode = useUiStore((s) => s.setViewMode);

  useEffect(() => {
    setViewMode('notes');
  }, [setViewMode]);

  useEffect(() => {
    if (rawPath) {
      // Decode URI component if path contains encoded chars
      const decodedPath = decodeURIComponent(rawPath).replace(/\.md$/, '');
      const noteExists = notes.some(
        (n) => n.id === decodedPath || n.id.replace(/\.md$/, '') === decodedPath
      );

      if (noteExists) {
        if (decodedPath !== currentNoteId) {
          selectNote(decodedPath);
        }
      } else if (notes.length > 0) {
        // Note from old workspace doesn't exist here: fallback to active or first note of this workspace
        const targetId = (
          currentNoteId && notes.some((n) => n.id === currentNoteId)
            ? currentNoteId
            : notes[0].id
        ).replace(/\.md$/, '');
        navigate(`/notes/${encodeURIComponent(targetId)}`, { replace: true });
      } else {
        // Workspace has no notes: reset URL to /notes
        navigate('/notes', { replace: true });
        useNoteStore.setState({ currentNoteId: null, currentNoteContent: '' });
      }
    } else if (!rawPath && notes.length > 0) {
      // If visited /notes without specific ID, redirect to current or first note
      const targetId = (currentNoteId || notes[0].id).replace(/\.md$/, '');
      navigate(`/notes/${encodeURIComponent(targetId)}`, { replace: true });
    }
  }, [rawPath, currentNoteId, notes, selectNote, navigate]);

  return <MainEditor />;
};
