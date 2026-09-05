/**
 * workspaceStore.ts — Zustand store for Workspace Management & Cross-Feature Coordination.
 * 
 * Guarantees strict isolation across:
 * - Physical Storage (Browser File Handles / Scoped IndexedDB / Tauri paths)
 * - Notes list, File Tree, and Tags
 * - Global Tasks and Decisions
 * - Mindmap and Graph Store
 * - RAG Vector Store (Local ONNX embeddings)
 * - Git Snapshots and History
 */
import { create } from 'zustand';
import type { Workspace, WorkspaceCreationOptions, WorkspaceStorageType } from '@/services/workspace';
import { workspaceManager } from '@/services/workspace';
import {
  bindWorkspaceStorage,
  IndexedDBStorage,
  isFileSystemAccessSupported,
  isTauriEnvironment,
} from '@/services/storage';
import { vectorStore, VectorStore } from '@/services/ai/vectorStore';
import { useNoteStore } from './noteStore';
import { useTaskStore } from './taskStore';
import { useDecisionStore } from './decisionStore';
import { useGraphStore } from './graphStore';
import { useGitStore } from './gitStore';

const COLOR_PALETTE = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  isSwitching: boolean;
  isWorkspaceModalOpen: boolean;

  // Actions
  initWorkspaces: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (options: WorkspaceCreationOptions, handle?: FileSystemDirectoryHandle) => Promise<Workspace>;
  createBrowserWorkspace: () => Promise<Workspace | null>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  renameWorkspace: (workspaceId: string, newName: string, color?: string, icon?: string) => Promise<void>;
  setWorkspaceModalOpen: (open: boolean) => void;
  getActiveWorkspace: () => Workspace | null;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  isLoading: true,
  isSwitching: false,
  isWorkspaceModalOpen: false,

  initWorkspaces: async () => {
    try {
      set({ isLoading: true });

      const defaultStorageType: WorkspaceStorageType = isTauriEnvironment()
        ? 'tauri'
        : isFileSystemAccessSupported()
        ? 'browser'
        : 'indexeddb';

      // 1. Run bootstrap migration if this is first launch or legacy installation
      await workspaceManager.migrateExistingDataIfNeeded(defaultStorageType);

      // 2. Load all workspaces
      const list = await workspaceManager.listWorkspaces();

      // 3. Determine which workspace to activate
      const lastActiveId = workspaceManager.getActiveWorkspaceId();
      let targetId = lastActiveId && list.some((w) => w.id === lastActiveId)
        ? lastActiveId
        : list[0]?.id || 'default';

      const target = list.find((w) => w.id === targetId) || list[0];

      if (target) {
        try {
          await bindWorkspaceStorage(target);
        } catch (err) {
          console.warn('[WorkspaceStore] bindWorkspaceStorage on init warning:', err);
        }

        // Initialize vector store for target workspace
        await vectorStore.setWorkspace(target.id);
      }

      set({
        workspaces: list,
        activeWorkspaceId: target ? target.id : null,
        isLoading: false,
      });
    } catch (err) {
      console.error('[WorkspaceStore] Failed to initialize workspaces:', err);
      set({ isLoading: false });
    }
  },

  switchWorkspace: async (workspaceId: string) => {
    if (workspaceId === get().activeWorkspaceId && !get().isSwitching) {
      set({ isWorkspaceModalOpen: false });
      return;
    }

    const target = get().workspaces.find((w) => w.id === workspaceId);
    if (!target) return;

    set({ isSwitching: true });

    try {
      // 1. Bind and activate the storage provider for this workspace
      await bindWorkspaceStorage(target);

      // 2. Switch isolated vector database
      await vectorStore.setWorkspace(workspaceId);

      // 3. Update access timestamp and save
      target.updatedAt = Date.now();
      await workspaceManager.saveWorkspace(target);
      workspaceManager.setActiveWorkspaceId(workspaceId);

      // 4. Clean-slate reset note selection, notes list, tree, tags and URL
      useNoteStore.setState({
        currentNoteId: null,
        currentNoteContent: '',
        notes: [],
        fileTree: [],
        vaultTags: [],
        backlinks: [],
        activeFolderPath: null,
        activeTagFilter: null,
      });

      if (typeof window !== 'undefined') {
        const hash = window.location.hash || '';
        if (hash.startsWith('#/notes/') && hash.length > '#/notes/'.length) {
          window.location.hash = '#/notes';
        }
      }

      // 5. Reload NoteStore & File Tree with the newly bound storage
      await useNoteStore.getState().loadVault();

      // 6. Reload Tasks & Decisions
      await useTaskStore.getState().loadTasks();
      await useDecisionStore.getState().loadDecisions();

      // 6. Reload Graph & Mindmap
      const currentNotes = useNoteStore.getState().notes;
      useGraphStore.getState().buildFullGraph(currentNotes);

      // 7. Refresh Git Status
      useGitStore.getState().refreshStatus().catch(() => {});

      // Refresh workspaces order
      const updatedList = await workspaceManager.listWorkspaces();

      set({
        activeWorkspaceId: workspaceId,
        workspaces: updatedList,
        isSwitching: false,
        isWorkspaceModalOpen: false,
      });
    } catch (err) {
      console.error('[WorkspaceStore] Switch workspace error:', err);
      set({ isSwitching: false });
      throw err;
    }
  },

  createWorkspace: async (options: WorkspaceCreationOptions, handle?: FileSystemDirectoryHandle) => {
    const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const randomColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];

    const defaultStorageType: WorkspaceStorageType = isTauriEnvironment()
      ? 'tauri'
      : isFileSystemAccessSupported()
      ? 'browser'
      : 'indexeddb';

    const newWs: Workspace = {
      id,
      name: options.name.trim() || 'Yeni Çalışma Alanı',
      storageType: options.storageType || defaultStorageType,
      color: options.color || randomColor,
      icon: options.icon || (options.storageType === 'browser' ? 'Folder' : 'Book'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      handleName: options.handleName,
      folderPath: options.folderPath,
      isDefault: false,
    };

    await workspaceManager.saveWorkspace(newWs);

    if (handle) {
      await workspaceManager.saveDirectoryHandle(id, handle);
    }

    const updatedList = await workspaceManager.listWorkspaces();
    set({ workspaces: updatedList });

    // Switch to newly created workspace
    await get().switchWorkspace(id);

    return newWs;
  },

  createBrowserWorkspace: async () => {
    if (!isFileSystemAccessSupported()) {
      throw new Error('File System Access API is not supported in this browser.');
    }

    const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });

    if (!handle) return null;

    return await get().createWorkspace(
      {
        name: handle.name,
        storageType: 'browser',
        handleName: handle.name,
        icon: 'Folder',
      },
      handle
    );
  },

  deleteWorkspace: async (workspaceId: string) => {
    const list = get().workspaces;
    if (list.length <= 1) {
      throw new Error('En az bir çalışma alanı kalmalıdır.');
    }

    const target = list.find((w) => w.id === workspaceId);
    if (!target) return;

    // Drop underlying data
    if (target.storageType === 'indexeddb') {
      await IndexedDBStorage.deleteWorkspaceDatabase(workspaceId);
    }
    await VectorStore.deleteWorkspaceDatabase(workspaceId);

    if (target.storageType === 'browser') {
      await workspaceManager.deleteDirectoryHandle(workspaceId);
    }

    await workspaceManager.deleteWorkspace(workspaceId);

    const remaining = await workspaceManager.listWorkspaces();

    if (get().activeWorkspaceId === workspaceId) {
      const nextWs = remaining[0];
      set({ workspaces: remaining });
      if (nextWs) {
        await get().switchWorkspace(nextWs.id);
      }
    } else {
      set({ workspaces: remaining });
    }
  },

  renameWorkspace: async (workspaceId: string, newName: string, color?: string, icon?: string) => {
    const ws = await workspaceManager.getWorkspace(workspaceId);
    if (!ws) return;

    ws.name = newName.trim();
    if (color) ws.color = color;
    if (icon) ws.icon = icon;
    ws.updatedAt = Date.now();

    await workspaceManager.saveWorkspace(ws);
    const updatedList = await workspaceManager.listWorkspaces();
    set({ workspaces: updatedList });
  },

  setWorkspaceModalOpen: (open: boolean) => {
    set({ isWorkspaceModalOpen: open });
  },

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;
  },
}));
