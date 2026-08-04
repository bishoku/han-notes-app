import React, { useEffect, useState, useMemo } from 'react';
import { useTaskStore } from '@/store/taskStore';
import type { TaskInfo } from '@/store/taskStore';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import { TaskEditModal } from '@/components/TaskEditModal';
import type { TaskEditData } from '@/components/TaskEditModal';
import { 
  CheckCircle2, 
  Circle, 
  FileText,
  Calendar, 
  User, 
  BarChart,
  List,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';

export const TasksView: React.FC = () => {
  const { tasks, registry, loadTasks, toggleTask, updateTaskMetadata } = useTaskStore();
  const { selectNote } = useNoteStore();
  const { setViewMode, rightPanelOpen, toggleRightPanel } = useUiStore();

  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'overdue' | 'high' | 'in_progress' | 'completed'>('all');
  const [activeAssigneeFilter, setActiveAssigneeFilter] = useState<string>('all');
  const [editingTask, setEditingTask] = useState<TaskEditData | null>(null);
  
  // Gantt specific state
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>(ViewMode.Day);
  const [groupByAssignee, setGroupByAssignee] = useState<boolean>(false);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const todayStr = new Date().toISOString().split('T')[0];

  const isOverdue = (task: TaskInfo) => {
    if (task.completed || (task.progress !== undefined && task.progress !== null && task.progress >= 100)) {
      return false;
    }
    if (!task.end_date) return false;
    return task.end_date < todayStr;
  };

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

  const availableAssignees = Array.from(assigneesSet).sort();

  const getTaskAssignees = (task: TaskInfo): string[] => {
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

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      let matchesStatus = true;
      if (activeStatusFilter === 'overdue') matchesStatus = isOverdue(task);
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
  }, [tasks, activeStatusFilter, activeAssigneeFilter]);

  // Transform filtered tasks for Gantt chart
  const ganttTasks = useMemo(() => {
    const gTasks: GanttTask[] = [];
    const colorPrimary = '#3b82f6'; // blue-500
    const colorCompleted = '#10b981'; // emerald-500
    const colorOverdue = '#ef4444'; // red-500

    const tasksWithDates = filteredTasks.filter(t => t.start_date && t.end_date);

    if (tasksWithDates.length === 0) return [];

    if (groupByAssignee) {
      // Find assignees that have at least one task with dates
      const activeAssignees = new Set<string>();
      tasksWithDates.forEach(t => {
        const assigns = getTaskAssignees(t);
        if (assigns.length === 0) activeAssignees.add('Atanmamış');
        else assigns.forEach(a => activeAssignees.add(a));
      });

      Array.from(activeAssignees).forEach(assignee => {
        // Create project task
        gTasks.push({
          id: `proj_${assignee}`,
          type: 'project',
          name: assignee,
          start: new Date(Math.min(...tasksWithDates.map(t => new Date(t.start_date!).getTime()))),
          end: new Date(Math.max(...tasksWithDates.map(t => new Date(t.end_date!).getTime()))),
          progress: 0,
          hideChildren: false
        });
      });

      tasksWithDates.forEach(task => {
        const assigns = getTaskAssignees(task);
        if (assigns.length === 0) assigns.push('Atanmamış');

        assigns.forEach(assignee => {
          let progress = task.progress ?? (task.completed ? 100 : 0);
          let styles = { backgroundColor: colorPrimary, backgroundSelectedColor: colorPrimary };
          if (progress === 100) styles = { backgroundColor: colorCompleted, backgroundSelectedColor: colorCompleted };
          else if (isOverdue(task)) styles = { backgroundColor: colorOverdue, backgroundSelectedColor: colorOverdue };

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
        let progress = task.progress ?? (task.completed ? 100 : 0);
        let styles = { backgroundColor: colorPrimary, backgroundSelectedColor: colorPrimary };
        if (progress === 100) styles = { backgroundColor: colorCompleted, backgroundSelectedColor: colorCompleted };
        else if (isOverdue(task)) styles = { backgroundColor: colorOverdue, backgroundSelectedColor: colorOverdue };

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
    
    // Sort logic to make project parents appear right above their children
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
  }, [filteredTasks, groupByAssignee]);

  const handleSaveModal = async (updated: TaskEditData) => {
    await updateTaskMetadata(
      updated.noteId,
      updated.lineNumber,
      updated.content,
      updated.completed,
      {
        description: updated.description,
        startDate: updated.startDate,
        endDate: updated.endDate,
        priority: updated.priority,
        assignees: updated.assignees,
        progress: updated.progress,
        tags: updated.tags,
      }
    );
  };

  const getPriorityBadge = (p?: string | null) => {
    if (!p) return null;
    switch (p.toLowerCase()) {
      case 'urgent':
      case 'acil':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white">Acil</span>;
      case 'high':
      case 'yüksek':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-500 text-white">Yük</span>;
      case 'medium':
      case 'orta':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">Ort</span>;
      case 'low':
      case 'düşük':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">Düş</span>;
      default:
        return null;
    }
  };

  // Handle Drag & Drop on Gantt
  const handleTaskChange = async (ganttTask: GanttTask) => {
    // ID is either `${note_id}_${line_number}` or `${note_id}_${line_number}_${assignee}`
    const parts = ganttTask.id.split('_');
    if (parts.length < 2) return;
    
    const task = tasksWithDatesRef.current.find(t => {
      if (groupByAssignee) {
        return ganttTask.id.startsWith(`${t.note_id}_${t.line_number}_`);
      }
      return `${t.note_id}_${t.line_number}` === ganttTask.id;
    });

    if (!task) return;

    // Convert Date back to string YYYY-MM-DD (adding local time offset fix)
    const startCopy = new Date(ganttTask.start);
    startCopy.setMinutes(startCopy.getMinutes() - startCopy.getTimezoneOffset());
    const newStart = startCopy.toISOString().split('T')[0];

    const endCopy = new Date(ganttTask.end);
    endCopy.setMinutes(endCopy.getMinutes() - endCopy.getTimezoneOffset());
    const newEnd = endCopy.toISOString().split('T')[0];

    if (newStart !== task.start_date || newEnd !== task.end_date) {
      await updateTaskMetadata(
        task.note_id,
        task.line_number,
        task.content,
        task.completed,
        {
          description: task.description,
          startDate: newStart,
          endDate: newEnd,
          priority: task.priority,
          assignees: task.assignees,
          progress: task.progress,
          tags: task.tags,
        }
      );
    }
  };

  // We need a ref to access the original tasks for updating
  const tasksWithDatesRef = React.useRef<TaskInfo[]>([]);
  useEffect(() => {
    tasksWithDatesRef.current = filteredTasks.filter(t => t.start_date && t.end_date);
  }, [filteredTasks]);

  // Custom Task List Header & Table for Compact Date formatting
  const TaskListHeader = ({ headerHeight, fontSize }: any) => {
    return (
      <div 
        className="flex border-b border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/90 backdrop-blur-xs select-none" 
        style={{ height: headerHeight, fontSize }}
      >
        <div className="flex-1 flex items-center px-3 font-semibold text-gray-500 dark:text-gray-400 truncate">Görev</div>
        <div className="w-[75px] flex items-center font-semibold text-gray-500 dark:text-gray-400 pl-1">Baş.</div>
        <div className="w-[75px] flex items-center font-semibold text-gray-500 dark:text-gray-400 pl-1">Bit.</div>
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
    <div className="flex w-full h-full">
      {/* Center Panel (Gantt Chart) */}
      <main className="flex-1 flex flex-col bg-mac-mainLight dark:bg-mac-mainDark transition-all duration-200 overflow-hidden select-none border-r border-gray-200 dark:border-zinc-800">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <BarChart size={24} className="text-mac-accent" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Görev Çizelgesi
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Group By Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
              <button
                onClick={() => setGroupByAssignee(false)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  !groupByAssignee ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Görev Bazlı
              </button>
              <button
                onClick={() => setGroupByAssignee(true)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  groupByAssignee ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Atanan Bazlı
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
              <button
                onClick={() => setGanttViewMode(ViewMode.Day)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  ganttViewMode === ViewMode.Day ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Gün
              </button>
              <button
                onClick={() => setGanttViewMode(ViewMode.Week)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  ganttViewMode === ViewMode.Week ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Hafta
              </button>
              <button
                onClick={() => setGanttViewMode(ViewMode.Month)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  ganttViewMode === ViewMode.Month ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Ay
              </button>
            </div>

            {/* Toggle Right Panel Button */}
            <button 
              onClick={toggleRightPanel} 
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors border border-gray-200 dark:border-zinc-700"
              title={rightPanelOpen ? "Sağ Paneli Kapat" : "Sağ Paneli Aç"}
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
                  locale="tr"
                  TooltipContent={() => null}
                  TaskListHeader={TaskListHeader}
                  TaskListTable={TaskListTable}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Calendar size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="font-medium">Görüntülenecek tarihli görev bulunamadı.</p>
                  <p className="text-sm mt-2 opacity-70">Sağ panelden görevlere başlangıç ve bitiş tarihi ekleyin.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Right Panel (Compact Task List & Filters) */}
      {rightPanelOpen && (
        <aside className="w-[30%] min-w-[320px] max-w-[400px] h-full bg-mac-sidebarLight dark:bg-mac-sidebarDark flex flex-col border-l border-gray-200 dark:border-zinc-800">
        {/* Filters Area */}
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex flex-col gap-3 shrink-0">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <List size={16} /> Görevler
          </h2>
          
          <div className="flex flex-wrap gap-1.5">
            <div className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Statü Filtresi</div>
            <button
              onClick={() => setActiveStatusFilter('all')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
                activeStatusFilter === 'all' ? "bg-mac-accent text-white shadow-sm" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
              )}
            >
              Hepsi
            </button>
            <button
              onClick={() => setActiveStatusFilter('overdue')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1",
                activeStatusFilter === 'overdue' ? "bg-red-500 text-white shadow-sm" : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
              )}
            >
              Gecikmiş
            </button>
            <button
              onClick={() => setActiveStatusFilter('in_progress')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
                activeStatusFilter === 'in_progress' ? "bg-mac-accent text-white shadow-sm" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400"
              )}
            >
              Devam Eden
            </button>
            <button
              onClick={() => setActiveStatusFilter('completed')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
                activeStatusFilter === 'completed' ? "bg-emerald-500 text-white shadow-sm" : "bg-emerald-500/10 text-emerald-500"
              )}
            >
              Tamamlanan
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <div className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 mt-1">Kişi Filtresi</div>
            <button
              onClick={() => setActiveAssigneeFilter('all')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
                activeAssigneeFilter === 'all' ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
              )}
            >
              Tümü
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
                {person}
              </button>
            ))}
          </div>
        </div>

        {/* Compact List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {filteredTasks.length === 0 ? (
             <div className="text-xs text-gray-400 italic p-4 text-center">Filtrelere uygun görev yok.</div>
          ) : (
            filteredTasks.map((task, idx) => {
              const overdue = isOverdue(task);
              const assigneesList = getTaskAssignees(task);

              return (
                <div 
                  key={`${task.note_id}-${task.line_number}-${idx}`} 
                  onClick={() => setEditingTask({
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
                        toggleTask(task.note_id, task.line_number, !task.completed);
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
                        selectNote(task.note_id);
                        setViewMode('notes');
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
      )}

      {/* Modals */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onSave={handleSaveModal}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
};
