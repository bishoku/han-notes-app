import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { useNoteStore } from '@/store/noteStore';

export interface DecisionInfo {
  note_id: string;
  line_number: number;
  content: string;
  description?: string | null;
  date?: string | null;
  status?: 'approved' | 'draft' | 'deferred' | string | null;
  participants: string[];
  approved_by: string[];
  tags: string[];
  raw_line?: string;
}

export interface DecisionRegistry {
  participants: string[];
  approved_by: string[];
  tags: string[];
}

interface DecisionState {
  decisions: DecisionInfo[];
  registry: DecisionRegistry;
  loadDecisions: () => Promise<void>;
  loadDecisionRegistry: () => Promise<void>;
  updateDecisionMetadata: (
    noteId: string,
    lineNumber: number,
    content: string,
    metadata: {
      description?: string | null;
      date?: string | null;
      status?: string | null;
      participants?: string[];
      approvedBy?: string[];
      tags?: string[];
    }
  ) => Promise<void>;
}

export const useDecisionStore = create<DecisionState>((set, get) => ({
  decisions: [],
  registry: { participants: [], approved_by: [], tags: [] },

  loadDecisions: async () => {
    try {
      const decisions = await invoke<DecisionInfo[]>('get_global_decisions');
      set({ decisions });
      await get().loadDecisionRegistry();
    } catch (e) {
      console.error("Failed to load decisions:", e);
    }
  },

  loadDecisionRegistry: async () => {
    try {
      const registry = await invoke<DecisionRegistry>('get_decision_registry');
      set({ registry });
    } catch (e) {
      console.error("Failed to load decision registry:", e);
    }
  },

  updateDecisionMetadata: async (noteId, lineNumber, content, metadata) => {
    try {
      await invoke('update_decision_metadata', {
        noteId,
        lineNumber,
        content,
        description: metadata.description || null,
        date: metadata.date || null,
        status: metadata.status || 'approved',
        participants: metadata.participants || [],
        approvedBy: metadata.approvedBy || [],
        tags: metadata.tags || [],
      });
      await get().loadDecisions();

      // Refresh editor content if updated note is currently open
      await useNoteStore.getState().refreshCurrentNote();
    } catch (e) {
      console.error("Failed to update decision metadata:", e);
    }
  }
}));
