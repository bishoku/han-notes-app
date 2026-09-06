import { create } from 'zustand';
import { storage } from '@/services/storage';
import { useGraphStore } from '@/store/graphStore';
import { useAiStore } from '@/store/aiStore';
import { useGitStore } from '@/store/gitStore';
import { useUiStore } from '@/store/uiStore';
import { indexingCoordinator } from '@/services/ai/indexingCoordinator';
import { eventBus } from '@/lib/eventBus';
import {
  normalizeNoteId,
  extractTitleFromId,
  extractFolderFromId,
  isNoteIdMatch,
} from '@/utils/pathUtils';
import { syncStorageAdapter } from '@/services/sync/syncStorageAdapter';
import type { FileNode, NoteInfo, TagCount, BacklinkInfo } from '@/services/storage';

// Re-export types for backward compatibility with existing component imports
export type { FileNode, NoteInfo, TagCount, BacklinkInfo };

// Debounce timer registry for noteStore operations
const debounceTimers = {
  backlink: null as ReturnType<typeof setTimeout> | null,
  storeContent: null as ReturnType<typeof setTimeout> | null,
  gitStatus: null as ReturnType<typeof setTimeout> | null,
};

let activeLoadingNoteId: string | null = null;

function clearDebounceTimers() {
  if (debounceTimers.backlink) {
    clearTimeout(debounceTimers.backlink);
    debounceTimers.backlink = null;
  }
  if (debounceTimers.storeContent) {
    clearTimeout(debounceTimers.storeContent);
    debounceTimers.storeContent = null;
  }
  if (debounceTimers.gitStatus) {
    clearTimeout(debounceTimers.gitStatus);
    debounceTimers.gitStatus = null;
  }
}

/**
 * Derives sorted tag counts directly from an existing NoteInfo array without extra I/O.
 */
