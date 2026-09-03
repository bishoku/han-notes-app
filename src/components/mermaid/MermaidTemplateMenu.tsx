import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  GitFork,
  ArrowRightLeft,
  Layers,
  Activity,
  Database,
  Calendar,
  GitBranch,
  Brain,
  PieChart,
  Cpu,
} from 'lucide-react';
import { MERMAID_TEMPLATES, type MermaidTemplate } from '@/editor/mermaid/mermaidTemplates';

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  flowchart: <GitFork size={13} className="text-teal-500 shrink-0" />,
  sequence: <ArrowRightLeft size={13} className="text-blue-500 shrink-0" />,
  class: <Layers size={13} className="text-indigo-500 shrink-0" />,
  state: <Activity size={13} className="text-amber-500 shrink-0" />,
  er: <Database size={13} className="text-emerald-500 shrink-0" />,
  gantt: <Calendar size={13} className="text-rose-500 shrink-0" />,
  gitgraph: <GitBranch size={13} className="text-violet-500 shrink-0" />,
  mindmap: <Brain size={13} className="text-fuchsia-500 shrink-0" />,
  pie: <PieChart size={13} className="text-orange-500 shrink-0" />,
  architecture: <Cpu size={13} className="text-cyan-500 shrink-0" />,
};

interface MermaidTemplateMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onSelectTemplate: (tpl: MermaidTemplate) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

export const MermaidTemplateMenu: React.FC<MermaidTemplateMenuProps> = ({
  isOpen,
  onToggle,
  onSelectTemplate,
  menuRef,
}) => {
  const { t, i18n } = useTranslation();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xs transition-colors cursor-pointer"
      >
        <Sparkles size={13} className="text-amber-500" />
        <span>{t('mermaidTemplates', 'Hazır Şablonlar')}</span>
      </button>

      {isOpen && (
        <div className="absolute top-10 right-0 w-64 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {t('selectTemplate', 'Şablon Seçin')}
          </div>
          <div className="max-h-72 overflow-y-auto space-y-0.5">
            {MERMAID_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onSelectTemplate(tpl)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg transition-colors cursor-pointer"
              >
                {TEMPLATE_ICONS[tpl.id] || <GitFork size={13} />}
                <span className="truncate">{i18n.language === 'tr' ? tpl.nameTr : tpl.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
