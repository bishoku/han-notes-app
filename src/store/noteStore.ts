import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface FileNode {
  name: string;
  relative_path: string;
  is_dir: boolean;
  children: FileNode[];
}

export interface NoteInfo {
  id: string;
  title: string;
  path: string;
  tags: string[];
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface BacklinkInfo {
  source_note_id: string;
  snippet: string;
  line_number: number;
}

interface NoteState {
  notes: NoteInfo[];
  fileTree: FileNode[];
  currentNoteId: string | null;
  currentNoteContent: string;
  activeFolderPath: string | null;
  backlinks: BacklinkInfo[];
  vaultTags: TagCount[];
  activeTagFilter: string | null;
  
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

  loadVault: async () => {
    try {
      const notes = await invoke<NoteInfo[]>('get_vault_files');
      set({ notes });
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
      const fileTree = await invoke<FileNode[]>('get_vault_tree');
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
      const content = await invoke<string>('read_note', { id });
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
      const backlinks = await invoke<BacklinkInfo[]>('get_backlinks', { targetNoteId: noteId });
      set({ backlinks });
    } catch (e) {
      console.error("Failed to load backlinks:", e);
    }
  },

  loadVaultTags: async () => {
    try {
      const vaultTags = await invoke<TagCount[]>('get_vault_tags');
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
      await invoke('update_note_tags', { id, tags });
      await get().loadVault();
      if (get().currentNoteId === id) {
        const content = await invoke<string>('read_note', { id });
        set({ currentNoteContent: content });
      }
    } catch (e) {
      console.error("Failed to update note tags:", e);
    }
  },

  updateNote: async (content: string) => {
    const { currentNoteId } = get();
    if (!currentNoteId) return;
    set({ currentNoteContent: content });
    
    try {
      await invoke('write_note', { id: currentNoteId, content });
      get().loadBacklinks(currentNoteId);
    } catch (e) {
      console.error("Failed to write note:", e);
    }
  },
  
  createNote: async (title: string, parentPath = "") => {
    try {
      await invoke('create_note_in_folder', { parentPath, title });
      await get().loadVault();
      const newId = parentPath ? `${parentPath}/${title}` : title;
      await get().selectNote(newId);
    } catch (e) {
      console.error("Failed to create note:", e);
    }
  },

  createFolder: async (folderName: string, parentPath = "") => {
    try {
      await invoke('create_folder', { parentPath, folderName });
      await get().loadVaultTree();
      set({ activeFolderPath: parentPath ? `${parentPath}/${folderName}` : folderName });
    } catch (e) {
      console.error("Failed to create folder:", e);
    }
  },

  moveNode: async (srcRelPath: string, destDirRelPath: string) => {
    try {
      await invoke('move_node', { srcRelPath, destDirRelPath });
      await get().loadVault();
    } catch (e) {
      console.error("Failed to move item:", e);
    }
  },

  deleteNode: async (relPath: string) => {
    try {
      await invoke('delete_node', { relativePath: relPath });
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
      await invoke('rename_node', { relativePath: relPath, newName });
      await get().loadVault();
    } catch (e) {
      console.error("Failed to rename item:", e);
    }
  },

  refreshCurrentNote: async () => {
    const { currentNoteId } = get();
    if (!currentNoteId) return;
    try {
      const content = await invoke<string>('read_note', { id: currentNoteId });
      set({ currentNoteContent: content });
    } catch (e) {
      console.error("Failed to refresh current note:", e);
    }
  },
}));
