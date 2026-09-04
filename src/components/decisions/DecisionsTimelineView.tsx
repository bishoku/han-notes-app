import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Calendar, User, ShieldCheck, Tag, SlidersHorizontal, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { DecisionInfo } from '@/services/storage';
import type { DecisionEditData } from '@/components/DecisionEditModal';

interface DecisionsTimelineViewProps {
  filteredDecisions: DecisionInfo[];
  onSelectNote: (noteId: string) => void;
  onEditDecision: (data: DecisionEditData) => void;
}

export const DecisionStatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const { t } = useTranslation();
  const st = status || 'approved';
  switch (st) {
    case 'approved':
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={11} /> {t('decisionApprovedBadge')}
        </span>
      );
    case 'draft':
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock size={11} /> {t('decisionDraftBadge')}
        </span>
      );
    case 'deferred':
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">
          <AlertCircle size={11} /> {t('decisionDeferredBadge')}
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
  const { t } = useTranslation();

  return (
    <div className="relative pl-5 sm:pl-7 border-l-2 border-purple-500/30 flex flex-col gap-4 sm:gap-6 ml-2 sm:ml-3">
      {filteredDecisions.map((decision, idx) => (
        <div key={`${decision.note_id}-${decision.line_number}-${idx}`} className="relative group">
          <div className="absolute -left-[27px] sm:-left-[35px] top-2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-purple-600 border-2 sm:border-4 border-white dark:border-zinc-950 shadow-xs" />

          <div className="flex flex-col gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs hover:shadow-md transition-all min-w-0">
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 break-words min-w-0">
                    {decision.content}
                  </span>
                  <div className="shrink-0">
                    <DecisionStatusBadge status={decision.status} />
                  </div>
                </div>
                {decision.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mt-1 break-words">
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
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-purple-600 transition-colors cursor-pointer"
                  title={t('editDecisionTitle')}
                >
                  <SlidersHorizontal size={15} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs pt-2 border-t border-gray-100 dark:border-zinc-800/60">
              <button 
                onClick={() => onSelectNote(decision.note_id)}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-purple-500/10 hover:text-purple-600 rounded-lg font-medium text-gray-600 dark:text-gray-400 transition-colors cursor-pointer truncate max-w-[180px] sm:max-w-none text-[11px]"
              >
                <FileText size={12} className="shrink-0" />
                <span className="truncate">{decision.note_id}</span>
              </button>

              {decision.date && (
                <span className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg font-mono text-[10px] sm:text-[11px] text-gray-600 dark:text-gray-400">
                  <Calendar size={11} className="shrink-0" /> {decision.date}
                </span>
              )}

              {decision.participants.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {decision.participants.map(p => (
                    <span key={p} className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-md font-medium text-[10px] sm:text-[11px]">
                      <User size={10} className="shrink-0" /> {p}
                    </span>
                  ))}
                </div>
              )}

              {decision.approved_by.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {decision.approved_by.map(a => (
                    <span key={a} className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md font-bold text-[10px] sm:text-[11px]">
                      <ShieldCheck size={10} className="shrink-0" /> {t('decisionApprovedByLabel')} {a}
                    </span>
                  ))}
                </div>
              )}

              {decision.tags && decision.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {decision.tags.map(t => (
                    <span key={t} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 rounded-md text-[10px] font-mono">
                      <Tag size={10} className="shrink-0" /> #{t}
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

