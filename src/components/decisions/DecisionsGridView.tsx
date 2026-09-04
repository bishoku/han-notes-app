import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, SlidersHorizontal } from 'lucide-react';
import type { DecisionInfo } from '@/services/storage';
import type { DecisionEditData } from '@/components/DecisionEditModal';
import { DecisionStatusBadge } from './DecisionsTimelineView';

interface DecisionsGridViewProps {
  filteredDecisions: DecisionInfo[];
  onSelectNote: (noteId: string) => void;
  onEditDecision: (data: DecisionEditData) => void;
}

export const DecisionsGridView: React.FC<DecisionsGridViewProps> = ({
  filteredDecisions,
  onSelectNote,
  onEditDecision,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full">
      {filteredDecisions.map((decision, idx) => (
        <div 
          key={`${decision.note_id}-${decision.line_number}-${idx}`}
          className="flex flex-col justify-between p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs hover:shadow-md transition-all gap-3 min-w-0"
        >
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <span className="font-bold text-gray-900 dark:text-gray-100 leading-snug text-sm sm:text-base break-words min-w-0">
                {decision.content}
              </span>
              <div className="shrink-0">
                <DecisionStatusBadge status={decision.status} />
              </div>
            </div>
            {decision.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 break-words">
                {decision.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800/60 text-xs">
            <button 
              onClick={() => onSelectNote(decision.note_id)}
              className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-purple-600 transition-colors cursor-pointer truncate max-w-[200px] sm:max-w-xs"
            >
              <FileText size={12} className="shrink-0" />
              <span className="truncate">{decision.note_id}</span>
            </button>

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
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-purple-600 transition-colors cursor-pointer shrink-0"
              title={t('editDecisionTitle')}
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

