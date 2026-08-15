import { create } from 'zustand';
import { storage } from '@/services/storage';
import type { FileNode, NoteInfo, TagCount, BacklinkInfo } from '@/services/storage';

// Re-export types for backward compatibility with existing component imports
export type { FileNode, NoteInfo, TagCount, BacklinkInfo };

interface NoteState {
  notes: NoteInfo[];
  fileTree: FileNode[];
  currentNoteId: string | null;
  currentNoteContent: string;
  activeFolderPath: string | null;
  backlinks: BacklinkInfo[];
  vaultTags: TagCount[];
  activeTagFilter: string | null;
  vaultPath: string | null;
  
  loadVault: () => Promise<void>;
  loadVaultTree: () => Promise<void>;
  loadVaultTags: () => Promise<void>;
  setActiveTagFilter: (tag: string | null) => void;
  updateNoteTags: (id: string, tags: string[]) => Promise<void>;
  selectNote: (id: string) => Promise<void>;
  setActiveFolder: (path: string | null) => void;
  updateNote: (content: string) => Promise<void>;
  createNote: (title: string, parentPath?: string) => Promise<void>;
  createFolder: (folderName: string, parentPath?: string) => Promise<void>;
  moveNode: (srcRelPath: string, destDirRelPath: string) => Promise<void>;
  deleteNode: (relPath: string) => Promise<void>;
  renameNode: (relPath: string, newName: string) => Promise<void>;
  loadBacklinks: (id?: string) => Promise<void>;
  /** Re-reads the currently selected note from disk and updates state. */
  refreshCurrentNote: () => Promise<void>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  fileTree: [],
  currentNoteId: null,
  currentNoteContent: '',
  activeFolderPath: null,
  backlinks: [],
  vaultTags: [],
  activeTagFilter: null,
  vaultPath: null,

  loadVault: async () => {
    try {
      const notes = await storage.getVaultFiles();
      const vaultPath = await storage.getVaultPath().catch(() => null);
      set({ notes, vaultPath });
      await get().loadVaultTree();
      await get().loadVaultTags();
      
      if (notes.length > 0 && !get().currentNoteId) {
        await get().selectNote(notes[0].id);
      }
    } catch (e) {
      console.error("Failed to load vault:", e);
    }
  },

  loadVaultTree: async () => {
    try {
      const fileTree = await storage.getVaultTree();
      set({ fileTree });
    } catch (e) {
      console.error("Failed to load vault tree:", e);
    }
  },

  setActiveFolder: (path: string | null) => {
    set({ activeFolderPath: path });
  },

  selectNote: async (id: string) => {
    try {
      const content = await storage.readNote(id);
      const parts = id.split('/');
      const parentDir = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
      
      set({ currentNoteId: id, currentNoteContent: content, activeFolderPath: parentDir });
      get().loadBacklinks(id);
    } catch (e) {
      console.error("Failed to read note:", e);
    }
  },

  loadBacklinks: async (id?: string) => {
    const noteId = id || get().currentNoteId;
    if (!noteId) return;

    try {
      const backlinks = await storage.getBacklinks(noteId);
      set({ backlinks });
    } catch (e) {
      console.error("Failed to load backlinks:", e);
    }
  },

  loadVaultTags: async () => {
    try {
      const vaultTags = await storage.getVaultTags();
      set({ vaultTags });
    } catch (e) {
      console.error("Failed to load vault tags:", e);
    }
  },

  setActiveTagFilter: (tag: string | null) => {
    set({ activeTagFilter: tag });
  },

  updateNoteTags: async (id: string, tags: string[]) => {
    try {
      await storage.updateNoteTags(id, tags);
      await get().loadVault();
      if (get().currentNoteId === id) {
        const content = await storage.readNote(id);
        set({ currentNoteContent: content });
      }
    } catch (e) {
      console.error("Failed to update note tags:", e);
    }
  },

  updateNote: async (content: string) => {
    const { currentNoteId } = get();
    if (!currentNoteId) return;
    
    try {
      await storage.writeNote(currentNoteId, content);
      // Update store state after successful write
      set({ currentNoteContent: content });
      // Non-blocking backlink refresh — don't await
      get().loadBacklinks(currentNoteId);
    } catch (e) {
      console.error("Failed to write note:", e);
    }
  },
  
  createNote: async (title: string, parentPath = "") => {
    try {
      await storage.createNoteInFolder(parentPath, title);
      await get().loadVault();
      const newId = parentPath ? `${parentPath}/${title}` : title;
      await get().selectNote(newId);
    } catch (e) {
      console.error("Failed to create note:", e);
    }
  },

  createFolder: async (folderName: string, parentPath = "") => {
    try {
      await storage.createFolder(parentPath, folderName);
      await get().loadVaultTree();
      set({ activeFolderPath: parentPath ? `${parentPath}/${folderName}` : folderName });
    } catch (e) {
      console.error("Failed to create folder:", e);
    }
  },

  moveNode: async (srcRelPath: string, destDirRelPath: string) => {
    try {
      await storage.moveNode(srcRelPath, destDirRelPath);
      await get().loadVault();
    } catch (e) {
      console.error("Failed to move item:", e);
    }
  },

  deleteNode: async (relPath: string) => {
    try {
      await storage.deleteNode(relPath);
      if (get().currentNoteId === relPath) {
        set({ currentNoteId: null, currentNoteContent: '' });
      }
      if (get().activeFolderPath === relPath) {
        set({ activeFolderPath: null });
      }
      await get().loadVault();
    } catch (e) {
      console.error("Failed to delete item:", e);
    }
  },

  renameNode: async (relPath: string, newName: string) => {
    try {
      await storage.renameNode(relPath, newName);
      await get().loadVault();
    } catch (e) {
      console.error("Failed to rename item:", e);
    }
  },

  refreshCurrentNote: async () => {
    const { currentNoteId } = get();
    if (!currentNoteId) return;
    try {
      const content = await storage.readNote(currentNoteId);
      set({ currentNoteContent: content });
    } catch (e) {
      console.error("Failed to refresh current note:", e);
    }
  },
}));
