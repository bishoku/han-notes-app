import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { List, CheckCircle2, Circle, FileText, User, Calendar, Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskInfo } from '@/services/storage';
import type { TaskEditData } from '@/components/TaskEditModal';
import type { TaskStatusType, TaskStatusFilter } from './useTaskFilters';
import { isTaskOverdue, getTaskAssignees, getTaskTags } from './useTaskFilters';
import { FilterMultiSelect, type FilterOption } from './FilterMultiSelect';

export interface TasksSidebarListProps {
  filteredTasks: TaskInfo[];
  selectedStatuses?: TaskStatusType[];
  toggleStatus?: (status: TaskStatusType) => void;
  setSelectedStatuses?: (statuses: TaskStatusType[]) => void;
  selectedAssignees?: string[];
  setSelectedAssignees?: (assignees: string[]) => void;
  availableAssignees: string[];
  assigneeCounts?: Record<string, number>;
  selectedTags?: string[];
  setSelectedTags?: (tags: string[]) => void;
  availableTags?: string[];
  tagCounts?: Record<string, number>;
  clearAllFilters?: () => void;
  hasActiveFilters?: boolean;
  todayStr: string;
  onToggleTask: (noteId: string, lineNumber: number, completed: boolean) => void;
  onSelectNote: (noteId: string) => void;
  onEditTask: (task: TaskEditData) => void;

  // Backwards compatibility legacy props
  activeStatusFilter?: TaskStatusFilter;
  setActiveStatusFilter?: (filter: TaskStatusFilter) => void;
  activeAssigneeFilter?: string;
  setActiveAssigneeFilter?: (filter: string) => void;
}

