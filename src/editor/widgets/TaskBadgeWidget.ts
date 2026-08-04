/**
 * TaskBadgeWidget.ts — CodeMirror WidgetType for rendering inline task
 * metadata badges (dates, priority, assignees, progress, tags).
 */
import { WidgetType } from '@codemirror/view';
import { createBadge, createBadgeWrapper, appendTagBadges } from './badgeUtils';

export class TaskBadgeWidget extends WidgetType {
  meta: any;
  private _hash: string;

  constructor(meta: any) {
    super();
    this.meta = meta;
    this._hash = JSON.stringify(meta);
  }

  toDOM() {
    const wrap = createBadgeWrapper();
    const today = new Date().toISOString().split('T')[0];

    // Overdue or Date Range
    if (this.meta.end_date) {
      const isOverdue = this.meta.end_date < today && (this.meta.progress ?? 0) < 100;
      if (isOverdue) {
        wrap.appendChild(createBadge(
          'px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1',
          `🚨 Gecikmiş (${this.meta.end_date})`
        ));
      } else {
        wrap.appendChild(createBadge(
          'px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700',
          `📅 ${this.meta.start_date ? `${this.meta.start_date} ~ ` : ''}${this.meta.end_date}`
        ));
      }
    } else if (this.meta.start_date) {
      wrap.appendChild(createBadge(
        'px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700',
        `📅 ${this.meta.start_date}`
      ));
    }

    // Priority
    if (this.meta.priority) {
      const p = String(this.meta.priority).toLowerCase();
      const priorityMap: Record<string, { cls: string; label: string }> = {
        urgent: { cls: 'px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white shadow-xs', label: 'Acil' },
        acil: { cls: 'px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white shadow-xs', label: 'Acil' },
        high: { cls: 'px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500 text-white shadow-xs', label: 'Yüksek' },
        'yüksek': { cls: 'px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500 text-white shadow-xs', label: 'Yüksek' },
        medium: { cls: 'px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30', label: 'Orta' },
        orta: { cls: 'px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30', label: 'Orta' },
        low: { cls: 'px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30', label: 'Düşük' },
        'düşük': { cls: 'px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30', label: 'Düşük' },
      };
      const entry = priorityMap[p];
      if (entry) {
        wrap.appendChild(createBadge(entry.cls, entry.label));
      }
    }

    // Multi-Assignees
    const assigneesList = Array.isArray(this.meta.assignees) && this.meta.assignees.length > 0
      ? this.meta.assignees
      : (this.meta.assignee ? [this.meta.assignee] : []);

    for (const person of assigneesList) {
      wrap.appendChild(createBadge(
        'px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
        `👤 ${person}`
      ));
    }

    // Progress
    if (this.meta.progress != null && this.meta.progress > 0 && this.meta.progress < 100) {
      wrap.appendChild(createBadge(
        'px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-mac-accent/10 text-mac-accent border border-mac-accent/20',
        `📊 %${this.meta.progress}`
      ));
    }

    // Tags
    appendTagBadges(wrap, this.meta.tags);

    return wrap;
  }

  eq(other: TaskBadgeWidget) {
    return this._hash === other._hash;
  }
}
