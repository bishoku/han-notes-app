import React from 'react';
import { FileText, Calendar, User, ShieldCheck, Tag, SlidersHorizontal, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { DecisionInfo } from '@/services/storage';
import type { DecisionEditData } from '@/components/DecisionEditModal';

interface DecisionsTimelineViewProps {
  filteredDecisions: DecisionInfo[];
  onSelectNote: (noteId: string) => void;
  onEditDecision: (data: DecisionEditData) => void;
}

export const getDecisionStatusBadge = (status?: string | null) => {
  const st = status || 'approved';
  switch (st) {
    case 'approved':
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={11} /> Onaylandı
        </span>
      );
    case 'draft':
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock size={11} /> Taslak / Bekliyor
        </span>
      );
    case 'deferred':
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">
          <AlertCircle size={11} /> Ertelendi
        </span>
      );
    default:
      return null;
  }
};

export const DecisionsTimelineView: React.FC<DecisionsTimelineViewProps> = ({
  filteredDecisions,
  onSelectNote,
  onEditDecision,
}) => {
  return (
    <div className="relative pl-6 border-l-2 border-purple-500/30 flex flex-col gap-6">
      {filteredDecisions.map((decision, idx) => (
        <div key={`${decision.note_id}-${decision.line_number}-${idx}`} className="relative group">
          <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-purple-600 border-4 border-white dark:border-zinc-950 shadow-sm" />

          <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-2xs hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {decision.content}
                  </span>
                  {getDecisionStatusBadge(decision.status)}
                </div>
                {decision.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mt-1">
                    {decision.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onEditDecision({
                    noteId: decision.note_id,
                    lineNumber: decision.line_number,
                    content: decision.content,
                    description: decision.description,
                    date: decision.date,
                    status: decision.status,
                    participants: decision.participants,
                    approvedBy: decision.approved_by,
                    tags: decision.tags,
                  })}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-purple-600 transition-colors"
                  title="Kararı Düzenle"
                >
                  <SlidersHorizontal size={15} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-gray-50 dark:border-zinc-800/60">
              <button 
                onClick={() => onSelectNote(decision.note_id)}
                className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-purple-500/10 hover:text-purple-600 rounded-lg font-medium text-gray-600 dark:text-gray-400 transition-colors"
              >
                <FileText size={12} />
                {decision.note_id}
              </button>

              {decision.date && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg font-mono text-[11px] text-gray-600 dark:text-gray-400">
                  <Calendar size={11} /> {decision.date}
                </span>
              )}

              {decision.participants.length > 0 && (
                <div className="flex items-center gap-1">
                  {decision.participants.map(p => (
                    <span key={p} className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-md font-medium text-[11px]">
                      <User size={10} /> {p}
                    </span>
                  ))}
                </div>
              )}

              {decision.approved_by.length > 0 && (
                <div className="flex items-center gap-1">
                  {decision.approved_by.map(a => (
                    <span key={a} className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md font-bold text-[11px]">
                      <ShieldCheck size={10} /> Onay: {a}
                    </span>
                  ))}
                </div>
              )}

              {decision.tags && decision.tags.length > 0 && (
                <div className="flex items-center gap-1 ml-auto">
                  {decision.tags.map(t => (
                    <span key={t} className="flex items-center gap-0.5 px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 rounded-md text-[10px] font-mono">
                      <Tag size={10} /> #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
