/**
 * graphStore.ts — Centralized Zustand store and high-performance in-memory
 * graph indexing engine for the Workspace Mindmap & Knowledge Graph.
 */
import { create } from 'zustand';
import { storage } from '@/services/storage';
import type { NoteInfo } from '@/store/noteStore';

export interface GraphNode {
  id: string;
  title: string;
  path: string;
  folder: string;
  tags: string[];
  outgoingLinks: string[];
  incomingLinks: string[];
  connectionCount: number;
  isOrphan: boolean;
  isGhost?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export type GraphLayoutMode = 'fcose' | 'breadthfirst' | 'concentric' | 'circle';
export type GraphColorBy = 'folder' | 'tag' | 'connections';

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  searchQuery: string;
  layoutMode: GraphLayoutMode;
  showOrphans: boolean;
  groupByFolder: boolean;
  colorBy: GraphColorBy;
  localGraphOnly: boolean;
  isLoading: boolean;

  // In-memory cache of note contents
  noteContentsCache: Map<string, string>;

  // Actions
  buildFullGraph: (notes: NoteInfo[], forceRefresh?: boolean) => Promise<void>;
  updateNoteContent: (noteId: string, content: string) => void;
  removeNoteFromGraph: (noteId: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setHoveredNodeId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setLayoutMode: (mode: GraphLayoutMode) => void;
  setShowOrphans: (show: boolean) => void;
  setGroupByFolder: (groupByFolder: boolean) => void;
  setColorBy: (colorBy: GraphColorBy) => void;
  setLocalGraphOnly: (localOnly: boolean) => void;
}

/**
 * Extracts all outgoing [[target]] or [[target|alias]] wikilinks from markdown text.
 */
export function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  const regex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const rawTarget = match[1].trim();
    if (rawTarget) {
      // Normalize: remove .md if present
      const clean = rawTarget.replace(/\.md$/, '');
      if (!links.includes(clean)) {
        links.push(clean);
      }
    }
  }

  return links;
}

/**
 * Resolves a raw target string (e.g. "toplanti" or "sub/toplanti") to an existing note ID.
 */
