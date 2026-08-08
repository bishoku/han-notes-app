import { create } from 'zustand';
import { storage } from '@/services/storage';
import type { DecisionInfo, DecisionRegistry } from '@/services/storage';
import { useNoteStore } from '@/store/noteStore';

// Re-export types for backward compatibility
export type { DecisionInfo, DecisionRegistry };

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
      const decisions = await storage.getGlobalDecisions();
      set({ decisions });
      await get().loadDecisionRegistry();
    } catch (e) {
      console.error("Failed to load decisions:", e);
    }
  },

  loadDecisionRegistry: async () => {
    try {
      const registry = await storage.getDecisionRegistry();
      set({ registry });
    } catch (e) {
      console.error("Failed to load decision registry:", e);
    }
  },

  updateDecisionMetadata: async (noteId, lineNumber, content, metadata) => {
    try {
      await storage.updateDecisionMetadata(
        noteId,
        lineNumber,
        content,
        metadata.description || null,
        metadata.date || null,
        metadata.status || 'approved',
        metadata.participants || [],
        metadata.approvedBy || [],
        metadata.tags || [],
      );
      await get().loadDecisions();

      // Refresh editor content if updated note is currently open
      await useNoteStore.getState().refreshCurrentNote();
    } catch (e) {
      console.error("Failed to update decision metadata:", e);
    }
  }
}));
