import React from 'react';
import { useTranslation } from 'react-i18next';

interface MermaidSnippetChipsProps {
  onInsertSnippet: (snippet: string) => void;
}

export const MermaidSnippetChips: React.FC<MermaidSnippetChipsProps> = ({ onInsertSnippet }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-100/60 dark:bg-zinc-800/40 border-b border-gray-200 dark:border-zinc-800 overflow-x-auto text-[11px] shrink-0">
      <span className="text-gray-400 font-medium shrink-0">{t('quickInsert')}</span>
      <button
        type="button"
        onClick={() => onInsertSnippet('--> ')}
        className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
      >
        {'-->'}
      </button>
      <button
        type="button"
        onClick={() => onInsertSnippet('subgraph GroupName [Title]\n    A --> B\nend\n')}
        className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
      >
        subgraph
      </button>
      <button
        type="button"
        onClick={() => onInsertSnippet('[(Database)]')}
        className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
      >
        [(DB)]
      </button>
      <button
        type="button"
        onClick={() => onInsertSnippet('{Decision?}')}
        className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
      >
        {'{Decision}'}
      </button>
      <button
        type="button"
        onClick={() => onInsertSnippet('([Stadium])')}
        className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
      >
        ([Pill])
      </button>
      <button
        type="button"
        onClick={() => onInsertSnippet('classDef highlight fill:#3b82f620,stroke:#3b82f6,stroke-width:2px;\n')}
        className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
      >
        classDef
      </button>
    </div>
  );
};