function resolveTargetNoteId(rawTarget: string, availableNotes: NoteInfo[]): string {
  const cleanTarget = rawTarget.trim().toLowerCase();

  // 1. Exact match with note ID
  const exact = availableNotes.find((n) => n.id.toLowerCase() === cleanTarget);
  if (exact) return exact.id;

  // 2. Match with title
  const byTitle = availableNotes.find((n) => n.title.toLowerCase() === cleanTarget);
  if (byTitle) return byTitle.id;

  // 3. Match with basename (e.g. "alpha" matches "projects/alpha")
  const byBasename = availableNotes.find((n) => {
    const base = n.id.split('/').pop()?.toLowerCase();
    return base === cleanTarget;
  });
  if (byBasename) return byBasename.id;

  return rawTarget; // Ghost note
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  hoveredNodeId: null,
  searchQuery: '',
  layoutMode: 'fcose',
  showOrphans: true,
  groupByFolder: true,
  colorBy: 'folder',
  localGraphOnly: false,
  isLoading: false,
  noteContentsCache: new Map<string, string>(),

  buildFullGraph: async (notes: NoteInfo[], forceRefresh = true) => {
    set({ isLoading: true });
    const cache = forceRefresh ? new Map<string, string>() : new Map<string, string>(get().noteContentsCache);

    try {
      // 1. Read note contents in parallel
      await Promise.all(
        notes.map(async (n) => {
          if (!cache.has(n.id) || forceRefresh) {
            try {
              const content = await storage.readNote(n.id);
              cache.set(n.id, content);
            } catch {
              cache.set(n.id, '');
            }
          }
        })
      );

      // 2. Build adjacency maps
      const outgoingMap = new Map<string, string[]>();
      const incomingMap = new Map<string, string[]>();

      for (const n of notes) {
        outgoingMap.set(n.id, []);
        incomingMap.set(n.id, []);
      }

      const edges: GraphEdge[] = [];
      const ghostNodesMap = new Map<string, GraphNode>();

      for (const note of notes) {
        const content = cache.get(note.id) || '';
        const rawLinks = extractWikilinks(content);

        for (const raw of rawLinks) {
          const resolvedId = resolveTargetNoteId(raw, notes);
          
          // Self loop check
          if (resolvedId === note.id) {
            continue;
          }

          // Register outgoing on source
          const outList = outgoingMap.get(note.id) || [];
          if (!outList.includes(resolvedId)) {
            outList.push(resolvedId);
            outgoingMap.set(note.id, outList);
          }

          // Register incoming on target if known note
          if (incomingMap.has(resolvedId)) {
            const inList = incomingMap.get(resolvedId) || [];
            if (!inList.includes(note.id)) {
              inList.push(note.id);
              incomingMap.set(resolvedId, inList);
            }
          } else {
            // Ghost node (referenced but doesn't exist yet in vault)
            if (!ghostNodesMap.has(resolvedId)) {
              ghostNodesMap.set(resolvedId, {
                id: resolvedId,
                title: resolvedId.split('/').pop() || resolvedId,
                path: resolvedId,
                folder: 'Oluşturulmamış',
                tags: ['ghost'],
                outgoingLinks: [],
                incomingLinks: [note.id],
                connectionCount: 1,
                isOrphan: false,
                isGhost: true,
              });
            } else {
              const ghost = ghostNodesMap.get(resolvedId)!;
              if (!ghost.incomingLinks.includes(note.id)) {
                ghost.incomingLinks.push(note.id);
                ghost.connectionCount++;
              }
            }
          }

          // Edge
          const edgeId = `${note.id}->${resolvedId}`;
          if (!edges.some((e) => e.id === edgeId)) {
            edges.push({
              id: edgeId,
              source: note.id,
              target: resolvedId,
            });
          }
        }
      }

      // 3. Construct GraphNodes
      const nodes: GraphNode[] = notes.map((n) => {
        const folder = n.id.includes('/') ? n.id.split('/').slice(0, -1).join('/') : 'Kök (Root)';
        const outLinks = outgoingMap.get(n.id) || [];
        const inLinks = incomingMap.get(n.id) || [];
        const connectionCount = outLinks.length + inLinks.length;

        return {
          id: n.id,
          title: n.title || n.id.split('/').pop() || n.id,
          path: n.path,
          folder,
          tags: n.tags || [],
          outgoingLinks: outLinks,
          incomingLinks: inLinks,
          connectionCount,
          isOrphan: connectionCount === 0,
        };
      });

      // Add ghost nodes
      for (const ghost of ghostNodesMap.values()) {
        nodes.push(ghost);
      }

      set({
        nodes,
        edges,
        noteContentsCache: cache,
        isLoading: false,
      });
    } catch (e) {
      console.error('Failed to build graph index:', e);
      set({ isLoading: false });
    }
  },

  updateNoteContent: (noteId: string, content: string) => {
    const cache = new Map(get().noteContentsCache);
    cache.set(noteId, content);
    set({ noteContentsCache: cache });

    const { nodes, edges } = get();
    const currentNodes: GraphNode[] = [...nodes];
    
    // If target note is not in nodes yet, add it
    if (!currentNodes.some((n) => n.id === noteId)) {
      const folder = noteId.includes('/') ? noteId.split('/').slice(0, -1).join('/') : 'Kök (Root)';
      const title = noteId.split('/').pop() || noteId;
      currentNodes.push({
        id: noteId,
        title,
        path: noteId,
        folder,
        tags: [],
        outgoingLinks: [],
        incomingLinks: [],
        connectionCount: 0,
        isOrphan: true,
      });
    }

    const newOutgoing = extractWikilinks(content);
    // Filter existing edges for this source
    const otherEdges = edges.filter((e) => e.source !== noteId);
    const newEdges: GraphEdge[] = [...otherEdges];

    for (const raw of newOutgoing) {
      const resolvedId = resolveTargetNoteId(raw, currentNodes as any);
      if (resolvedId !== noteId) {
        const edgeId = `${noteId}->${resolvedId}`;
        if (!newEdges.some((e) => e.id === edgeId)) {
          newEdges.push({
            id: edgeId,
            source: noteId,
            target: resolvedId,
          });
        }
      }
    }

    // Recompute connection counts and links
    const updatedNodes = currentNodes.map((node) => {
      const outList = newEdges.filter((e) => e.source === node.id).map((e) => e.target);
      const inList = newEdges.filter((e) => e.target === node.id).map((e) => e.source);
      const connectionCount = outList.length + inList.length;
      return {
        ...node,
        outgoingLinks: outList,
        incomingLinks: inList,
        connectionCount,
        isOrphan: connectionCount === 0,
      };
    });

    set({ nodes: updatedNodes, edges: newEdges });
  },

  removeNoteFromGraph: (noteId: string) => {
    const { nodes, edges } = get();
    const cache = new Map(get().noteContentsCache);
    cache.delete(noteId);

    const filteredNodes = nodes.filter((n) => n.id !== noteId);
    const filteredEdges = edges.filter((e) => e.source !== noteId && e.target !== noteId);

    set({
      nodes: filteredNodes,
      edges: filteredEdges,
      noteContentsCache: cache,
      selectedNodeId: get().selectedNodeId === noteId ? null : get().selectedNodeId,
    });
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setShowOrphans: (showOrphans) => set({ showOrphans }),
  setGroupByFolder: (groupByFolder) => set({ groupByFolder }),
  setColorBy: (colorBy) => set({ colorBy }),
  setLocalGraphOnly: (localGraphOnly) => set({ localGraphOnly }),
}));
