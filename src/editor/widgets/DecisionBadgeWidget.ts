/**
 * DecisionBadgeWidget.ts — CodeMirror WidgetType for rendering inline
 * decision metadata badges (status, date, participants, approvers, tags).
 */
import { WidgetType } from '@codemirror/view';
import { createBadge, createBadgeWrapper, appendTagBadges } from './badgeUtils';

// ─── Status configuration ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { cls: string; label: string }> = {
  approved: {
    cls: 'px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5',
    label: '⚖️ Onaylandı',
  },
  draft: {
    cls: 'px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-0.5',
    label: '⏳ Taslak',
  },
};

const DEFAULT_STATUS = {
  cls: 'px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/15 text-gray-600 dark:text-gray-400 border border-gray-500/30 flex items-center gap-0.5',
  label: '⏸️ Ertelendi',
};

// ─── Widget ──────────────────────────────────────────────────────────────────

export class DecisionBadgeWidget extends WidgetType {
  meta: any;
  private _hash: string;

  constructor(meta: any) {
    super();
    this.meta = meta;
    this._hash = JSON.stringify(meta);
  }

  toDOM() {
    const wrap = createBadgeWrapper();

    // Status
    const st = (this.meta.status || 'approved').toLowerCase();
    const statusEntry = STATUS_CONFIG[st] || DEFAULT_STATUS;
    wrap.appendChild(createBadge(statusEntry.cls, statusEntry.label));

    // Date
    if (this.meta.date) {
      wrap.appendChild(createBadge(
        'px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
        `📅 ${this.meta.date}`
      ));
    }

    // Participants
    if (Array.isArray(this.meta.participants)) {
      for (const person of this.meta.participants) {
        wrap.appendChild(createBadge(
          'px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
          `👥 ${person}`
        ));
      }
    }

    // Approved By
    if (Array.isArray(this.meta.approved_by)) {
      for (const approver of this.meta.approved_by) {
        wrap.appendChild(createBadge(
          'px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
          `✓ Onay: ${approver}`
        ));
      }
    }

    // Tags
    appendTagBadges(wrap, this.meta.tags);

    return wrap;
  }

  eq(other: DecisionBadgeWidget) {
    return this._hash === other._hash;
  }
}
