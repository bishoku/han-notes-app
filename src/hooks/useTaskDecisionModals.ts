import { useState, useCallback } from 'react';
import { useTaskStore } from '@/store/taskStore';
import { useDecisionStore } from '@/store/decisionStore';
import { useNoteStore } from '@/store/noteStore';
import type { TaskEditData } from '@/components/TaskEditModal';
import type { DecisionEditData } from '@/components/DecisionEditModal';
import { parseTaskLineText, parseDecisionLineText } from '@/utils/lineParser';

/**
 * Custom hook to manage Task and Decision edit modals,
 * parsing Markdown lines, and updating respective stores.
 */
export function useTaskDecisionModals(currentNoteId: string | null) {
  const { updateTaskMetadata } = useTaskStore();
  const { updateDecisionMetadata } = useDecisionStore();
  const { selectNote } = useNoteStore();

  const [taskModalData, setTaskModalData] = useState<TaskEditData | null>(null);
  const [decisionModalData, setDecisionModalData] = useState<DecisionEditData | null>(null);

  const handleOpenTaskModal = useCallback((btnState: { show: boolean; lineText: string; lineNumber: number }) => {
    if (!btnState.show || !currentNoteId) return;
    const parsed = parseTaskLineText(btnState.lineText);
    if (parsed) {
      setTaskModalData({
        noteId: currentNoteId,
        lineNumber: btnState.lineNumber,
        content: parsed.content,
        completed: parsed.completed,
        description: parsed.description,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        priority: parsed.priority,
        assignee: parsed.assignee,
        assignees: parsed.assignees,
        progress: parsed.progress,
        tags: parsed.tags,
      });
    }
  }, [currentNoteId]);

  const handleSaveTaskModal = useCallback(async (updated: TaskEditData) => {
    await updateTaskMetadata(
      updated.noteId,
      updated.lineNumber,
      updated.content,
      updated.completed,
      {
        description: updated.description,
        startDate: updated.startDate,
        endDate: updated.endDate,
        priority: updated.priority,
        assignees: updated.assignees,
        progress: updated.progress,
        tags: updated.tags,
      }
    );
    if (currentNoteId) {
      await selectNote(currentNoteId);
    }
    setTaskModalData(null);
  }, [currentNoteId, updateTaskMetadata, selectNote]);

  const handleOpenDecisionModal = useCallback((btnState: { show: boolean; lineText: string; lineNumber: number }) => {
    if (!btnState.show || !currentNoteId) return;
    const parsed = parseDecisionLineText(btnState.lineText);
    if (parsed) {
      setDecisionModalData({
        noteId: currentNoteId,
        lineNumber: btnState.lineNumber,
        content: parsed.content,
        description: parsed.description,
        date: parsed.date,
        status: parsed.status,
        participants: parsed.participants,
        approvedBy: parsed.approvedBy,
        tags: parsed.tags,
      });
    }
  }, [currentNoteId]);

  const handleSaveDecisionModal = useCallback(async (updated: DecisionEditData) => {
    await updateDecisionMetadata(
      updated.noteId,
      updated.lineNumber,
      updated.content,
      {
        description: updated.description,
        date: updated.date,
        status: updated.status,
        participants: updated.participants,
        approvedBy: updated.approvedBy,
        tags: updated.tags,
      }
    );
    if (currentNoteId) {
      await selectNote(currentNoteId);
    }
    setDecisionModalData(null);
  }, [currentNoteId, updateDecisionMetadata, selectNote]);

  return {
    taskModalData,
    setTaskModalData,
    decisionModalData,
    setDecisionModalData,
    handleOpenTaskModal,
    handleSaveTaskModal,
    handleOpenDecisionModal,
    handleSaveDecisionModal,
  };
}
