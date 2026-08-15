import { useMemo, useState } from 'react';
import type { TaskInfo, TaskRegistry } from '@/services/storage';

export type TaskStatusFilter = 'all' | 'overdue' | 'high' | 'in_progress' | 'completed';

export const isTaskOverdue = (task: TaskInfo, todayStr: string): boolean => {
  if (task.completed || (task.progress !== undefined && task.progress !== null && task.progress >= 100)) {
    return false;
  }
  if (!task.end_date) return false;
  return task.end_date < todayStr;
};

export const getTaskAssignees = (task: TaskInfo): string[] => {
  const rawList = task.assignees && task.assignees.length > 0
    ? task.assignees
    : (task.assignee ? [task.assignee] : []);

  const cleanSet = new Set<string>();
  rawList.forEach(item => {
    item.split(',').forEach(part => {
      const clean = part.trim();
      if (clean) cleanSet.add(clean);
    });
  });
  return Array.from(cleanSet);
};

export function useTaskFilters(tasks: TaskInfo[], registry: TaskRegistry) {
  const [activeStatusFilter, setActiveStatusFilter] = useState<TaskStatusFilter>('all');
  const [activeAssigneeFilter, setActiveAssigneeFilter] = useState<string>('all');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Extract unique assignees using useMemo to avoid recomputing on every render
  const availableAssignees = useMemo(() => {
    const assigneesSet = new Set<string>();
    (registry.assignees || []).forEach(a => {
      a.split(',').forEach(part => {
        const clean = part.trim();
        if (clean) assigneesSet.add(clean);
      });
    });

    tasks.forEach(t => {
      const rawList = t.assignees && t.assignees.length > 0 ? t.assignees : (t.assignee ? [t.assignee] : []);
      rawList.forEach(item => {
        item.split(',').forEach(part => {
          const clean = part.trim();
          if (clean) assigneesSet.add(clean);
        });
      });
    });

    return Array.from(assigneesSet).sort();
  }, [tasks, registry.assignees]);

  // Filter tasks based on active filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      let matchesStatus = true;
      if (activeStatusFilter === 'overdue') matchesStatus = isTaskOverdue(task, todayStr);
      else if (activeStatusFilter === 'high') matchesStatus = task.priority === 'high' || task.priority === 'urgent';
      else if (activeStatusFilter === 'in_progress') matchesStatus = !task.completed && (task.progress ?? 0) < 100;
      else if (activeStatusFilter === 'completed') matchesStatus = task.completed || (task.progress ?? 0) === 100;

      let matchesAssignee = true;
      const taskAssignees = getTaskAssignees(task);

      if (activeAssigneeFilter === 'unassigned') {
        matchesAssignee = taskAssignees.length === 0;
      } else if (activeAssigneeFilter !== 'all') {
        matchesAssignee = taskAssignees.includes(activeAssigneeFilter);
      }

      return matchesStatus && matchesAssignee;
    });
  }, [tasks, activeStatusFilter, activeAssigneeFilter, todayStr]);

  return {
    activeStatusFilter,
    setActiveStatusFilter,
    activeAssigneeFilter,
    setActiveAssigneeFilter,
    availableAssignees,
    filteredTasks,
    todayStr,
  };
}