export const TasksSidebarList: React.FC<TasksSidebarListProps> = ({
  filteredTasks,
  selectedStatuses = [],
  toggleStatus,
  setSelectedStatuses,
  selectedAssignees = [],
  setSelectedAssignees,
  availableAssignees,
  assigneeCounts = {},
  selectedTags = [],
  setSelectedTags,
  availableTags = [],
  tagCounts = {},
  clearAllFilters,
  hasActiveFilters = false,
  todayStr,
  onToggleTask,
  onSelectNote,
  onEditTask,
  // Legacy
  activeStatusFilter,
  setActiveStatusFilter,
  activeAssigneeFilter: _activeAssigneeFilter,
  setActiveAssigneeFilter,
}) => {
  const { t } = useTranslation();

  // Status toggle handler supporting both multi-select and legacy
  const handleStatusToggle = (status: TaskStatusType) => {
    if (toggleStatus) {
      toggleStatus(status);
    } else if (setActiveStatusFilter) {
      setActiveStatusFilter(activeStatusFilter === status ? 'all' : status);
    }
  };

  const handleStatusAll = () => {
    if (setSelectedStatuses) {
      setSelectedStatuses([]);
    } else if (setActiveStatusFilter) {
      setActiveStatusFilter('all');
    }
  };

  const isStatusActive = (status: TaskStatusType) => {
    if (selectedStatuses.length > 0) {
      return selectedStatuses.includes(status);
    }
    return activeStatusFilter === status;
  };

  const isAllStatusActive = selectedStatuses.length === 0 && (activeStatusFilter === 'all' || !activeStatusFilter);

  // Assignees options for multi-select
  const assigneeOptions: FilterOption[] = useMemo(() => {
    const list: FilterOption[] = [];
    // Add "Unassigned" option if available
    const unassignedCount = assigneeCounts.unassigned ?? 0;
    list.push({
      id: 'unassigned',
      label: t('taskUnassigned', 'Atanmamış'),
      count: unassignedCount,
    });

    availableAssignees.forEach(person => {
      list.push({
        id: person,
        label: person,
        count: assigneeCounts[person] ?? 0,
      });
    });
    return list;
  }, [availableAssignees, assigneeCounts, t]);

  // Tags options for multi-select
  const tagOptions: FilterOption[] = useMemo(() => {
    return availableTags.map(tag => ({
      id: tag,
      label: `#${tag}`,
      count: tagCounts[tag] ?? 0,
    }));
  }, [availableTags, tagCounts]);

  const handleAssigneeChange = (newAssignees: string[]) => {
    if (setSelectedAssignees) {
      setSelectedAssignees(newAssignees);
    } else if (setActiveAssigneeFilter) {
      setActiveAssigneeFilter(newAssignees.length === 0 ? 'all' : newAssignees[0]);
    }
  };

  const getPriorityBadge = (p?: string | null) => {
    if (!p) return null;
    switch (p.toLowerCase()) {
      case 'urgent':
      case 'acil':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white">{t('priorityUrgent')}</span>;
      case 'high':
      case 'yüksek':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-500 text-white">{t('priorityHigh')}</span>;
      case 'medium':
      case 'orta':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">{t('priorityMedium')}</span>;
      case 'low':
      case 'düşük':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">{t('priorityLow')}</span>;
      default:
        return null;
    }
  };

  return (
    <aside className="w-full md:w-[32%] md:min-w-[320px] md:max-w-[420px] h-full bg-mac-sidebarLight dark:bg-mac-sidebarDark flex flex-col border-l-0 md:border-l border-gray-200 dark:border-zinc-800 overflow-x-hidden relative">
      {/* Filters Area */}
      <div className="p-3.5 border-b border-gray-200 dark:border-zinc-800 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <List size={16} /> {t('taskList')} ({filteredTasks.length})
          </h2>
          {hasActiveFilters && clearAllFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-[11px] font-medium text-mac-accent hover:underline cursor-pointer"
            >
              <X size={11} /> {t('clearFilters', 'Temizle')}
            </button>
          )}
        </div>
        
        {/* 1. Status Filter (Multi-select toggles) */}
        <div className="flex flex-col gap-1">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {t('taskFilterStatus')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={handleStatusAll}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                isAllStatusActive
                  ? "bg-mac-accent text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
              )}
            >
              {t('taskAll')}
            </button>
            <button
              type="button"
              onClick={() => handleStatusToggle('overdue')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer",
                isStatusActive('overdue')
                  ? "bg-red-500 text-white shadow-sm ring-2 ring-red-500/20"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20"
              )}
            >
              {t('overdueTasks')}
            </button>
            <button
              type="button"
              onClick={() => handleStatusToggle('in_progress')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                isStatusActive('in_progress')
                  ? "bg-mac-accent text-white shadow-sm ring-2 ring-mac-accent/20"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
              )}
            >
              {t('taskInProgress')}
            </button>
            <button
              type="button"
              onClick={() => handleStatusToggle('completed')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                isStatusActive('completed')
                  ? "bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
              )}
            >
              {t('taskCompleted')}
            </button>
          </div>
        </div>

        {/* 2. Assignee & 3. Tag Filters (Multi-Select Comboboxes) */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {/* Assignee Filter */}
          <FilterMultiSelect
            label={t('taskFilterAssignee')}
            icon={<User size={13} />}
            selectedValues={selectedAssignees}
            onChange={handleAssigneeChange}
            options={assigneeOptions}
            placeholder={t('taskAll', 'Hepsi')}
            searchPlaceholder={t('searchAssignees', 'Sorumlu ara...')}
            badgeStyle="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
            className="flex-1 min-w-[135px]"
          />

          {/* Tag Filter */}
          <FilterMultiSelect
            label={t('taskFilterTag')}
            icon={<Tag size={13} />}
            selectedValues={selectedTags}
            onChange={setSelectedTags || (() => {})}
            options={tagOptions}
            placeholder={t('taskAll', 'Hepsi')}
            searchPlaceholder={t('searchTags', 'Etiket ara...')}
            badgeStyle="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
            className="flex-1 min-w-[135px]"
            align="right"
          />
        </div>
      </div>

      {/* Compact List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {filteredTasks.length === 0 ? (
          <div className="text-xs text-gray-400 italic p-6 text-center">
            {t('noResultsFound')}
          </div>
        ) : (
          filteredTasks.map((task, idx) => {
            const overdue = isTaskOverdue(task, todayStr);
            const assigneesList = getTaskAssignees(task);
            const taskTags = getTaskTags(task);

            return (
              <div 
                key={`${task.note_id}-${task.line_number}-${idx}`} 
                onClick={() => onEditTask({
                  noteId: task.note_id,
                  lineNumber: task.line_number,
                  content: task.content,
                  completed: task.completed,
                  description: task.description,
                  startDate: task.start_date,
                  endDate: task.end_date,
                  priority: task.priority,
                  assignee: task.assignee,
                  assignees: task.assignees,
                  progress: task.progress,
                  tags: task.tags,
                  relatedNotes: task.related_notes,
                })}
                className={cn(
                  "flex flex-col gap-1.5 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border transition-all shadow-2xs hover:shadow-sm cursor-pointer hover:border-mac-accent/50",
                  overdue ? "border-red-500/50 bg-red-500/5 dark:bg-red-950/10" : "border-gray-100 dark:border-zinc-800"
                )}
              >
                <div className="flex items-start gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(task.note_id, task.line_number, !task.completed);
                    }}
                    className="mt-0.5 text-gray-400 hover:text-mac-accent transition-colors shrink-0 cursor-pointer"
                  >
                    {task.completed || (task.progress ?? 0) === 100 ? (
                      <CheckCircle2 className="text-emerald-500" size={15} />
                    ) : (
                      <Circle size={15} />
                    )}
                  </button>
                  
                  <span className={cn(
                    "text-xs font-medium leading-tight line-clamp-2",
                    (task.completed || (task.progress ?? 0) === 100) ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"
                  )}>
                    {task.content}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 ml-5 mt-0.5">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNote(task.note_id);
                    }}
                    className="flex items-center gap-0.5 text-[9px] font-medium text-gray-500 hover:text-mac-accent bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded transition-colors"
                  >
                    <FileText size={9} /> {task.note_id}
                  </button>

                  {getPriorityBadge(task.priority)}
                  
                  {assigneesList.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      <User size={9} /> {assigneesList[0]} {assigneesList.length > 1 && `+${assigneesList.length - 1}`}
                    </span>
                  )}
                  
                  {(task.start_date || task.end_date) && (
                    <span className="flex items-center gap-0.5 text-[9px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">
                      <Calendar size={9} /> {task.end_date ? task.end_date : task.start_date}
                    </span>
                  )}

                  {task.progress !== undefined && task.progress !== null && task.progress > 0 && task.progress < 100 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-mac-accent bg-mac-accent/10 px-1.5 py-0.5 rounded font-mono font-bold">
                      {task.progress}%
                    </span>
                  )}

                  {taskTags.map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-0.5 text-[9px] font-mono text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded"
                    >
                      <Tag size={8} /> #{tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
