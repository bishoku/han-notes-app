import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileCheck, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

interface DecisionsStatsProps {
  totalCount: number;
  approvedCount: number;
  draftCount: number;
  topPerson: string;
}

export const DecisionsStats: React.FC<DecisionsStatsProps> = ({
  totalCount,
  approvedCount,
  draftCount,
  topPerson,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-4 gap-4 mb-6 max-w-5xl">
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-500">{t('totalDecisions')}</span>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{totalCount}</span>
        </div>
        <div className="p-3 bg-purple-500/10 text-purple-600 rounded-2xl">
          <FileCheck size={20} />
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-500">{t('approvedDecisions')}</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{approvedCount}</span>
        </div>
        <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl">
          <CheckCircle2 size={20} />
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-500">{t('pendingDrafts')}</span>
          <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{draftCount}</span>
        </div>
        <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl">
          <Clock size={20} />
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-500">{t('decisionMostActive')}</span>
          <span className="text-base font-bold text-gray-900 dark:text-gray-100 mt-1 truncate max-w-[120px]" title={topPerson}>
            {topPerson}
          </span>
        </div>
        <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl">
          <TrendingUp size={20} />
        </div>
      </div>
    </div>
  );
};

