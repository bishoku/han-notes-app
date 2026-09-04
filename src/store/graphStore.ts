/**
 * graphStore.ts — Centralized Zustand store and high-performance in-memory
 * graph indexing engine for the Workspace Mindmap & Knowledge Graph.
 */
import { create } from 'zustand';
import { storage } from '@/services/storage';
import { normalizeNoteId, extractTitleFromId, extractFolderFromId } from '@/utils/pathUtils';
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
  resetGraph: () => void;
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
      const clean = normalizeNoteId(rawTarget);
      if (clean && !links.includes(clean)) {
        links.push(clean);
      }
    }
  }

  return links;
}

/**
 * Resolves a raw target string (e.g. "toplanti" or "sub/toplanti") to an existing note ID.
 */
function resolveTargetNoteId(rawTarget: string, availableNotes: Array<{ id: string; title: string }>): string {
  const cleanTarget = normalizeNoteId(rawTarget).toLowerCase();

  // 1. Exact match with note ID
  const exact = availableNotes.find((n) => n.id.toLowerCase() === cleanTarget);
  if (exact) return exact.id;

  // 2. Match with title
  const byTitle = availableNotes.find((n) => n.title.toLowerCase() === cleanTarget);
  if (byTitle) return byTitle.id;

  // 3. Match with basename (e.g. "alpha" matches "projects/alpha")
  const byBasename = availableNotes.find((n) => {
    const base = extractTitleFromId(n.id).toLowerCase();
    return base === cleanTarget;
  });
  if (byBasename) return byBasename.id;

  return normalizeNoteId(rawTarget); // Ghost note
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

      // 2. Build fast lookup maps
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
                title: extractTitleFromId(resolvedId),
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
        const folder = extractFolderFromId(n.id) || 'Kök (Root)';
        const outLinks = outgoingMap.get(n.id) || [];
        const inLinks = incomingMap.get(n.id) || [];
        const connectionCount = outLinks.length + inLinks.length;

        return {
          id: n.id,
          title: n.title || extractTitleFromId(n.id),
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
    const cleanId = normalizeNoteId(noteId);
    const cache = new Map(get().noteContentsCache);
    cache.set(cleanId, content);

    const { nodes, edges } = get();
    const currentNodes: GraphNode[] = [...nodes];

    // Ensure target node exists in list
    let targetNodeIndex = currentNodes.findIndex((n) => n.id === cleanId);
    if (targetNodeIndex === -1) {
      const folder = extractFolderFromId(cleanId) || 'Kök (Root)';
      const title = extractTitleFromId(cleanId);
      const newNode: GraphNode = {
        id: cleanId,
        title,
        path: cleanId,
        folder,
        tags: [],
        outgoingLinks: [],
        incomingLinks: [],
        connectionCount: 0,
        isOrphan: true,
      };
      currentNodes.push(newNode);
      targetNodeIndex = currentNodes.length - 1;
    }

    const rawOutgoing = extractWikilinks(content);
    const resolvedOutgoingSet = new Set<string>();

    for (const raw of rawOutgoing) {
      const resolvedId = resolveTargetNoteId(raw, currentNodes);
      if (resolvedId && resolvedId !== cleanId) {
        resolvedOutgoingSet.add(resolvedId);
      }
    }

    // Filter out previous outgoing edges from this source
    const preservedEdges = edges.filter((e) => e.source !== cleanId);
    const newEdges: GraphEdge[] = [...preservedEdges];

    for (const targetId of resolvedOutgoingSet) {
      newEdges.push({
        id: `${cleanId}->${targetId}`,
        source: cleanId,
        target: targetId,
      });
    }

    // High-performance $O(E + N)$ adjacency rebuild using Map lookups instead of $O(N \cdot E)$
    const outMap = new Map<string, string[]>();
    const inMap = new Map<string, string[]>();

    for (const edge of newEdges) {
      if (!outMap.has(edge.source)) outMap.set(edge.source, []);
      outMap.get(edge.source)!.push(edge.target);

      if (!inMap.has(edge.target)) inMap.set(edge.target, []);
      inMap.get(edge.target)!.push(edge.source);
    }

    const updatedNodes = currentNodes.map((node) => {
      const outList = outMap.get(node.id) || [];
      const inList = inMap.get(node.id) || [];
      const connectionCount = outList.length + inList.length;
      return {
        ...node,
        outgoingLinks: outList,
        incomingLinks: inList,
        connectionCount,
        isOrphan: connectionCount === 0,
      };
    });

    set({
      nodes: updatedNodes,
      edges: newEdges,
      noteContentsCache: cache,
    });
  },

  removeNoteFromGraph: (noteId: string) => {
    const cleanId = normalizeNoteId(noteId);
    const { nodes, edges } = get();
    const cache = new Map(get().noteContentsCache);
    cache.delete(cleanId);

    const filteredNodes = nodes.filter((n) => n.id !== cleanId);
    const filteredEdges = edges.filter((e) => e.source !== cleanId && e.target !== cleanId);

    set({
      nodes: filteredNodes,
      edges: filteredEdges,
      noteContentsCache: cache,
      selectedNodeId: get().selectedNodeId === cleanId ? null : get().selectedNodeId,
    });
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id ? normalizeNoteId(id) : null }),
  setHoveredNodeId: (id) => set({ hoveredNodeId: id ? normalizeNoteId(id) : null }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setShowOrphans: (showOrphans) => set({ showOrphans }),
  setGroupByFolder: (groupByFolder) => set({ groupByFolder }),
  setColorBy: (colorBy) => set({ colorBy }),
  setLocalGraphOnly: (localGraphOnly) => set({ localGraphOnly }),
  resetGraph: () =>
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      hoveredNodeId: null,
      searchQuery: '',
      noteContentsCache: new Map(),
    }),
}));
