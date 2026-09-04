import React from 'react';
import { useTranslation } from 'react-i18next';
import { List, CheckCircle2, Circle, FileText, User, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskInfo } from '@/services/storage';
import type { TaskEditData } from '@/components/TaskEditModal';
import type { TaskStatusFilter } from './useTaskFilters';
import { isTaskOverdue, getTaskAssignees } from './useTaskFilters';

interface TasksSidebarListProps {
  filteredTasks: TaskInfo[];
  availableAssignees: string[];
  activeStatusFilter: TaskStatusFilter;
  setActiveStatusFilter: (filter: TaskStatusFilter) => void;
  activeAssigneeFilter: string;
  setActiveAssigneeFilter: (filter: string) => void;
  todayStr: string;
  onToggleTask: (noteId: string, lineNumber: number, completed: boolean) => void;
  onSelectNote: (noteId: string) => void;
  onEditTask: (task: TaskEditData) => void;
}

export const TasksSidebarList: React.FC<TasksSidebarListProps> = ({
  filteredTasks,
  availableAssignees,
  activeStatusFilter,
  setActiveStatusFilter,
  activeAssigneeFilter,
  setActiveAssigneeFilter,
  todayStr,
  onToggleTask,
  onSelectNote,
  onEditTask,
}) => {
  const { t } = useTranslation();

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
    <aside className="w-full md:w-[30%] md:min-w-[320px] md:max-w-[400px] h-full bg-mac-sidebarLight dark:bg-mac-sidebarDark flex flex-col border-l-0 md:border-l border-gray-200 dark:border-zinc-800">
      {/* Filters Area */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex flex-col gap-3 shrink-0">
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <List size={16} /> {t('taskList')}
        </h2>
        
        <div className="flex flex-wrap gap-1.5">
          <div className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t('taskFilterStatus')}</div>
          <button
            onClick={() => setActiveStatusFilter('all')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
              activeStatusFilter === 'all' ? "bg-mac-accent text-white shadow-sm" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
            )}
          >
            {t('taskAll')}
          </button>
          <button
            onClick={() => setActiveStatusFilter('overdue')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1",
              activeStatusFilter === 'overdue' ? "bg-red-500 text-white shadow-sm" : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
            )}
          >
            {t('overdueTasks')}
          </button>
          <button
            onClick={() => setActiveStatusFilter('in_progress')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
              activeStatusFilter === 'in_progress' ? "bg-mac-accent text-white shadow-sm" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400"
            )}
          >
            {t('taskInProgress')}
          </button>
          <button
            onClick={() => setActiveStatusFilter('completed')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
              activeStatusFilter === 'completed' ? "bg-emerald-500 text-white shadow-sm" : "bg-emerald-500/10 text-emerald-500"
            )}
          >
            {t('taskCompleted')}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <div className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 mt-1">{t('taskFilterAssignee')}</div>
          <button
            onClick={() => setActiveAssigneeFilter('all')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
              activeAssigneeFilter === 'all' ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
            )}
          >
            {t('all')}
          </button>
          {availableAssignees.map(person => (
            <button
              key={person}
              onClick={() => setActiveAssigneeFilter(person)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
                activeAssigneeFilter === person 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
              )}
            >
              {person === 'Atanmamış' ? t('taskUnassigned') : person}
            </button>
          ))}
        </div>
      </div>

      {/* Compact List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {filteredTasks.length === 0 ? (
          <div className="text-xs text-gray-400 italic p-4 text-center">{t('noResultsFound')}</div>
        ) : (
          filteredTasks.map((task, idx) => {
            const overdue = isTaskOverdue(task, todayStr);
            const assigneesList = getTaskAssignees(task);

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
                    className="mt-0.5 text-gray-400 hover:text-mac-accent transition-colors shrink-0"
                  >
                    {task.completed || (task.progress ?? 0) === 100 ? (
                      <CheckCircle2 className="text-emerald-500" size={14} />
                    ) : (
                      <Circle size={14} />
                    )}
                  </button>
                  
                  <span className={cn(
                    "text-xs font-medium leading-tight line-clamp-2",
                    (task.completed || (task.progress ?? 0) === 100) ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"
                  )}>
                    {task.content}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 ml-5 mt-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNote(task.note_id);
                    }}
                    className="flex items-center gap-0.5 text-[9px] font-medium text-gray-500 hover:text-mac-accent bg-gray-100 dark:bg-zinc-800 px-1 rounded transition-colors"
                  >
                    <FileText size={9} /> {task.note_id}
                  </button>

                  {getPriorityBadge(task.priority)}
                  
                  {assigneesList.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1 rounded">
                      <User size={9} /> {assigneesList[0]} {assigneesList.length > 1 && `+${assigneesList.length - 1}`}
                    </span>
                  )}
                  
                  {(task.start_date || task.end_date) && (
                    <span className="flex items-center gap-0.5 text-[9px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1 rounded font-mono">
                      <Calendar size={9} /> {task.end_date ? task.end_date : task.start_date}
                    </span>
                  )}

                  {task.progress !== undefined && task.progress !== null && task.progress > 0 && task.progress < 100 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-mac-accent bg-mac-accent/10 px-1 rounded font-mono font-bold">
                      {task.progress}%
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
