/**
 * MindmapNodeDetails.tsx — Floating inspector panel displaying details,
 * connections, and direct navigation for the selected note node.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGraphStore, type GraphNode } from '@/store/graphStore';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import {
  FileText,
  Folder,
  Tag,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  PlusCircle,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MindmapNodeDetailsProps {
  node: GraphNode;
  onClose: () => void;
  onSelectNode: (id: string) => void;
}

export const MindmapNodeDetails: React.FC<MindmapNodeDetailsProps> = ({
  node,
  onClose,
  onSelectNode,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectNote, createNote, notes } = useNoteStore();
  const { setViewMode } = useUiStore();
  const { localGraphOnly, setLocalGraphOnly } = useGraphStore();

  const handleOpenNote = async () => {
    if (node.isGhost) {
      const newId = await createNote(node.title);
      setViewMode('notes');
      navigate(`/notes/${encodeURIComponent(newId)}`);
    } else {
      await selectNote(node.id);
      setViewMode('notes');
      navigate(`/notes/${encodeURIComponent(node.id)}`);
    }
  };

  return (
    <div className="absolute bottom-6 right-6 z-30 w-80 max-h-[75vh] flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200/90 dark:border-zinc-800/90 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-gray-100 dark:border-zinc-800/80 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={cn(
            "p-2 rounded-2xl shrink-0 mt-0.5 shadow-2xs",
            node.isGhost 
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              : "bg-mac-accent/10 text-mac-accent border border-mac-accent/20"
          )}>
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate leading-tight">
              {node.title}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 mt-1 truncate">
              <Folder size={11} className="shrink-0" />
              <span className="truncate">{node.folder}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          title={t('close')}
        >
          <X size={15} />
        </button>
      </div>

      {/* Body / Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Tags */}
        {node.tags && node.tags.length > 0 && (
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
              {t('tags')}
            </span>
            <div className="flex flex-wrap gap-1">
              {node.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                >
                  <Tag size={9} />
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ghost Note Alert */}
        {node.isGhost && (
          <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
            {t('mindmapGhostAlert')}
          </div>
        )}

        {/* Outgoing Links */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            <span className="flex items-center gap-1">
              <ArrowUpRight size={11} className="text-blue-500" />
              {t('mindmapOutgoingLinks')} ({node.outgoingLinks.length})
            </span>
          </div>
          {node.outgoingLinks.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic">---</p>
          ) : (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {node.outgoingLinks.map((targetId) => {
                const targetNote = notes.find((n) => n.id === targetId);
                const display = targetNote?.title || targetId.split('/').pop() || targetId;
                return (
                  <button
                    key={targetId}
                    onClick={() => onSelectNode(targetId)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-zinc-800/80 hover:bg-mac-accent/10 hover:text-mac-accent text-left transition-colors group cursor-pointer"
                  >
                    <span className="truncate font-medium">{display}</span>
                    <ArrowUpRight size={12} className="text-gray-400 group-hover:text-mac-accent shrink-0 ml-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Incoming Backlinks */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            <span className="flex items-center gap-1">
              <ArrowDownLeft size={11} className="text-emerald-500" />
              {t('mindmapIncomingLinks')} ({node.incomingLinks.length})
            </span>
          </div>
          {node.incomingLinks.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic">{t('noResultsFound')}</p>
          ) : (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {node.incomingLinks.map((sourceId) => {
                const sourceNote = notes.find((n) => n.id === sourceId);
                const display = sourceNote?.title || sourceId.split('/').pop() || sourceId;
                return (
                  <button
                    key={sourceId}
                    onClick={() => onSelectNode(sourceId)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-zinc-800/80 hover:bg-mac-accent/10 hover:text-mac-accent text-left transition-colors group cursor-pointer"
                  >
                    <span className="truncate font-medium">{display}</span>
                    <ArrowDownLeft size={12} className="text-gray-400 group-hover:text-mac-accent shrink-0 ml-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-900/50 flex flex-col gap-2">
        <button
          onClick={handleOpenNote}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-mac-accent hover:opacity-90 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-sm transition-all cursor-pointer"
        >
          {node.isGhost ? (
            <>
              <PlusCircle size={14} />
              <span>{t('mindmapCreateNote')}</span>
            </>
          ) : (
            <>
              <ExternalLink size={14} />
              <span>{t('mindmapOpenInEditor')}</span>
            </>
          )}
        </button>

        <button
          onClick={() => setLocalGraphOnly(!localGraphOnly)}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border text-[11px] font-medium transition-colors cursor-pointer",
            localGraphOnly
              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-semibold"
              : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100"
          )}
        >
          <Sparkles size={12} />
          <span>{localGraphOnly ? t('mindmapAllNetwork') : t('mindmapInspectSubnetwork')}</span>
        </button>
      </div>
    </div>
  );
};

