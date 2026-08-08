import { create } from 'zustand';
import { storage } from '@/services/storage';
import type { TaskInfo, TaskRegistry } from '@/services/storage';
import { useNoteStore } from '@/store/noteStore';

// Re-export types for backward compatibility
export type { TaskInfo, TaskRegistry };

interface TaskState {
  tasks: TaskInfo[];
  registry: TaskRegistry;
  loadTasks: () => Promise<void>;
  loadTaskRegistry: () => Promise<void>;
  toggleTask: (noteId: string, lineNumber: number, completed: boolean) => Promise<void>;
  updateTaskMetadata: (
    noteId: string,
    lineNumber: number,
    content: string,
    completed: boolean,
    metadata: {
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      priority?: string | null;
      assignee?: string | null;
      assignees?: string[];
      progress?: number | null;
      tags?: string[];
    }
  ) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  registry: { assignees: [], tags: [] },

  loadTasks: async () => {
    try {
      const tasks = await storage.getGlobalTasks();
      set({ tasks });
      await get().loadTaskRegistry();
    } catch (e) {
      console.error("Failed to load tasks:", e);
    }
  },

  loadTaskRegistry: async () => {
    try {
      const registry = await storage.getTaskRegistry();
      set({ registry });
    } catch (e) {
      console.error("Failed to load task registry:", e);
    }
  },

  toggleTask: async (noteId, lineNumber, completed) => {
    try {
      await storage.toggleTask(noteId, lineNumber, completed);
      await get().loadTasks();
      
      // Refresh editor content if toggled note is currently open
      await useNoteStore.getState().refreshCurrentNote();
    } catch (e) {
      console.error("Failed to toggle task:", e);
    }
  },

  updateTaskMetadata: async (noteId, lineNumber, content, completed, metadata) => {
    try {
      const finalAssignees = metadata.assignees && metadata.assignees.length > 0 
        ? metadata.assignees 
        : (metadata.assignee ? [metadata.assignee] : []);

      await storage.updateTaskMetadata(
        noteId,
        lineNumber,
        content,
        completed,
        metadata.description || null,
        metadata.startDate || null,
        metadata.endDate || null,
        metadata.priority || null,
        finalAssignees.join(', ') || null,
        finalAssignees,
        metadata.progress !== undefined ? metadata.progress : null,
        metadata.tags || [],
      );
      await get().loadTasks();

      // Refresh editor content if updated note is currently open
      await useNoteStore.getState().refreshCurrentNote();
    } catch (e) {
      console.error("Failed to update task metadata:", e);
    }
  }
}));
