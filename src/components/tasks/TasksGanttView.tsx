import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { BarChart, Calendar, PanelRightClose, PanelRightOpen, PanelLeftOpen, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/uiStore';
import type { TaskInfo } from '@/services/storage';
import type { TaskEditData } from '@/components/TaskEditModal';
import { isTaskOverdue, getTaskAssignees } from './useTaskFilters';

interface TasksGanttViewProps {
  filteredTasks: TaskInfo[];
  todayStr: string;
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  onEditTask?: (task: TaskEditData) => void;
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
      relatedNotes?: string[];
    }
  ) => Promise<void>;
}

export const TasksGanttView: React.FC<TasksGanttViewProps> = ({
  filteredTasks,
  todayStr,
  rightPanelOpen,
  toggleRightPanel,
  onEditTask,
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

    const truncateGanttName = (text: string, maxLen = 35) => {
      return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
    };

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
            name: truncateGanttName(task.content),
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
          name: truncateGanttName(task.content),
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
          relatedNotes: task.related_notes,
        }
      );
    }
  };

  const findTaskByGanttId = (ganttId: string): TaskInfo | undefined => {
    return tasksWithDatesRef.current.find(t => {
      if (groupByAssignee) {
        return ganttId.startsWith(`${t.note_id}_${t.line_number}_`);
      }
      return `${t.note_id}_${t.line_number}` === ganttId;
    });
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
        {tasks.map((gTask: GanttTask) => {
          const rawTask = gTask.type !== 'project' ? findTaskByGanttId(gTask.id) : undefined;

          return (
            <div 
              key={gTask.id} 
              className="flex border-b border-gray-100 dark:border-zinc-800/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group" 
              style={{ height: rowHeight }}
            >
              <div className="flex-1 flex items-center px-3 truncate min-w-0" title={rawTask?.content || gTask.name}>
                {gTask.type === 'project' && (
                  <button 
                    className="mr-1.5 text-gray-400 hover:text-mac-accent shrink-0 text-xs flex items-center justify-center w-4 h-4 transition-colors" 
                    onClick={() => onExpanderClick(gTask)}
                  >
                    {gTask.hideChildren ? '▶' : '▼'}
                  </button>
                )}
                {gTask.type !== 'project' && onEditTask && rawTask && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTask({
                        noteId: rawTask.note_id,
                        lineNumber: rawTask.line_number,
                        content: rawTask.content,
                        completed: rawTask.completed,
                        description: rawTask.description,
                        startDate: rawTask.start_date,
                        endDate: rawTask.end_date,
                        priority: rawTask.priority,
                        assignee: rawTask.assignee,
                        assignees: rawTask.assignees,
                        progress: rawTask.progress,
                        tags: rawTask.tags,
                      });
                    }}
                    className="mr-1.5 p-1 rounded-md text-gray-400 hover:text-mac-accent hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
                    title={t('editTaskDetails', 'Görev Detaylarını Düzenle')}
                  >
                    <Edit2 size={12} />
                  </button>
                )}
                <span className={cn(
                  "truncate font-medium text-gray-800 dark:text-gray-200", 
                  gTask.type === 'project' && "font-bold text-mac-accent dark:text-blue-400"
                )}>
                  {gTask.name}
                </span>
              </div>
              <div className="w-[75px] flex items-center text-[10px] text-gray-500 dark:text-gray-400 shrink-0 font-mono pl-1">
                {formatDate(gTask.start)}
              </div>
              <div className="w-[75px] flex items-center text-[10px] text-gray-500 dark:text-gray-400 shrink-0 font-mono pl-1">
                {formatDate(gTask.end)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const sidebarOpen = useUiStore(s => s.sidebarOpen);
  const setSidebarOpen = useUiStore(s => s.setSidebarOpen);

  return (
    <main className="flex-1 flex flex-col bg-mac-mainLight dark:bg-mac-mainDark transition-all duration-200 overflow-hidden select-none border-r border-mac-borderLight dark:border-mac-borderDark">
      <header className="shrink-0 pt-safe bg-mac-mainLight/80 dark:bg-mac-mainDark/80 backdrop-blur-xs border-b border-mac-borderLight dark:border-mac-borderDark z-30 select-none">
        <div className="h-11 min-h-[44px] flex items-center justify-between px-3 md:px-4 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="hidden md:inline-flex p-1 rounded-md text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer shrink-0 mr-0.5"
                title={t('expandSidebar')}
              >
                <PanelLeftOpen size={16} />
              </button>
            )}
            <BarChart size={16} className="text-mac-accent shrink-0" />
            <h1 className="text-xs md:text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {t('taskChart')}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-gray-100/90 dark:bg-zinc-800/90 p-0.5 rounded-lg border border-gray-200/80 dark:border-zinc-700/80 select-none">
              <button
                onClick={() => setGroupByAssignee(false)}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer",
                  !groupByAssignee ? "bg-white dark:bg-zinc-700 shadow-2xs text-gray-900 dark:text-gray-100 font-semibold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                )}
              >
                {t('taskBased')}
              </button>
              <button
                onClick={() => setGroupByAssignee(true)}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer",
                  groupByAssignee ? "bg-white dark:bg-zinc-700 shadow-2xs text-gray-900 dark:text-gray-100 font-semibold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                )}
              >
                {t('taskFilterAssignee')}
              </button>
            </div>

            <div className="flex items-center bg-gray-100/90 dark:bg-zinc-800/90 p-0.5 rounded-lg border border-gray-200/80 dark:border-zinc-700/80 select-none">
              <button
                onClick={() => setGanttViewMode(ViewMode.Day)}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer",
                  ganttViewMode === ViewMode.Day ? "bg-white dark:bg-zinc-700 shadow-2xs text-gray-900 dark:text-gray-100 font-semibold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                )}
              >
                {t('taskDay')}
              </button>
              <button
                onClick={() => setGanttViewMode(ViewMode.Week)}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer",
                  ganttViewMode === ViewMode.Week ? "bg-white dark:bg-zinc-700 shadow-2xs text-gray-900 dark:text-gray-100 font-semibold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                )}
              >
                {t('taskWeek')}
              </button>
              <button
                onClick={() => setGanttViewMode(ViewMode.Month)}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer",
                  ganttViewMode === ViewMode.Month ? "bg-white dark:bg-zinc-700 shadow-2xs text-gray-900 dark:text-gray-100 font-semibold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                )}
              >
                {t('taskMonth')}
              </button>
            </div>

            <button 
              onClick={toggleRightPanel} 
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
              title={rightPanelOpen ? t('closeRightPanel') : t('openRightPanel')}
            >
              {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </div>
        </div>
      </header>

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

