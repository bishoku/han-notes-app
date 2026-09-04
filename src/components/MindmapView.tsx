import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import cytoscape, { type Core, type EventObject } from 'cytoscape';
// @ts-expect-error - cytoscape-fcose types
import fcose from 'cytoscape-fcose';
import { useGraphStore } from '@/store/graphStore';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import { MindmapToolbar } from '@/components/mindmap/MindmapToolbar';
import { MindmapNodeDetails } from '@/components/mindmap/MindmapNodeDetails';
import { Network, Loader2, Plus, Menu, Maximize2, RotateCcw } from 'lucide-react';

// Register fcose layout with cytoscape once
try {
  cytoscape.use(fcose);
} catch {
  // Already registered
}

// ─── Color Generator for Folders & Tags ──────────────────────────────────────

function stringToColor(str: string, isDark: boolean): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  const saturation = isDark ? 65 : 70;
  const lightness = isDark ? 60 : 45;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export const MindmapView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const theme = useUiStore((s) => s.theme);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const selectNote = useNoteStore((s) => s.selectNote);
  const createNote = useNoteStore((s) => s.createNote);

  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const layoutMode = useGraphStore((s) => s.layoutMode);
  const showOrphans = useGraphStore((s) => s.showOrphans);
  const groupByFolder = useGraphStore((s) => s.groupByFolder);
  const colorBy = useGraphStore((s) => s.colorBy);
  const localGraphOnly = useGraphStore((s) => s.localGraphOnly);
  const isLoading = useGraphStore((s) => s.isLoading);
  const buildFullGraph = useGraphStore((s) => s.buildFullGraph);
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  const setHoveredNodeId = useGraphStore((s) => s.setHoveredNodeId);

  const isDark = theme !== 'light';

  // 1. Build / Refresh Graph whenever MindmapView opens or notes change
  useEffect(() => {
    const currentNotes = useNoteStore.getState().notes;
    if (currentNotes.length > 0) {
      buildFullGraph(currentNotes, true);
    }
  }, [buildFullGraph]);

  // 2. Filtered Elements (Orphans, Local Graph, Search, Folder Sections)
  const visibleElements = useMemo(() => {
    let filteredNodes = [...nodes];

    // Filter Orphans
    if (!showOrphans) {
      filteredNodes = filteredNodes.filter((n) => !n.isOrphan);
    }

    // Local Graph Only (1st degree connections around selectedNodeId)
    if (localGraphOnly && selectedNodeId) {
      const selected = nodes.find((n) => n.id === selectedNodeId);
      if (selected) {
        const allowedIds = new Set([
          selectedNodeId,
          ...selected.outgoingLinks,
          ...selected.incomingLinks,
        ]);
        filteredNodes = filteredNodes.filter((n) => allowedIds.has(n.id));
      }
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    // Filter Edges to only include visible nodes
    const filteredEdges = edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    // Collect Folders for Compound Parent Nodes
    const folderNodes: any[] = [];
    const validFolders = new Set<string>();

    if (groupByFolder) {
      for (const n of filteredNodes) {
        if (!n.isGhost && n.folder && n.folder !== 'Kök (Root)') {
          validFolders.add(n.folder);
        }
      }

      for (const folder of validFolders) {
        folderNodes.push({
          data: {
            id: `folder:${folder}`,
            label: `📁 ${folder}`,
            isFolderGroup: true,
          },
        });
      }
    }

    const cyNodes = filteredNodes.map((node) => {
      let nodeColor = '#3b82f6';
      if (node.isGhost) {
        nodeColor = '#f59e0b';
      } else if (colorBy === 'folder') {
        nodeColor = stringToColor(node.folder, isDark);
      } else if (colorBy === 'tag' && node.tags.length > 0) {
        nodeColor = stringToColor(node.tags[0], isDark);
      } else if (colorBy === 'connections') {
        const count = node.connectionCount;
        if (count === 0) nodeColor = isDark ? '#71717a' : '#9ca3af';
        else if (count <= 2) nodeColor = '#06b6d4';
        else if (count <= 5) nodeColor = '#3b82f6';
        else nodeColor = '#8b5cf6';
      }

      const isSearchMatch =
        searchQuery.trim() !== '' &&
        (node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

      const size = Math.min(56, Math.max(26, 24 + node.connectionCount * 4));

      const parentId =
        groupByFolder && !node.isGhost && node.folder && validFolders.has(node.folder)
          ? `folder:${node.folder}`
          : undefined;

      return {
        data: {
          id: node.id,
          label: node.title,
          folder: node.folder,
          tags: node.tags,
          color: nodeColor,
          size,
          isGhost: !!node.isGhost,
          isSearchMatch,
          parent: parentId,
        },
      };
    });

    const cyEdges = filteredEdges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
      },
    }));

    return [...folderNodes, ...cyNodes, ...cyEdges];
  }, [nodes, edges, showOrphans, groupByFolder, localGraphOnly, selectedNodeId, colorBy, searchQuery, isDark]);

  // 3. Cytoscape Stylesheet based on theme
  const getCytoscapeStyle = useCallback(() => {
    const textColor = isDark ? '#e4e4e7' : '#27272a';
    const textBgColor = isDark ? 'rgba(24, 24, 27, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    const edgeColor = isDark ? 'rgba(113, 113, 122, 0.35)' : 'rgba(203, 213, 225, 0.6)';
    const edgeArrowColor = isDark ? 'rgba(161, 161, 170, 0.5)' : 'rgba(148, 163, 184, 0.7)';

    return [
      {
        selector: ':parent',
        style: {
          'background-color': isDark ? 'rgba(39, 39, 42, 0.4)' : 'rgba(241, 245, 249, 0.65)',
          'background-opacity': 0.65,
          'border-width': 1.5,
          'border-style': 'dashed',
          'border-color': isDark ? 'rgba(161, 161, 170, 0.3)' : 'rgba(148, 163, 184, 0.5)',
          'border-opacity': 0.8,
          'padding': '22px',
          'label': 'data(label)',
          'color': isDark ? '#a1a1aa' : '#64748b',
          'font-size': '12px',
          'font-weight': 700,
          'font-family': 'system-ui, -apple-system, sans-serif',
          'text-valign': 'top',
          'text-halign': 'center',
          'text-margin-y': -8,
          'text-background-opacity': 0,
        },
      },
      {
        selector: 'node[!isFolderGroup]',
        style: {
          'label': 'data(label)',
          'width': 'data(size)',
          'height': 'data(size)',
          'background-color': 'data(color)',
          'border-width': 2.5,
          'border-color': isDark ? '#18181b' : '#ffffff',
          'border-opacity': 0.9,
          'color': textColor,
          'font-size': '11px',
          'font-weight': 600,
          'font-family': 'system-ui, -apple-system, sans-serif',
          'text-valign': 'bottom',
          'text-margin-y': 6,
          'text-background-color': textBgColor,
          'text-background-opacity': 0.85,
          'text-background-padding': '2.5px',
          'text-background-shape': 'roundrectangle',
          'transition-property': 'background-color, border-color, width, height, opacity',
          'transition-duration': 0.15,
        },
      },
      {
        selector: 'node[?isGhost]',
        style: {
          'border-style': 'dashed',
          'border-width': 2,
          'opacity': 0.85,
        },
      },
      {
        selector: 'node[?isSearchMatch]',
        style: {
          'border-color': '#ec4899',
          'border-width': 4,
          'underlay-color': '#ec4899',
          'underlay-padding': '6px',
          'underlay-opacity': 0.5,
          'underlay-shape': 'ellipse',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-color': '#06b6d4',
          'border-width': 4,
          'underlay-color': '#06b6d4',
          'underlay-padding': '8px',
          'underlay-opacity': 0.6,
          'underlay-shape': 'ellipse',
        },
      },
      {
        selector: 'edge',
        style: {
          'width': 1.6,
          'line-color': edgeColor,
          'target-arrow-color': edgeArrowColor,
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.8,
          'curve-style': 'bezier',
          'transition-property': 'line-color, width, opacity',
          'transition-duration': 0.15,
        },
      },
      {
        selector: '.highlighted',
        style: {
          'line-color': '#3b82f6',
          'target-arrow-color': '#3b82f6',
          'width': 3,
          'opacity': 1,
          'z-index': 999,
        },
      },
      {
        selector: '.node-highlighted',
        style: {
          'border-color': '#3b82f6',
          'border-width': 3.5,
          'opacity': 1,
          'z-index': 999,
        },
      },
      {
        selector: '.dimmed',
        style: {
          'opacity': 0.18,
        },
      },
    ];
  }, [isDark]);

  // 4. Initialize Cytoscape Instance
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: visibleElements,
      style: getCytoscapeStyle() as any,
      minZoom: 0.15,
      maxZoom: 3.5,
    });

    cy.on('tap', 'node', (evt: EventObject) => {
      if (evt.target.isParent()) return;
      const id = evt.target.id();
      setSelectedNodeId(id);
    });

    cy.on('tap', (evt: EventObject) => {
      if (evt.target === cy) {
        setSelectedNodeId(null);
      }
    });

    let lastTap = 0;
    cy.on('tap', 'node', (evt: EventObject) => {
      if (evt.target.isParent()) return;
      const now = Date.now();
      if (now - lastTap < 300) {
        const id = evt.target.id();
        const targetNode = useGraphStore.getState().nodes.find((n) => n.id === id);
        if (targetNode?.isGhost) {
          createNote(targetNode.title).then((newId) => {
            setViewMode('notes');
            navigate(`/notes/${encodeURIComponent(newId)}`);
          });
        } else {
          selectNote(id);
          setViewMode('notes');
          navigate(`/notes/${encodeURIComponent(id)}`);
        }
      }
      lastTap = now;
    });

    cy.on('mouseover', 'node', (evt: EventObject) => {
      const node = evt.target;
      if (node.isParent()) return;
      setHoveredNodeId(node.id());

      const connectedEdges = node.connectedEdges();
      const connectedNodes = connectedEdges.connectedNodes();

      cy.elements().addClass('dimmed');
      node.removeClass('dimmed').addClass('node-highlighted');
      connectedNodes.removeClass('dimmed').addClass('node-highlighted');
      connectedEdges.removeClass('dimmed').addClass('highlighted');
    });

    cy.on('mouseout', 'node', () => {
      setHoveredNodeId(null);
      cy.elements().removeClass('dimmed highlighted node-highlighted');
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 5. Update Elements and Run Layout when structural configuration changes
  const prevTopologyKeyRef = useRef<string>('');
  const topologyKey = useMemo(() => {
    return `${nodes.length}_${edges.length}_${showOrphans}_${groupByFolder}_${localGraphOnly ? selectedNodeId : 'all'}_${layoutMode}`;
  }, [nodes.length, edges.length, showOrphans, groupByFolder, localGraphOnly, selectedNodeId, layoutMode]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.json({ elements: visibleElements });
    cy.style(getCytoscapeStyle() as any);

    if (prevTopologyKeyRef.current !== topologyKey && visibleElements.length > 0) {
      prevTopologyKeyRef.current = topologyKey;

      let layoutConfig: any = {
        name: 'fcose',
        quality: 'default',
        animate: true,
        animationDuration: 400,
        randomize: false,
        nestingFactor: 0.1,
        gravityCompound: 1.2,
        gravityRangeCompound: 2.0,
        nodeRepulsion: (node: any) => (node.isParent() ? 30000 : 5000),
      };

      if (layoutMode === 'breadthfirst') {
        layoutConfig = {
          name: 'breadthfirst',
          directed: true,
          spacingFactor: 1.5,
          animate: true,
          roots: selectedNodeId ? `#${CSS.escape(selectedNodeId)}` : undefined,
        };
      } else if (layoutMode === 'concentric') {
        layoutConfig = {
          name: 'concentric',
          concentric: (node: any) => node.data('size'),
          levelWidth: () => 1,
          animate: true,
        };
      } else if (layoutMode === 'circle') {
        layoutConfig = {
          name: 'circle',
          animate: true,
        };
      }

      cy.layout(layoutConfig).run();
    }
  }, [visibleElements, getCytoscapeStyle, topologyKey, layoutMode, selectedNodeId]);

  // Toolbar Handlers
  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() * 1.3,
        renderedPosition: {
          x: cyRef.current.width() / 2,
          y: cyRef.current.height() / 2,
        },
      });
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() * 0.75,
        renderedPosition: {
          x: cyRef.current.width() / 2,
          y: cyRef.current.height() / 2,
        },
      });
    }
  };

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50);
    }
  };

  const handleResetLayout = () => {
    if (cyRef.current) {
      let layoutConfig: any = { name: layoutMode, animate: true };
      if (layoutMode === 'fcose') {
        layoutConfig = { name: 'fcose', quality: 'proof', randomize: true, animate: true };
      }
      cyRef.current.layout(layoutConfig).run();
      cyRef.current.fit(undefined, 50);
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="relative flex-1 h-full w-full overflow-hidden bg-mac-mainLight dark:bg-mac-mainDark select-none flex flex-col">
      {/* Background Dot Matrix Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(${isDark ? '#ffffff' : '#000000'} 1.2px, transparent 1.2px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Mobile Dedicated Top Header */}
      <div className="md:hidden h-11 min-h-[44px] border-b border-mac-borderLight dark:border-mac-borderDark flex items-center justify-between px-3 shrink-0 bg-mac-mainLight/90 dark:bg-mac-mainDark/90 backdrop-blur-xs select-none z-30 pt-safe">
        <div className="flex items-center gap-2">
          <button
            onClick={() => useUiStore.getState().setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0 -ml-1 min-w-[38px] min-h-[38px] flex items-center justify-center active:scale-95"
            title={t('expandSidebar')}
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-xs text-gray-800 dark:text-gray-200">
            {t('knowledgeGraph', 'Bilgi Ağı')} ({nodes.filter((n) => !n.isGhost).length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleFit}
            className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={t('mindmapFit')}
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={handleResetLayout}
            className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={t('mindmapResetLayout')}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Top Floating Toolbar */}
      <MindmapToolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        onResetLayout={handleResetLayout}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-xs">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/90 dark:bg-zinc-900/90 shadow-2xl border border-gray-200 dark:border-zinc-800">
            <Loader2 size={18} className="animate-spin text-mac-accent" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t('mindmapBuildingNetwork')}
            </span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center max-w-sm p-8 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-3xl border border-gray-200/80 dark:border-zinc-800/80 shadow-2xl pointer-events-auto">
            <div className="w-14 h-14 rounded-2xl bg-mac-accent/10 text-mac-accent flex items-center justify-center mx-auto mb-4">
              <Network size={28} />
            </div>
            <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 mb-1">
              {t('noBacklinksTitle')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              {t('mindmapEmptyDesc')}
            </p>
            <button
              onClick={() => {
                setViewMode('notes');
                navigate('/notes');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-mac-accent text-white font-semibold text-xs rounded-xl shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Plus size={14} />
              {t('returnToNotes')}
            </button>
          </div>
        </div>
      )}

      {/* Cytoscape Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Selected Node Details Floating Card */}
      {selectedNode && (
        <MindmapNodeDetails
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onSelectNode={(id) => {
            setSelectedNodeId(id);
            if (cyRef.current) {
              const cyNode = cyRef.current.$id(id);
              if (cyNode.length > 0) {
                cyRef.current.animate({
                  center: { eles: cyNode },
                  zoom: 1.5,
                  duration: 400,
                });
              }
            }
          }}
        />
      )}
    </div>
  );
};
