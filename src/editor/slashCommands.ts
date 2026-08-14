/**
 * slashCommands.ts — Slash command definitions and executor.
 * 
 * This module contains the static command metadata (label, icon, snippet)
 * separated from the React component lifecycle. The `execute` callbacks
 * are bound at the component level via `buildSlashCommands()`.
 * 
 * i18n: Label and description use translation keys resolved at build time
 * via the `t` function passed into `buildSlashCommands()`.
 */
import React from 'react';
import {
  Tag,
  CheckSquare,
  ShieldCheck,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Table,
  Image as ImageIcon,
  Workflow,
  Info,
  AlertTriangle,
  Lightbulb,
  Minus,
} from 'lucide-react';
import type { SlashCommand } from '@/components/SlashCommandMenu';
import type { TFunction } from 'i18next';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SlashCommandDef {
  id: string;
  /** i18n key for label */
  labelKey: string;
  command: string;
  /** i18n key for description */
  descriptionKey: string;
  /** i18n category key — resolved at build time */
  category: string;
  colorClass: string;
  icon: React.ReactNode;
  /** Text to insert. Empty string for commands that trigger modals/pickers. */
  snippet: string;
  /** Where to place the cursor relative to the insert start. Defaults to end of snippet. */
  cursorOffset?: number;
  /** Special action type for non-insert commands */
  action?: 'openTagModal' | 'openImagePicker' | 'openDiagramEditor';
}

// ─── Static Definitions ──────────────────────────────────────────────────────

const SLASH_COMMAND_DEFS: SlashCommandDef[] = [
  {
    id: 'tag',
    labelKey: 'slashTag',
    command: '/tag',
    descriptionKey: 'slashTagDesc',
    category: 'Organizasyon',
    colorClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    icon: React.createElement(Tag, { size: 14 }),
    snippet: '',
    action: 'openTagModal',
  },
  {
    id: 'task',
    labelKey: 'slashTask',
    command: '/task',
    descriptionKey: 'slashTaskDesc',
    category: 'Organizasyon',
    colorClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    icon: React.createElement(CheckSquare, { size: 14 }),
    snippet: '- [ ] ',
  },
  {
    id: 'decision',
    labelKey: 'slashDecision',
    command: '/decision',
    descriptionKey: 'slashDecisionDesc',
    category: 'Organizasyon',
    colorClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    icon: React.createElement(ShieldCheck, { size: 14 }),
    snippet: '- [D] ',
  },
  {
    id: 'code',
    labelKey: 'slashCodeBlock',
    command: '/code',
    descriptionKey: 'slashCodeBlockDesc',
    category: 'Format',
    colorClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    icon: React.createElement(Code, { size: 14 }),
    snippet: '```typescript\n\n```',
    cursorOffset: 15,
  },
  {
    id: 'h1',
    labelKey: 'slashHeading1',
    command: '/h1',
    descriptionKey: 'slashHeading1Desc',
    category: 'Format',
    colorClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    icon: React.createElement(Heading1, { size: 14 }),
    snippet: '# ',
  },
  {
    id: 'h2',
    labelKey: 'slashHeading2',
    command: '/h2',
    descriptionKey: 'slashHeading2Desc',
    category: 'Format',
    colorClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    icon: React.createElement(Heading2, { size: 14 }),
    snippet: '## ',
  },
  {
    id: 'h3',
    labelKey: 'slashHeading3',
    command: '/h3',
    descriptionKey: 'slashHeading3Desc',
    category: 'Format',
    colorClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    icon: React.createElement(Heading3, { size: 14 }),
    snippet: '### ',
  },
  {
    id: 'quote',
    labelKey: 'slashQuote',
    command: '/quote',
    descriptionKey: 'slashQuoteDesc',
    category: 'Format',
    colorClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    icon: React.createElement(Quote, { size: 14 }),
    snippet: '> ',
  },
  {
    id: 'table',
    labelKey: 'slashTable',
    command: '/table',
    descriptionKey: 'slashTableDesc',
    category: 'Format',
    colorClass: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
    icon: React.createElement(Table, { size: 14 }),
    snippet: '| Col 1 | Col 2 |\n| --- | --- |\n| Data 1 | Data 2 |\n',
  },
  {
    id: 'image',
    labelKey: 'slashImage',
    command: '/image',
    descriptionKey: 'slashImageDesc',
    category: 'Format',
    colorClass: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
    icon: React.createElement(ImageIcon, { size: 14 }),
    snippet: '',
    action: 'openImagePicker',
  },
  {
    id: 'diagram',
    labelKey: 'slashDiagram',
    command: '/diagram',
    descriptionKey: 'slashDiagramDesc',
    category: 'Format',
    colorClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    icon: React.createElement(Workflow, { size: 14 }),
    snippet: '',
    action: 'openDiagramEditor',
  },
  {
    id: 'note',
    labelKey: 'slashNoteCallout',
    command: '/note',
    descriptionKey: 'slashNoteCalloutDesc',
    category: 'Format',
    colorClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    icon: React.createElement(Info, { size: 14 }),
    snippet: '> [!NOTE] Bilgi Notu\n> Açıklama metninizi buraya yazabilirsiniz.\n',
  },
  {
    id: 'warning',
    labelKey: 'slashWarningCallout',
    command: '/warning',
    descriptionKey: 'slashWarningCalloutDesc',
    category: 'Format',
    colorClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    icon: React.createElement(AlertTriangle, { size: 14 }),
    snippet: '> [!WARNING] Uyarı Notu\n> Uyarı açıklamasını buraya yazabilirsiniz.\n',
  },
  {
    id: 'tip',
    labelKey: 'slashTipCallout',
    command: '/tip',
    descriptionKey: 'slashTipCalloutDesc',
    category: 'Format',
    colorClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    icon: React.createElement(Lightbulb, { size: 14 }),
    snippet: '> [!TIP] İpucu Notu\n> İpucu açıklamasını buraya yazabilirsiniz.\n',
  },
  {
    id: 'hr',
    labelKey: 'slashHR',
    command: '/hr',
    descriptionKey: 'slashHRDesc',
    category: 'Format',
    colorClass: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
    icon: React.createElement(Minus, { size: 14 }),
    snippet: '---\n',
  },
];

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Builds executable SlashCommand[] from static definitions.
 * Call inside a useMemo with the required callbacks as dependencies.
 * 
 * @param t - i18n translation function from useTranslation()
 */
export function buildSlashCommands(
  executeSlashCommand: (text: string, opts?: { cursorOffset?: number; openTagModal?: boolean }) => void,
  openImagePicker: () => void,
  openDiagramEditor: () => void,
  t: TFunction,
): SlashCommand[] {
  return SLASH_COMMAND_DEFS.map((def) => ({
    id: def.id,
    label: t(def.labelKey),
    command: def.command,
    description: t(def.descriptionKey),
    category: def.category,
    colorClass: def.colorClass,
    icon: def.icon,
    execute: () => {
      if (def.action === 'openTagModal') {
        executeSlashCommand('', { openTagModal: true });
      } else if (def.action === 'openImagePicker') {
        executeSlashCommand('');
        openImagePicker();
      } else if (def.action === 'openDiagramEditor') {
        executeSlashCommand('');
        openDiagramEditor();
      } else {
        executeSlashCommand(def.snippet, def.cursorOffset ? { cursorOffset: def.cursorOffset } : undefined);
      }
    },
  }));
}
