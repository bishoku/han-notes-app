import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileCheck, GitCommit, LayoutGrid, Filter, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/DateRangePicker';
import type { DecisionStatusFilter } from './useDecisionAnalytics';

interface DecisionsHeaderProps {
  viewStyle: 'timeline' | 'grid';
  setViewStyle: (style: 'timeline' | 'grid') => void;
  totalCount: number;
  approvedCount: number;
  draftCount: number;
  activeStatusFilter: DecisionStatusFilter;
  setActiveStatusFilter: (status: DecisionStatusFilter) => void;
  dateFilterStart: string;
  setDateFilterStart: (val: string) => void;
  dateFilterEnd: string;
  setDateFilterEnd: (val: string) => void;
  availableParticipants: string[];
  activeParticipantFilter: string;
  setActiveParticipantFilter: (person: string) => void;
}

export const DecisionsHeader: React.FC<DecisionsHeaderProps> = ({
  viewStyle,
  setViewStyle,
  totalCount,
  approvedCount,
  draftCount,
  activeStatusFilter,
  setActiveStatusFilter,
  dateFilterStart,
  setDateFilterStart,
  dateFilterEnd,
  setDateFilterEnd,
  availableParticipants,
  activeParticipantFilter,
  setActiveParticipantFilter,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Title Header */}
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-gray-100">
          <FileCheck size={32} className="text-purple-600 dark:text-purple-400" />
          {t('decisionRecords')}
        </h1>

        {/* View Mode Toggle (Timeline vs Grid) */}
        <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setViewStyle('timeline')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              viewStyle === 'timeline' ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <GitCommit size={14} /> {t('decisionTimelineView')}
          </button>
          <button
            onClick={() => setViewStyle('grid')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              viewStyle === 'grid' ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <LayoutGrid size={14} /> {t('decisionGridView')}
          </button>
        </div>
      </div>

      {/* Filter Section Container */}
      <div className="flex flex-col gap-3 mb-6 max-w-5xl bg-gray-50 dark:bg-zinc-900/60 p-3.5 rounded-2xl border border-gray-200/80 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mr-1">
              <Filter size={13} />
              <span>{t('decisionStatusFilter')}:</span>
            </div>
            <button
              onClick={() => setActiveStatusFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                activeStatusFilter === 'all' ? "bg-purple-600 text-white shadow-sm" : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700"
              )}
            >
              {t('decisionAll')} ({totalCount})
            </button>
            <button
              onClick={() => setActiveStatusFilter('approved')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
                activeStatusFilter === 'approved' ? "bg-emerald-600 text-white shadow-sm" : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
              )}
            >
              {t('decisionApproved')} ({approvedCount})
            </button>
            <button
              onClick={() => setActiveStatusFilter('draft')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
                activeStatusFilter === 'draft' ? "bg-amber-600 text-white shadow-sm" : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
              )}
            >
              {t('decisionDrafts')} ({draftCount})
            </button>
          </div>

          {/* Date Range Picker Filter */}
          <div className="w-64">
            <DateRangePicker
              startDate={dateFilterStart}
              endDate={dateFilterEnd}
              onChange={(s, e) => {
                setDateFilterStart(s);
                setDateFilterEnd(e);
              }}
            />
          </div>
        </div>

        {/* Participant Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mr-1">
            <Users size={13} />
            <span>{t('decisionParticipantsFilter')}:</span>
          </div>
          <button
            onClick={() => setActiveParticipantFilter('all')}
            className={cn(
              "px-3 py-1 rounded-xl text-xs font-semibold transition-all",
              activeParticipantFilter === 'all' ? "bg-purple-600 text-white shadow-sm" : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700"
            )}
          >
            {t('decisionAllParticipants')}
          </button>
          {availableParticipants.map(person => (
            <button
              key={person}
              onClick={() => setActiveParticipantFilter(person)}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1",
                activeParticipantFilter === person 
                  ? "bg-purple-600 text-white shadow-sm" 
                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20"
              )}
            >
              <User size={11} /> {person}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

