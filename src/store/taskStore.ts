import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { useNoteStore } from '@/store/noteStore';

export interface TaskInfo {
  note_id: string;
  line_number: number;
  content: string;
  completed: boolean;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | string | null;
  assignee?: string | null;
  assignees?: string[];
  progress?: number | null;
  tags?: string[];
  raw_line?: string;
}

export interface TaskRegistry {
  assignees: string[];
  tags: string[];
}

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
      const tasks = await invoke<TaskInfo[]>('get_global_tasks');
      set({ tasks });
      await get().loadTaskRegistry();
    } catch (e) {
      console.error("Failed to load tasks:", e);
    }
  },

  loadTaskRegistry: async () => {
    try {
      const registry = await invoke<TaskRegistry>('get_task_registry');
      set({ registry });
    } catch (e) {
      console.error("Failed to load task registry:", e);
    }
  },

  toggleTask: async (noteId, lineNumber, completed) => {
    try {
      await invoke('toggle_task', { noteId, lineNumber, completed });
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

      await invoke('update_task_metadata', {
        noteId,
        lineNumber,
        content,
        completed,
        description: metadata.description || null,
        startDate: metadata.startDate || null,
        endDate: metadata.endDate || null,
        priority: metadata.priority || null,
        assignee: finalAssignees.join(', ') || null,
        assignees: finalAssignees,
        progress: metadata.progress !== undefined ? metadata.progress : null,
        tags: metadata.tags || [],
      });
      await get().loadTasks();

      // Refresh editor content if updated note is currently open
      await useNoteStore.getState().refreshCurrentNote();
    } catch (e) {
      console.error("Failed to update task metadata:", e);
    }
  }
}));
