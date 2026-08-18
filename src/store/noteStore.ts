import { create } from 'zustand';
import { storage } from '@/services/storage';
import { useGraphStore } from '@/store/graphStore';
import { useAiStore } from '@/store/aiStore';
import { useGitStore } from '@/store/gitStore';
import { indexingCoordinator } from '@/services/ai/indexingCoordinator';
import type { FileNode, NoteInfo, TagCount, BacklinkInfo } from '@/services/storage';

// Re-export types for backward compatibility with existing component imports
export type { FileNode, NoteInfo, TagCount, BacklinkInfo };

// Module-level debounce timers for updateNote side effects
let _backlinkTimer: ReturnType<typeof setTimeout> | null = null;
let _storeContentTimer: ReturnType<typeof setTimeout> | null = null;
let _gitStatusTimer: ReturnType<typeof setTimeout> | null = null;

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
  createNote: (title: string, parentPath?: string) => Promise<string>;
  createFolder: (folderName: string, parentPath?: string) => Promise<void>;
  moveNode: (srcRelPath: string, destDirRelPath: string) => Promise<void>;
  deleteNode: (relPath: string) => Promise<void>;
  renameNode: (relPath: string, newName: string) => Promise<void>;
  loadBacklinks: (id?: string) => Promise<void>;
  /** Re-reads the currently selected note from disk and updates state. */
  refreshCurrentNote: () => Promise<void>;
  /** Opens directory selector, switches active vault/workspace and reloads all notes. */
  switchVault: () => Promise<boolean>;
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
      
      // Sync with graph store non-blockingly
      useGraphStore.getState().buildFullGraph(notes);

      if (notes.length > 0 && !get().currentNoteId) {
        await get().selectNote(notes[0].id);
      }

      // Sync Git status with vault
      useGitStore.getState().refreshStatus().catch(() => {});
    } catch (e) {
      console.error("Failed to load vault:", e);
    }
  },

  switchVault: async () => {
    try {
      const selected = await storage.selectVaultFolder();
      if (selected) {
        set({
          currentNoteId: null,
          currentNoteContent: '',
          notes: [],
          fileTree: [],
          vaultTags: [],
          backlinks: [],
          activeFolderPath: null,
          activeTagFilter: null,
        });
        await get().loadVault();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to switch vault:", e);
      return false;
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
      const cleanId = id.replace(/\.md$/, '');
      const prevId = get().currentNoteId;
      const prevContent = get().currentNoteContent;

      if (prevId === cleanId && get().currentNoteContent) return;

      // 1. Immediately read note and update UI state without blocking
      const content = await storage.readNote(cleanId);
      const parts = cleanId.split('/');
      const parentDir = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
      
      set({ currentNoteId: cleanId, currentNoteContent: content, activeFolderPath: parentDir });
      get().loadBacklinks(cleanId);

      // Synchronize note-scoped AI chat session
      useAiStore.getState().syncActiveNoteSession(cleanId);

      // 2. Non-blocking snapshot of previous note in background
      if (prevId && prevId !== cleanId) {
        window.dispatchEvent(new CustomEvent('han-flush-note-save'));
        const prevNote = get().notes.find((n) => n.id === prevId);
        const prevTitle = prevNote?.title || prevId.split('/').pop() || prevId;
        setTimeout(async () => {
          try {
            await useGitStore.getState().createSnapshot(`Not kaydedildi: ${prevTitle}`);
          } catch (e) {
            console.warn('Background snapshot error:', e);
          }
        }, 100);
      }

      // If AI is enabled and had an active note, flush any pending edits for previous note
      if (useAiStore.getState().settings.enabled && prevId && prevContent) {
        const prevNote = get().notes.find((n) => n.id === prevId);
        const prevTitle = prevNote?.title || prevId.split('/').pop() || prevId;
        indexingCoordinator.flushImmediate(prevId, prevTitle, prevContent);
      }
    } catch (e) {
      console.error("Failed to read note:", e);
    }
  },

  refreshCurrentNote: async () => {
    const { currentNoteId } = get();
    if (!currentNoteId) return;
    try {
      const content = await storage.readNote(currentNoteId);
      set({ currentNoteContent: content });
      window.dispatchEvent(
        new CustomEvent('han-note-content-reloaded', {
          detail: { noteId: currentNoteId, content },
        })
      );
      get().loadBacklinks(currentNoteId);
    } catch (e) {
      console.error("Failed to refresh current note:", e);
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

      // Debounced store state sync (2s) — keeps currentNoteContent fresh for
      // imperative consumers (ChatDrawer, aiStore) without triggering reactive
      // subscribers (RightPanel headings, etc.) on every 400ms save cycle
      if (_storeContentTimer) clearTimeout(_storeContentTimer);
      _storeContentTimer = setTimeout(() => {
        // Only update if still on the same note
        if (get().currentNoteId === currentNoteId) {
          set({ currentNoteContent: content });
        }
        _storeContentTimer = null;
      }, 2000);

      // Debounced backlink refresh (2s) — backlinks don't need real-time updates
      if (_backlinkTimer) clearTimeout(_backlinkTimer);
      _backlinkTimer = setTimeout(() => {
        if (get().currentNoteId === currentNoteId) {
          get().loadBacklinks(currentNoteId);
        }
        _backlinkTimer = null;
      }, 2000);

      // Debounced Git Status refresh (600ms) — updates modified changes counter in status bar
      if (_gitStatusTimer) clearTimeout(_gitStatusTimer);
      _gitStatusTimer = setTimeout(() => {
        useGitStore.getState().refreshStatus().catch(() => {});
        _gitStatusTimer = null;
      }, 600);

      // Non-blocking graph index update
      useGraphStore.getState().updateNoteContent(currentNoteId, content);

      // Non-blocking AI vector indexing queue (25s idle debounced)
      if (useAiStore.getState().settings.enabled) {
        const note = get().notes.find((n) => n.id === currentNoteId);
        const title = note?.title || currentNoteId.split('/').pop() || currentNoteId;
        indexingCoordinator.queueNoteUpdate(currentNoteId, title, content);
      }
    } catch (e) {
      console.error("Failed to write note:", e);
    }
  },
  
  createNote: async (title: string, parentPath = ""): Promise<string> => {
    try {
      await storage.createNoteInFolder(parentPath, title);
      await get().loadVault();
      const newId = parentPath ? `${parentPath}/${title}` : title;
      await get().selectNote(newId);
      return newId;
    } catch (e) {
      console.error("Failed to create note:", e);
      return parentPath ? `${parentPath}/${title}` : title;
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
    const fileName = srcRelPath.split('/').pop() ?? srcRelPath;
    const destPath = destDirRelPath ? `${destDirRelPath}/${fileName}` : fileName;
    if (srcRelPath === destPath) return;

    try {
      await storage.moveNode(srcRelPath, destDirRelPath);
      
      const { currentNoteId } = get();
      const cleanSrc = srcRelPath.replace(/\.md$/, '');
      const cleanDest = destPath.replace(/\.md$/, '');

      if (currentNoteId === srcRelPath || currentNoteId === cleanSrc) {
        set({ currentNoteId: cleanDest });
      }

      await get().loadVault();
      useGitStore.getState().createSnapshot(`Taşındı: ${srcRelPath} -> ${destPath}`);
    } catch (e) {
      console.error("Failed to move item:", e);
    }
  },

  deleteNode: async (relPath: string) => {
    try {
      await storage.deleteNode(relPath);
      useGraphStore.getState().removeNoteFromGraph(relPath);
      if (get().currentNoteId === relPath || get().currentNoteId?.startsWith(relPath + '/')) {
        set({ currentNoteId: null, currentNoteContent: '' });
      }
      if (get().activeFolderPath === relPath) {
        set({ activeFolderPath: null });
      }
      // Clean up vector database chunks for the note or folder
      await indexingCoordinator.deleteFolder(relPath);
      await get().loadVault();
      useGitStore.getState().createSnapshot(`Silindi: ${relPath}`);
    } catch (e) {
      console.error("Failed to delete item:", e);
    }
  },

  renameNode: async (relPath: string, newName: string) => {
    try {
      const findNodeInTree = (nodes: FileNode[], path: string): FileNode | null => {
        for (const n of nodes) {
          if (n.relative_path === path) return n;
          if (n.children && n.children.length > 0) {
            const found = findNodeInTree(n.children, path);
            if (found) return found;
          }
        }
        return null;
      };

      const foundNode = findNodeInTree(get().fileTree, relPath);
      const isFile = foundNode
        ? !foundNode.is_dir
        : (relPath.endsWith('.md') || get().notes.some((n) => n.id === relPath || n.id === relPath.replace(/\.md$/, '')));

      const parts = relPath.split('/').filter(Boolean);
      parts.pop();

      const finalName = isFile
        ? (newName.endsWith('.md') ? newName : `${newName}.md`)
        : newName.replace(/\.md$/, '').trim();
      const newPath = parts.length > 0 ? `${parts.join('/')}/${finalName}` : finalName;

      await storage.renameNode(relPath, newName);

      // Update current active note ID if it was affected
      const currentId = get().currentNoteId;
      if (isFile) {
        const oldNoteId = relPath.replace(/\.md$/, '');
        const newNoteId = newPath.replace(/\.md$/, '');
        if (currentId === oldNoteId || currentId === relPath) {
          set({ currentNoteId: newNoteId });
        }
        useGraphStore.getState().removeNoteFromGraph(oldNoteId);
        await get().loadVault();

        // Refresh vector index immediately for the renamed note
        try {
          const content = await storage.readNote(newNoteId);
          const newTitle = finalName.replace(/\.md$/, '');
          await indexingCoordinator.renameNote(oldNoteId, newNoteId, newTitle, content);
        } catch (err) {
          console.warn('Failed to re-index renamed note:', err);
        }
      } else {
        // Folder rename
        const oldFolderId = relPath.replace(/\.md$/, '');
        const newFolderId = newPath.replace(/\.md$/, '');
        if (currentId && (currentId === oldFolderId || currentId.startsWith(oldFolderId + '/'))) {
          const updatedCurrentId = newFolderId + currentId.slice(oldFolderId.length);
          set({ currentNoteId: updatedCurrentId });
        }
        if (get().activeFolderPath === oldFolderId || get().activeFolderPath === relPath) {
          set({ activeFolderPath: newFolderId });
        }

        // Clean up old folder in vector index and load reloaded vault
        await indexingCoordinator.deleteFolder(oldFolderId);
        await get().loadVault();

        // Re-index all notes under new folder path
        const updatedNotes = get().notes.filter((n) => n.id.startsWith(newFolderId + '/'));
        for (const n of updatedNotes) {
          try {
            const content = await storage.readNote(n.id);
            await indexingCoordinator.indexSingleNote(n.id, n.title, content);
          } catch (err) {
            console.warn(`Failed to re-index note ${n.id} in renamed folder:`, err);
          }
        }
      }

      useGitStore.getState().createSnapshot(`Yeniden adlandırıldı: ${relPath} -> ${newName}`);
    } catch (e) {
      console.error("Failed to rename item:", e);
    }
  },
}));
