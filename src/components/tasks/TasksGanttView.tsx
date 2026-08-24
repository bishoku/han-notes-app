import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { BarChart, Calendar, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskInfo } from '@/services/storage';
import { isTaskOverdue, getTaskAssignees } from './useTaskFilters';

interface TasksGanttViewProps {
  filteredTasks: TaskInfo[];
  todayStr: string;
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  onUpdateTask: (
    noteId: string,
    lineNumber: number,
    content: string,
    completed: boolean,
    metadata: {
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      priority?: string | null;
      assignees?: string[];
      progress?: number | null;
      tags?: string[];
    }
  ) => Promise<void>;
}

export const TasksGanttView: React.FC<TasksGanttViewProps> = ({
  filteredTasks,
  todayStr,
  rightPanelOpen,
  toggleRightPanel,
  onUpdateTask,
}) => {
  const { t, i18n } = useTranslation();
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>(ViewMode.Day);
  const [groupByAssignee, setGroupByAssignee] = useState<boolean>(false);

  const tasksWithDatesRef = useRef<TaskInfo[]>([]);
  useEffect(() => {
    tasksWithDatesRef.current = filteredTasks.filter(t => t.start_date && t.end_date);
  }, [filteredTasks]);

  // Transform filtered tasks for Gantt chart
  const ganttTasks = useMemo(() => {
    const gTasks: GanttTask[] = [];
    const colorPrimary = '#3b82f6';
    const colorCompleted = '#10b981';
    const colorOverdue = '#ef4444';

    const tasksWithDates = filteredTasks.filter(t => t.start_date && t.end_date);
    if (tasksWithDates.length === 0) return [];

    if (groupByAssignee) {
      const activeAssignees = new Set<string>();
      tasksWithDates.forEach(t => {
        const assigns = getTaskAssignees(t);
        if (assigns.length === 0) activeAssignees.add(t.assignee || 'Unassigned');
        else assigns.forEach(a => activeAssignees.add(a));
      });

      Array.from(activeAssignees).forEach(assignee => {
        const displayName = (assignee === 'Atanmamış' || assignee === 'Unassigned') ? t('taskUnassigned') : assignee;
        gTasks.push({
          id: `proj_${assignee}`,
          type: 'project',
          name: displayName,
          start: new Date(Math.min(...tasksWithDates.map(t => new Date(t.start_date!).getTime()))),
          end: new Date(Math.max(...tasksWithDates.map(t => new Date(t.end_date!).getTime()))),
          progress: 0,
          hideChildren: false
        });
      });

      tasksWithDates.forEach(task => {
        const assigns = getTaskAssignees(task);
        if (assigns.length === 0) assigns.push(task.assignee || 'Unassigned');

        assigns.forEach(assignee => {
          const progress = task.progress ?? (task.completed ? 100 : 0);
          let styles = { backgroundColor: colorPrimary, backgroundSelectedColor: colorPrimary };
          if (progress === 100) styles = { backgroundColor: colorCompleted, backgroundSelectedColor: colorCompleted };
          else if (isTaskOverdue(task, todayStr)) styles = { backgroundColor: colorOverdue, backgroundSelectedColor: colorOverdue };

          gTasks.push({
            id: `${task.note_id}_${task.line_number}_${assignee}`,
            type: 'task',
            name: task.content,
            start: new Date(task.start_date!),
            end: new Date(task.end_date!),
            progress: progress,
            project: `proj_${assignee}`,
            styles: styles
          });
        });
      });
    } else {
      tasksWithDates.forEach(task => {
        const progress = task.progress ?? (task.completed ? 100 : 0);
        let styles = { backgroundColor: colorPrimary, backgroundSelectedColor: colorPrimary };
        if (progress === 100) styles = { backgroundColor: colorCompleted, backgroundSelectedColor: colorCompleted };
        else if (isTaskOverdue(task, todayStr)) styles = { backgroundColor: colorOverdue, backgroundSelectedColor: colorOverdue };

        gTasks.push({
          id: `${task.note_id}_${task.line_number}`,
          type: 'task',
          name: task.content,
          start: new Date(task.start_date!),
          end: new Date(task.end_date!),
          progress: progress,
          styles: styles
        });
      });
    }

    if (groupByAssignee) {
      gTasks.sort((a, b) => {
        if (a.type === 'project' && b.type === 'project') return a.name.localeCompare(b.name);
        if (a.project && !b.project) {
          const bProj = b.id.replace('proj_', '');
          return a.project.replace('proj_', '') === bProj ? 1 : a.project.localeCompare(b.id);
        }
        if (!a.project && b.project) {
          const aProj = a.id.replace('proj_', '');
          return aProj === b.project.replace('proj_', '') ? -1 : a.id.localeCompare(b.project);
        }
        if (a.project && b.project) {
          if (a.project === b.project) return a.start.getTime() - b.start.getTime();
          return a.project.localeCompare(b.project);
        }
        return a.start.getTime() - b.start.getTime();
      });
    } else {
      gTasks.sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    return gTasks;
  }, [filteredTasks, groupByAssignee, todayStr, t]);

  const handleTaskChange = async (ganttTask: GanttTask) => {
    const parts = ganttTask.id.split('_');
    if (parts.length < 2) return;

    const task = tasksWithDatesRef.current.find(t => {
      if (groupByAssignee) {
        return ganttTask.id.startsWith(`${t.note_id}_${t.line_number}_`);
      }
      return `${t.note_id}_${t.line_number}` === ganttTask.id;
    });

    if (!task) return;

    const startCopy = new Date(ganttTask.start);
    startCopy.setMinutes(startCopy.getMinutes() - startCopy.getTimezoneOffset());
    const newStart = startCopy.toISOString().split('T')[0];

    const endCopy = new Date(ganttTask.end);
    endCopy.setMinutes(endCopy.getMinutes() - endCopy.getTimezoneOffset());
    const newEnd = endCopy.toISOString().split('T')[0];

    const currentProgress = task.progress ?? (task.completed ? 100 : 0);
    const newProgress = Math.round(ganttTask.progress);
    const progressChanged = newProgress !== currentProgress;
    const datesChanged = newStart !== task.start_date || newEnd !== task.end_date;

    if (datesChanged || progressChanged) {
      const isCompleted = newProgress === 100 ? true : (newProgress === 0 ? false : task.completed);
      await onUpdateTask(
        task.note_id,
        task.line_number,
        task.content,
        isCompleted,
        {
          description: task.description,
          startDate: newStart,
          endDate: newEnd,
          priority: task.priority,
          assignees: task.assignees,
          progress: newProgress,
          tags: task.tags,
        }
      );
    }
  };

  const TaskListHeader = ({ headerHeight, fontSize }: any) => {
    return (
      <div 
        className="flex border-b border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/90 backdrop-blur-xs select-none" 
        style={{ height: headerHeight, fontSize }}
      >
        <div className="flex-1 flex items-center px-3 font-semibold text-gray-500 dark:text-gray-400 truncate">{t('taskGanttHeaderTask')}</div>
        <div className="w-[75px] flex items-center font-semibold text-gray-500 dark:text-gray-400 pl-1">{t('taskGanttStart')}</div>
        <div className="w-[75px] flex items-center font-semibold text-gray-500 dark:text-gray-400 pl-1">{t('taskGanttEnd')}</div>
      </div>
    );
  };

  const TaskListTable = ({ rowHeight, tasks, fontSize, onExpanderClick }: any) => {
    const formatDate = (date: Date) => {
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    };

    return (
      <div className="flex flex-col bg-white dark:bg-zinc-900 select-none" style={{ fontSize }}>
        {tasks.map((t: GanttTask) => (
          <div 
            key={t.id} 
            className="flex border-b border-gray-100 dark:border-zinc-800/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors" 
            style={{ height: rowHeight }}
          >
            <div className="flex-1 flex items-center px-3 truncate min-w-0" title={t.name}>
              {t.type === 'project' && (
                <button 
                  className="mr-1.5 text-gray-400 hover:text-mac-accent shrink-0 text-xs flex items-center justify-center w-4 h-4 transition-colors" 
                  onClick={() => onExpanderClick(t)}
                >
                  {t.hideChildren ? '▶' : '▼'}
                </button>
              )}
              <span className={cn(
                "truncate font-medium text-gray-800 dark:text-gray-200", 
                t.type === 'project' && "font-bold text-mac-accent dark:text-blue-400"
              )}>
                {t.name}
              </span>
            </div>
            <div className="w-[75px] flex items-center text-[10px] text-gray-500 dark:text-gray-400 shrink-0 font-mono pl-1">
              {formatDate(t.start)}
            </div>
            <div className="w-[75px] flex items-center text-[10px] text-gray-500 dark:text-gray-400 shrink-0 font-mono pl-1">
              {formatDate(t.end)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className="flex-1 flex flex-col bg-mac-mainLight dark:bg-mac-mainDark transition-all duration-200 overflow-hidden select-none border-r border-gray-200 dark:border-zinc-800">
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <BarChart size={24} className="text-mac-accent" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t('taskChart')}
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => setGroupByAssignee(false)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                !groupByAssignee ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              {t('taskBased')}
            </button>
            <button
              onClick={() => setGroupByAssignee(true)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                groupByAssignee ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              {t('taskFilterAssignee')}
            </button>
          </div>

          <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => setGanttViewMode(ViewMode.Day)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                ganttViewMode === ViewMode.Day ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              {t('taskDay')}
            </button>
            <button
              onClick={() => setGanttViewMode(ViewMode.Week)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                ganttViewMode === ViewMode.Week ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              {t('taskWeek')}
            </button>
            <button
              onClick={() => setGanttViewMode(ViewMode.Month)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                ganttViewMode === ViewMode.Month ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              {t('taskMonth')}
            </button>
          </div>

          <button 
            onClick={toggleRightPanel} 
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors border border-gray-200 dark:border-zinc-700"
            title={rightPanelOpen ? t('closeRightPanel') : t('openRightPanel')}
          >
            {rightPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-zinc-950 p-6 flex flex-col min-h-0 relative">
        <div className="flex-1 w-full relative">
          <div className="absolute inset-0">
            {ganttTasks.length > 0 ? (
              <Gantt
                tasks={ganttTasks}
                viewMode={ganttViewMode}
                onDateChange={handleTaskChange}
                onProgressChange={handleTaskChange}
                listCellWidth="260px"
                columnWidth={ganttViewMode === ViewMode.Month ? 80 : ganttViewMode === ViewMode.Week ? 200 : 50}
                rowHeight={36}
                headerHeight={38}
                fontSize="11px"
                barCornerRadius={4}
                barFill={65}
                handleWidth={6}
                arrowColor="#a1a1aa"
                arrowIndent={15}
                todayColor="rgba(0, 122, 255, 0.1)"
                locale={i18n.language === 'tr' ? 'tr' : 'en'}
                TooltipContent={() => null}
                TaskListHeader={TaskListHeader}
                TaskListTable={TaskListTable}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Calendar size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
                <p className="font-medium">{t('taskNoDatedTasks')}</p>
                <p className="text-sm mt-2 opacity-70">{t('taskNoDatedTasksDesc')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

