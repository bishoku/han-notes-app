import {
  Folder,
  Book,
  Briefcase,
  GraduationCap,
  Code2,
  Rocket,
  Heart,
  Sparkles,
  Archive,
  Layers,
  Compass,
  Coffee,
  type LucideIcon,
} from 'lucide-react';

export const WORKSPACE_ICONS: Record<string, LucideIcon> = {
  Folder,
  Book,
  Briefcase,
  GraduationCap,
  Code2,
  Rocket,
  Heart,
  Sparkles,
  Archive,
  Layers,
  Compass,
  Coffee,
};

export const WORKSPACE_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#64748b', // Slate
];

export function getWorkspaceIcon(iconName?: string): LucideIcon {
  if (iconName && WORKSPACE_ICONS[iconName]) {
    return WORKSPACE_ICONS[iconName];
  }
  return Folder;
}
