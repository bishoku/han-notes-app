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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 mb-4 sm:mb-6 max-w-5xl w-full">
      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-2 min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">{t('totalDecisions')}</span>
          <span className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1">{totalCount}</span>
        </div>
        <div className="p-2 sm:p-3 bg-purple-500/10 text-purple-600 rounded-xl sm:rounded-2xl shrink-0">
          <FileCheck className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-2 min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">{t('approvedDecisions')}</span>
          <span className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 sm:mt-1">{approvedCount}</span>
        </div>
        <div className="p-2 sm:p-3 bg-emerald-500/10 text-emerald-600 rounded-xl sm:rounded-2xl shrink-0">
          <CheckCircle2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-2 min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">{t('pendingDrafts')}</span>
          <span className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-1">{draftCount}</span>
        </div>
        <div className="p-2 sm:p-3 bg-amber-500/10 text-amber-600 rounded-xl sm:rounded-2xl shrink-0">
          <Clock className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-2 min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">{t('decisionMostActive')}</span>
          <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1 truncate max-w-[90px] sm:max-w-[120px]" title={topPerson}>
            {topPerson}
          </span>
        </div>
        <div className="p-2 sm:p-3 bg-blue-500/10 text-blue-600 rounded-xl sm:rounded-2xl shrink-0">
          <TrendingUp className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  );
};

