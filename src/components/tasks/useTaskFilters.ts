import { useMemo, useState, useCallback } from 'react';
import type { TaskInfo, TaskRegistry } from '@/services/storage';

export type TaskStatusType = 'overdue' | 'in_progress' | 'completed';

// For backwards compatibility
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

export const getTaskTags = (task: TaskInfo): string[] => {
  const rawList = task.tags || [];
  const cleanSet = new Set<string>();
  rawList.forEach(item => {
    const clean = item.trim().replace(/^#/, '');
    if (clean) cleanSet.add(clean);
  });
  return Array.from(cleanSet);
};

export function useTaskFilters(tasks: TaskInfo[], registry: TaskRegistry) {
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatusType[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Extract unique assignees using useMemo
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

  // Extract unique tags using useMemo
  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    (registry.tags || []).forEach(t => {
      const clean = t.trim().replace(/^#/, '');
      if (clean) tagsSet.add(clean);
    });

    tasks.forEach(t => {
      (t.tags || []).forEach(item => {
        const clean = item.trim().replace(/^#/, '');
        if (clean) tagsSet.add(clean);
      });
    });

    return Array.from(tagsSet).sort();
  }, [tasks, registry.tags]);

  // Counts per assignee
  const assigneeCounts = useMemo(() => {
    const counts: Record<string, number> = { unassigned: 0 };
    tasks.forEach(task => {
      const assigns = getTaskAssignees(task);
      if (assigns.length === 0) {
        counts.unassigned = (counts.unassigned || 0) + 1;
      } else {
        assigns.forEach(a => {
          counts[a] = (counts[a] || 0) + 1;
        });
      }
    });
    return counts;
  }, [tasks]);

  // Counts per tag
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(task => {
      const tags = getTaskTags(task);
      tags.forEach(tg => {
        counts[tg] = (counts[tg] || 0) + 1;
      });
    });
    return counts;
  }, [tasks]);

  // Status counts
  const statusCounts = useMemo(() => {
    let overdue = 0;
    let in_progress = 0;
    let completed = 0;

    tasks.forEach(task => {
      if (isTaskOverdue(task, todayStr)) overdue++;
      if (!task.completed && (task.progress ?? 0) < 100) in_progress++;
      if (task.completed || (task.progress ?? 0) === 100) completed++;
    });

    return { overdue, in_progress, completed, total: tasks.length };
  }, [tasks, todayStr]);

  // Toggle helper functions
  const toggleStatus = useCallback((status: TaskStatusType) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  }, []);

  const toggleAssignee = useCallback((assignee: string) => {
    setSelectedAssignees(prev =>
      prev.includes(assignee) ? prev.filter(a => a !== assignee) : [...prev, assignee]
    );
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedStatuses([]);
    setSelectedAssignees([]);
    setSelectedTags([]);
  }, []);

  const hasActiveFilters = selectedStatuses.length > 0 || selectedAssignees.length > 0 || selectedTags.length > 0;

  // Filter tasks based on multi-select active filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Status Filter (OR within selected statuses)
      let matchesStatus = true;
      if (selectedStatuses.length > 0) {
        matchesStatus = selectedStatuses.some(status => {
          if (status === 'overdue') return isTaskOverdue(task, todayStr);
          if (status === 'in_progress') return !task.completed && (task.progress ?? 0) < 100;
          if (status === 'completed') return task.completed || (task.progress ?? 0) === 100;
          return false;
        });
      }

      // 2. Assignee Filter (OR within selected assignees)
      let matchesAssignee = true;
      if (selectedAssignees.length > 0) {
        const taskAssignees = getTaskAssignees(task);
        const matchesUnassigned = (selectedAssignees.includes('unassigned') || selectedAssignees.includes('Atanmamış')) && taskAssignees.length === 0;
        const matchesSpecific = taskAssignees.some(a => selectedAssignees.includes(a));
        matchesAssignee = matchesUnassigned || matchesSpecific;
      }

      // 3. Tag Filter (OR within selected tags)
      let matchesTag = true;
      if (selectedTags.length > 0) {
        const taskTags = getTaskTags(task);
        matchesTag = taskTags.some(t => selectedTags.includes(t));
      }

      return matchesStatus && matchesAssignee && matchesTag;
    });
  }, [tasks, selectedStatuses, selectedAssignees, selectedTags, todayStr]);

  // Backward compatibility adapters for single-choice legacy callers
  const activeStatusFilter: TaskStatusFilter = selectedStatuses.length === 0 ? 'all' : (selectedStatuses[0] as TaskStatusFilter);
  const setActiveStatusFilter = (filter: TaskStatusFilter) => {
    if (filter === 'all') {
      setSelectedStatuses([]);
    } else if (filter === 'overdue' || filter === 'in_progress' || filter === 'completed') {
      setSelectedStatuses([filter]);
    }
  };

  const activeAssigneeFilter = selectedAssignees.length === 0 ? 'all' : selectedAssignees[0];
  const setActiveAssigneeFilter = (filter: string) => {
    if (filter === 'all') {
      setSelectedAssignees([]);
    } else {
      setSelectedAssignees([filter]);
    }
  };

  return {
    selectedStatuses,
    setSelectedStatuses,
    toggleStatus,
    selectedAssignees,
    setSelectedAssignees,
    toggleAssignee,
    selectedTags,
    setSelectedTags,
    toggleTag,
    clearAllFilters,
    hasActiveFilters,
    availableAssignees,
    availableTags,
    assigneeCounts,
    tagCounts,
    statusCounts,
    filteredTasks,
    todayStr,
    // Backwards compatibility properties
    activeStatusFilter,
    setActiveStatusFilter,
    activeAssigneeFilter,
    setActiveAssigneeFilter,
  };
}