function deriveVaultTags(notes: NoteInfo[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const note of notes) {
    if (note.tags) {
      for (const tag of note.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
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
  vaultPath: string | null;

  loadVault: () => Promise<void>;
  loadVaultTree: () => Promise<void>;
  loadVaultTags: () => Promise<void>;
  setActiveTagFilter: (tag: string | null) => void;
  updateNoteTags: (id: string, tags: string[]) => Promise<void>;
  selectNote: (id: string, force?: boolean) => Promise<void>;
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
  /** Permanently deletes all notes and folders in the vault. */
  clearAllNotes: () => Promise<void>;
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
      // 1. Fetch vault files and path in parallel
      const [notes, vaultPath] = await Promise.all([
        storage.getVaultFiles(),
        storage.getVaultPath().catch(() => null),
      ]);

      // 2. Derive tags directly from notes without duplicate disk scans
      const vaultTags = deriveVaultTags(notes);

      set({ notes, vaultPath, vaultTags });

      // 3. Load file tree
      await get().loadVaultTree();

      // 4. Non-blocking graph store sync
      useGraphStore.getState().buildFullGraph(notes);

      // 5. Select first note if nothing is selected, or refresh current note if still exists
      if (notes.length > 0 && !get().currentNoteId) {
        await get().selectNote(notes[0].id);
      } else if (get().currentNoteId) {
        const stillExists = notes.some((n) => isNoteIdMatch(n.id, get().currentNoteId));
        if (stillExists) {
          await get().refreshCurrentNote();
        } else if (notes.length > 0) {
          await get().selectNote(notes[0].id, true);
        } else {
          set({ currentNoteId: null, currentNoteContent: '' });
        }
      }

      // 6. Non-blocking Git status refresh
      useGitStore.getState().refreshStatus().catch(() => {});
    } catch (e) {
      console.error('Failed to load vault:', e);
    }
  },

  switchVault: async () => {
    try {
      clearDebounceTimers();
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
      console.error('Failed to switch vault:', e);
      return false;
    }
  },

  loadVaultTree: async () => {
    try {
      const fileTree = await storage.getVaultTree();
      set({ fileTree });
    } catch (e) {
      console.error('Failed to load vault tree:', e);
    }
  },

  setActiveFolder: (path: string | null) => {
    set({ activeFolderPath: path });
  },

  selectNote: async (id: string, force = false) => {
    const cleanId = normalizeNoteId(id);
    if (!force && activeLoadingNoteId === cleanId) {
      return;
    }

    try {
      const prevId = get().currentNoteId;
      const prevContent = get().currentNoteContent;

      if (!force && prevId === cleanId && get().currentNoteContent) {
        // Even if same note is re-clicked, check if content changed on disk (e.g. after sync or git)
        try {
          const diskContent = await storage.readNote(cleanId);
          if (diskContent === prevContent) {
            return;
          }
          set({ currentNoteContent: diskContent });
          eventBus.emit('note:reloaded', { noteId: cleanId, content: diskContent });
          window.dispatchEvent(
            new CustomEvent('han-note-content-reloaded', {
              detail: { noteId: cleanId, content: diskContent },
            })
          );
          get().loadBacklinks(cleanId);
        } catch {}
        return;
      }

      activeLoadingNoteId = cleanId;

      // 1. Read note and update UI state immediately
      const content = await storage.readNote(cleanId);
      const parentDir = extractFolderFromId(cleanId);

      set({ currentNoteId: cleanId, currentNoteContent: content, activeFolderPath: parentDir });
      eventBus.emit('note:reloaded', { noteId: cleanId, content });
      window.dispatchEvent(
        new CustomEvent('han-note-content-reloaded', {
          detail: { noteId: cleanId, content },
        })
      );
      get().loadBacklinks(cleanId);

      // 2. Synchronize note-scoped AI chat session
      useAiStore.getState().syncActiveNoteSession(cleanId);

      // 3. Non-blocking snapshot of previous note in background
      if (prevId && prevId !== cleanId) {
        useUiStore.getState().closePdfSplitReader();
        eventBus.emit('note:flush-save');
        window.dispatchEvent(new CustomEvent('han-flush-note-save'));
        const prevNote = get().notes.find((n) => n.id === prevId);
        const prevTitle = prevNote?.title || extractTitleFromId(prevId);
        setTimeout(async () => {
          try {
            await useGitStore.getState().createSnapshot(`Not kaydedildi: ${prevTitle}`);
          } catch (e) {
            console.warn('Background snapshot error:', e);
          }
        }, 100);
      }

      // 4. Flush pending AI edits for previous note if AI is enabled
      if (useAiStore.getState().settings.enabled && prevId && prevContent) {
        const prevNote = get().notes.find((n) => n.id === prevId);
        const prevTitle = prevNote?.title || extractTitleFromId(prevId);
        indexingCoordinator.flushImmediate(prevId, prevTitle, prevContent);
      }
    } catch (e) {
      console.error('Failed to read note:', e);
    } finally {
      if (activeLoadingNoteId === cleanId) {
        activeLoadingNoteId = null;
      }
    }
  },

  refreshCurrentNote: async () => {
    const { currentNoteId } = get();
    if (!currentNoteId) return;
    try {
      const content = await storage.readNote(currentNoteId);
      set({ currentNoteContent: content });
      eventBus.emit('note:reloaded', { noteId: currentNoteId, content });
      window.dispatchEvent(
        new CustomEvent('han-note-content-reloaded', {
          detail: { noteId: currentNoteId, content },
        })
      );
      get().loadBacklinks(currentNoteId);
    } catch (e) {
      console.error('Failed to refresh current note:', e);
    }
  },

  loadBacklinks: async (id?: string) => {
    const noteId = id || get().currentNoteId;
    if (!noteId) return;

    try {
      const backlinks = await storage.getBacklinks(noteId);
      set({ backlinks });
    } catch (e) {
      console.error('Failed to load backlinks:', e);
    }
  },

  loadVaultTags: async () => {
    try {
      const vaultTags = deriveVaultTags(get().notes);
      set({ vaultTags });
    } catch (e) {
      console.error('Failed to load vault tags:', e);
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
      console.error('Failed to update note tags:', e);
    }
  },

  updateNote: async (content: string) => {
    const { currentNoteId } = get();
    if (!currentNoteId) return;

    try {
      await storage.writeNote(currentNoteId, content);

      // Debounced store state sync (2s) — keeps currentNoteContent fresh for
      // imperative consumers (ChatDrawer, aiStore) without triggering reactive
      // subscribers on every 400ms save cycle
      if (debounceTimers.storeContent) clearTimeout(debounceTimers.storeContent);
      debounceTimers.storeContent = setTimeout(() => {
        if (get().currentNoteId === currentNoteId) {
          set({ currentNoteContent: content });
        }
        debounceTimers.storeContent = null;
      }, 2000);

      // Debounced backlink refresh (2s)
      if (debounceTimers.backlink) clearTimeout(debounceTimers.backlink);
      debounceTimers.backlink = setTimeout(() => {
        if (get().currentNoteId === currentNoteId) {
          get().loadBacklinks(currentNoteId);
        }
        debounceTimers.backlink = null;
      }, 2000);

      // Debounced Git Status refresh (600ms)
      if (debounceTimers.gitStatus) clearTimeout(debounceTimers.gitStatus);
      debounceTimers.gitStatus = setTimeout(() => {
        useGitStore.getState().refreshStatus().catch(() => {});
        debounceTimers.gitStatus = null;
      }, 600);

      // Non-blocking graph index update
      useGraphStore.getState().updateNoteContent(currentNoteId, content);

      // Non-blocking AI vector indexing queue
      if (useAiStore.getState().settings.enabled) {
        const note = get().notes.find((n) => n.id === currentNoteId);
        const title = note?.title || extractTitleFromId(currentNoteId);
        indexingCoordinator.queueNoteUpdate(currentNoteId, title, content);
      }
    } catch (e) {
      console.error('Failed to write note:', e);
    }
  },

  createNote: async (title: string, parentPath = ''): Promise<string> => {
    try {
      await storage.createNoteInFolder(parentPath, title);
      await get().loadVault();
      const rawId = parentPath ? `${parentPath}/${title}` : title;
      const newId = normalizeNoteId(rawId);
      await get().selectNote(newId);
      return newId;
    } catch (e) {
      console.error('Failed to create note:', e);
      const rawId = parentPath ? `${parentPath}/${title}` : title;
      return normalizeNoteId(rawId);
    }
  },

  createFolder: async (folderName: string, parentPath = '') => {
    try {
      await storage.createFolder(parentPath, folderName);
      await get().loadVaultTree();
      set({ activeFolderPath: parentPath ? `${parentPath}/${folderName}` : folderName });
    } catch (e) {
      console.error('Failed to create folder:', e);
    }
  },

  moveNode: async (srcRelPath: string, destDirRelPath: string) => {
    const fileName = srcRelPath.split('/').pop() ?? srcRelPath;
    const destPath = destDirRelPath ? `${destDirRelPath}/${fileName}` : fileName;
    if (srcRelPath === destPath) return;

    try {
      await storage.moveNode(srcRelPath, destDirRelPath);

      const { currentNoteId } = get();
      const cleanSrc = normalizeNoteId(srcRelPath);
      const cleanDest = normalizeNoteId(destPath);

      if (currentNoteId === srcRelPath || currentNoteId === cleanSrc) {
        set({ currentNoteId: cleanDest });
        if (typeof window !== 'undefined') {
          window.location.hash = `#/notes/${encodeURIComponent(cleanDest)}`;
        }
      } else if (currentNoteId && (currentNoteId.startsWith(`${cleanSrc}/`) || currentNoteId.startsWith(`${srcRelPath}/`))) {
        const sub = currentNoteId.startsWith(`${cleanSrc}/`)
          ? currentNoteId.slice(cleanSrc.length + 1)
          : currentNoteId.slice(srcRelPath.length + 1);
        const newNoteId = `${cleanDest}/${sub}`;
        set({ currentNoteId: newNoteId });
        if (typeof window !== 'undefined') {
          window.location.hash = `#/notes/${encodeURIComponent(newNoteId)}`;
        }
      }

      await get().loadVault();
      useGitStore.getState().createSnapshot(`Taşındı: ${srcRelPath} -> ${destPath}`);
    } catch (e) {
      console.error('Failed to move item:', e);
    }
  },

  deleteNode: async (relPath: string) => {
    try {
      await syncStorageAdapter.recordTombstone(relPath);
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
      console.error('Failed to delete item:', e);
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
        : (relPath.endsWith('.md') || get().notes.some((n) => n.id === relPath || n.id === normalizeNoteId(relPath)));

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
        const oldNoteId = normalizeNoteId(relPath);
        const newNoteId = normalizeNoteId(newPath);
        if (currentId === oldNoteId || currentId === relPath) {
          set({ currentNoteId: newNoteId });
        }
        useGraphStore.getState().removeNoteFromGraph(oldNoteId);
        await get().loadVault();

        // Refresh vector index immediately for the renamed note
        try {
          const content = await storage.readNote(newNoteId);
          const newTitle = extractTitleFromId(finalName);
          await indexingCoordinator.renameNote(oldNoteId, newNoteId, newTitle, content);
        } catch (err) {
          console.warn('Failed to re-index renamed note:', err);
        }
      } else {
        // Folder rename
        const oldFolderId = normalizeNoteId(relPath);
        const newFolderId = normalizeNoteId(newPath);
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
      console.error('Failed to rename item:', e);
    }
  },

  clearAllNotes: async () => {
    try {
      // 1. Delete all top-level files and folders in fileTree
      const topNodes = [...get().fileTree];
      for (const node of topNodes) {
        try {
          await syncStorageAdapter.recordTombstone(node.relative_path);
          await storage.deleteNode(node.relative_path);
          await indexingCoordinator.deleteFolder(node.relative_path);
        } catch (err) {
          console.warn(`Failed to delete node ${node.relative_path}:`, err);
        }
      }

      // 2. Clear any lingering notes not in fileTree
      const remainingNotes = [...get().notes];
      for (const note of remainingNotes) {
        try {
          await syncStorageAdapter.recordTombstone(note.id);
          await storage.deleteNode(note.path || `${note.id}.md`);
          await indexingCoordinator.deleteNote(note.id);
        } catch {}
      }

      // 3. Clear graph and memory states
      useGraphStore.getState().resetGraph();
      set({
        notes: [],
        fileTree: [],
        currentNoteId: null,
        currentNoteContent: '',
        activeFolderPath: null,
        backlinks: [],
        vaultTags: [],
        activeTagFilter: null,
      });

      // 4. Reload vault and snapshot
      await get().loadVault();
      useGitStore.getState().createSnapshot('Tüm notlar temizlendi');
    } catch (e) {
      console.error('Failed to clear all notes:', e);
      throw e;
    }
  },
}));

// Synchronize noteStore's active note content whenever note:reloaded is fired externally (e.g. sync)
eventBus.on('note:reloaded', ({ noteId, content }) => {
  const currentId = useNoteStore.getState().currentNoteId;
  if (currentId && isNoteIdMatch(currentId, noteId)) {
    if (useNoteStore.getState().currentNoteContent !== content) {
      useNoteStore.setState({ currentNoteContent: content });
    }
  }
});
