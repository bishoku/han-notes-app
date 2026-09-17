import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ExternalLink,
  User,
  Calendar,
  Tag,
  AlertTriangle,
  X,
  BarChart,
  List as ListIcon,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { TaskInfo, TaskRegistry } from '@/services/storage';
import type { TaskEditData } from '@/components/TaskEditModal';
import { useTaskFilters, isTaskOverdue, getTaskAssignees, getTaskTags, type TaskStatusType } from './useTaskFilters';
import { FilterMultiSelect, type FilterOption } from './FilterMultiSelect';

interface NoteTasksBottomPanelProps {
  tasks: TaskInfo[];
  registry?: TaskRegistry;
  onToggleTask: (noteId: string, lineNumber: number, completed: boolean) => void;
  onEditTask: (task: TaskEditData) => void;
  onUpdateTask?: (
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
  onScrollToTask?: (lineNumber: number) => void;
}

export const NoteTasksBottomPanel: React.FC<NoteTasksBottomPanelProps> = ({
  tasks,
  registry = { assignees: [], tags: [] },
  onToggleTask,
  onEditTask,
  onUpdateTask,
  onScrollToTask,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  // Default is CLOSED as requested by user
  const [isOpen, setIsOpen] = useState(false);
  const [panelViewMode, setPanelViewMode] = useState<'gantt' | 'list'>('gantt');
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>(ViewMode.Day);
  const [showUndatedOnTimeline, setShowUndatedOnTimeline] = useState(true);

  // Scoped multi-select filters
  const {
    selectedStatuses,
    toggleStatus,
    setSelectedStatuses,
    selectedAssignees,
    setSelectedAssignees,
    availableAssignees,
    assigneeCounts,
    selectedTags,
    setSelectedTags,
    availableTags,
    tagCounts,
    clearAllFilters,
    hasActiveFilters,
    filteredTasks,
    todayStr,
  } = useTaskFilters(tasks, registry);

  const totalCount = tasks.length;
  const completedCount = useMemo(() => {
    return tasks.filter(t => t.completed || (t.progress ?? 0) === 100).length;
  }, [tasks]);

  const overdueCount = useMemo(() => {
    return tasks.filter(t => isTaskOverdue(t, todayStr)).length;
  }, [tasks, todayStr]);

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Split filtered tasks into dated and undated
  const { datedTasks, undatedTasks } = useMemo(() => {
    const dated: TaskInfo[] = [];
    const undated: TaskInfo[] = [];
    filteredTasks.forEach(task => {
      if (task.start_date && task.end_date) {
        dated.push(task);
      } else {
        undated.push(task);
      }
    });
    return { datedTasks: dated, undatedTasks: undated };
  }, [filteredTasks]);

  // Transform tasks for Gantt chart
  const ganttTasks = useMemo(() => {
    const gTasks: GanttTask[] = [];
    const colorPrimary = '#3b82f6';
    const colorCompleted = '#10b981';
    const colorOverdue = '#ef4444';
    const colorUndated = '#f59e0b'; // Amber for tasks with no explicit dates

    const truncate = (text: string, maxLen = 30) => {
      return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
    };

    // 1. Dated tasks
    datedTasks.forEach(task => {
      const progress = task.progress ?? (task.completed ? 100 : 0);
      let styles = { backgroundColor: colorPrimary, backgroundSelectedColor: colorPrimary };
      if (progress === 100) styles = { backgroundColor: colorCompleted, backgroundSelectedColor: colorCompleted };
      else if (isTaskOverdue(task, todayStr)) styles = { backgroundColor: colorOverdue, backgroundSelectedColor: colorOverdue };

      gTasks.push({
        id: `${task.note_id}_${task.line_number}`,
        type: 'task',
        name: truncate(task.content),
        start: new Date(task.start_date!),
        end: new Date(task.end_date!),
        progress: progress,
        styles: styles,
      });
    });

    // 2. Undated tasks fallback display on timeline
    if (showUndatedOnTimeline && undatedTasks.length > 0) {
      const today = new Date(todayStr);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      undatedTasks.forEach(task => {
        const progress = task.progress ?? (task.completed ? 100 : 0);
        gTasks.push({
          id: `${task.note_id}_${task.line_number}`,
          type: 'task',
          name: `[${t('undatedTasks', 'Tarihsiz')}] ${truncate(task.content, 22)}`,
          start: task.start_date ? new Date(task.start_date) : today,
          end: task.end_date ? new Date(task.end_date) : tomorrow,
          progress: progress,
          styles: {
            backgroundColor: colorUndated,
            backgroundSelectedColor: '#d97706',
          },
        });
      });
    }

    gTasks.sort((a, b) => a.start.getTime() - b.start.getTime());
    return gTasks;
  }, [datedTasks, undatedTasks, showUndatedOnTimeline, todayStr, t]);

  const tasksRef = useRef<TaskInfo[]>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Gantt task drag or progress update
  const handleGanttTaskChange = async (ganttTask: GanttTask) => {
    const parts = ganttTask.id.split('_');
    if (parts.length < 2) return;
    const lineNumber = parseInt(parts[1], 10);
    const task = tasksRef.current.find(t => t.line_number === lineNumber);
    if (!task || !onUpdateTask) return;

    const startCopy = new Date(ganttTask.start);
    startCopy.setMinutes(startCopy.getMinutes() - startCopy.getTimezoneOffset());
    const newStart = startCopy.toISOString().split('T')[0];

    const endCopy = new Date(ganttTask.end);
    endCopy.setMinutes(endCopy.getMinutes() - endCopy.getTimezoneOffset());
    const newEnd = endCopy.toISOString().split('T')[0];

    const newProgress = Math.round(ganttTask.progress);
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
  };

  // Quick schedule action for undated tasks
  const handleQuickSchedule = async (task: TaskInfo, startDate: string, endDate: string) => {
    if (!onUpdateTask) return;
    await onUpdateTask(
      task.note_id,
      task.line_number,
      task.content,
      task.completed,
      {
        description: task.description,
        startDate,
        endDate,
        priority: task.priority,
        assignees: task.assignees,
        progress: task.progress,
        tags: task.tags,
        relatedNotes: task.related_notes,
      }
    );
  };

  const getEndOfWeekStr = (baseStr: string): string => {
    const d = new Date(baseStr);
    const day = d.getDay();
    const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
    const end = new Date(d.setDate(diff));
    return end.toISOString().split('T')[0];
  };

  // Assignee options for combobox
  const assigneeOptions: FilterOption[] = useMemo(() => {
    const list: FilterOption[] = [];
    const unassignedCount = assigneeCounts.unassigned ?? 0;
    if (unassignedCount > 0 || availableAssignees.length > 0) {
      list.push({
        id: 'unassigned',
        label: t('taskUnassigned', 'Atanmamış'),
        count: unassignedCount,
      });
    }

    availableAssignees.forEach(person => {
      list.push({
        id: person,
        label: person,
        count: assigneeCounts[person] ?? 0,
      });
    });
    return list;
  }, [availableAssignees, assigneeCounts, t]);

  // Tag options for combobox
  const tagOptions: FilterOption[] = useMemo(() => {
    return availableTags.map(tag => ({
      id: tag,
      label: `#${tag}`,
      count: tagCounts[tag] ?? 0,
    }));
  }, [availableTags, tagCounts]);

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

  const isStatusActive = (status: TaskStatusType) => selectedStatuses.includes(status);
  const isAllStatusActive = selectedStatuses.length === 0;

  if (isMobile) {
    return null;
  }

  return (
    <div className="hidden md:block shrink-0 w-full border-t border-gray-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md transition-all select-none z-20 shadow-lg print:hidden">
      {/* ── Collapsible Header Bar (Default closed, click to toggle) ── */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 md:px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-mac-accent/10 text-mac-accent">
            <BarChart size={14} />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
              {t('noteTasks', 'Not Görevleri')}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700">
              {completedCount}/{totalCount}
            </span>
          </div>

          {/* Mini Progress Bar */}
          <div className="hidden sm:flex items-center gap-1.5 ml-2">
            <div className="w-16 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-mac-accent transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-400">{progressPercent}%</span>
          </div>

          {undatedTasks.length > 0 && (
            <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Clock size={10} /> {undatedTasks.length} {t('undatedTasks', 'Tarihsiz')}
            </span>
          )}

          {overdueCount > 0 && (
            <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
              <AlertTriangle size={10} /> {overdueCount} {t('overdueTasks', 'Gecikmiş')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <span className="text-[10px] font-medium text-mac-accent bg-mac-accent/10 px-1.5 py-0.5 rounded">
              {filteredTasks.length} {t('results', 'sonuç')}
            </span>
          )}
          <button
            type="button"
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded transition-colors"
            title={isOpen ? t('collapse', 'Daralt') : t('expand', 'Genişlet')}
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* ── Expanded Content (Gantt Chart / List + Filters + Undated Tasks Shelf) ── */}
      {isOpen && (
        <div className="px-3 md:px-4 pb-3 flex flex-col gap-2.5 border-t border-gray-100 dark:border-zinc-800/80 animate-in fade-in duration-150 h-[380px] max-h-[50vh] overflow-hidden">
          {/* Top Control Bar: Filters + View Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 shrink-0">
            {/* Multi-Select Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Multi-Select Toggle Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedStatuses([])}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer",
                    isAllStatusActive
                      ? "bg-mac-accent text-white shadow-2xs"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                  )}
                >
                  {t('taskAll', 'Hepsi')}
                </button>
                <button
                  type="button"
                  onClick={() => toggleStatus('overdue')}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer",
                    isStatusActive('overdue')
                      ? "bg-red-500 text-white shadow-2xs ring-2 ring-red-500/20"
                      : "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20"
                  )}
                >
                  {t('overdueTasks', 'Gecikmiş')}
                </button>
                <button
                  type="button"
                  onClick={() => toggleStatus('in_progress')}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer",
                    isStatusActive('in_progress')
                      ? "bg-mac-accent text-white shadow-2xs ring-2 ring-mac-accent/20"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                  )}
                >
                  {t('taskInProgress', 'Devam Eden')}
                </button>
                <button
                  type="button"
                  onClick={() => toggleStatus('completed')}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer",
                    isStatusActive('completed')
                      ? "bg-emerald-500 text-white shadow-2xs ring-2 ring-emerald-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                  )}
                >
                  {t('taskCompleted', 'Tamamlanan')}
                </button>
              </div>

              {/* Assignee Filter Dropdown */}
              {assigneeOptions.length > 0 && (
                <FilterMultiSelect
                  label={t('taskFilterAssignee', 'Sorumlu')}
                  icon={<User size={11} />}
                  selectedValues={selectedAssignees}
                  onChange={setSelectedAssignees}
                  options={assigneeOptions}
                  placeholder={t('taskAll', 'Hepsi')}
                  searchPlaceholder={t('searchAssignees', 'Sorumlu ara...')}
                  badgeStyle="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
                  align="left"
                />
              )}

              {/* Tag Filter Dropdown */}
              {tagOptions.length > 0 && (
                <FilterMultiSelect
                  label={t('taskFilterTag', 'Etiket')}
                  icon={<Tag size={11} />}
                  selectedValues={selectedTags}
                  onChange={setSelectedTags}
                  options={tagOptions}
                  placeholder={t('taskAll', 'Hepsi')}
                  searchPlaceholder={t('searchTags', 'Etiket ara...')}
                  badgeStyle="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
                  align="left"
                />
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 text-[11px] font-medium text-mac-accent hover:underline cursor-pointer"
                >
                  <X size={11} /> {t('clearFilters', 'Temizle')}
                </button>
              )}
            </div>

            {/* Right: Gantt vs List Mode Switcher & Time Mode */}
            <div className="flex items-center gap-2">
              {panelViewMode === 'gantt' && (
                <div className="hidden sm:flex items-center bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setGanttViewMode(ViewMode.Day)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-medium rounded transition-all cursor-pointer",
                      ganttViewMode === ViewMode.Day ? "bg-white dark:bg-zinc-700 shadow-2xs text-gray-900 dark:text-gray-100 font-semibold" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                  >
                    {t('taskDay', 'Gün')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGanttViewMode(ViewMode.Week)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-medium rounded transition-all cursor-pointer",
                      ganttViewMode === ViewMode.Week ? "bg-white dark:bg-zinc-700 shadow-2xs text-gray-900 dark:text-gray-100 font-semibold" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                  >
                    {t('taskWeek', 'Hafta')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGanttViewMode(ViewMode.Month)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-medium rounded transition-all cursor-pointer",
                      ganttViewMode === ViewMode.Month ? "bg-white dark:bg-zinc-700 shadow-2xs text-gray-900 dark:text-gray-100 font-semibold" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                  >
                    {t('taskMonth', 'Ay')}
                  </button>
                </div>
              )}

              {/* View Selector: Gantt vs List */}
              <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-gray-200 dark:border-zinc-700 select-none">
                <button
                  type="button"
                  onClick={() => setPanelViewMode('gantt')}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer",
                    panelViewMode === 'gantt'
                      ? "bg-white dark:bg-zinc-700 shadow-2xs text-mac-accent font-semibold"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  )}
                  title={t('ganttView', 'Gantt Çizelgesi')}
                >
                  <BarChart size={12} />
                  <span>{t('taskChart', 'Gantt')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelViewMode('list')}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer",
                    panelViewMode === 'list'
                      ? "bg-white dark:bg-zinc-700 shadow-2xs text-mac-accent font-semibold"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  )}
                  title={t('listView', 'Liste Görünümü')}
                >
                  <ListIcon size={12} />
                  <span>{t('taskList', 'Liste')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Main Area: Gantt Chart View or List View ── */}
          {panelViewMode === 'gantt' ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative border border-gray-200 dark:border-zinc-800 rounded-xl bg-gray-50/50 dark:bg-zinc-950/50">
              {/* Gantt Timeline View */}
              <div className="flex-1 overflow-auto relative min-h-[140px]">
                {ganttTasks.length > 0 ? (
                  <Gantt
                    tasks={ganttTasks}
                    viewMode={ganttViewMode}
                    onDateChange={handleGanttTaskChange}
                    onProgressChange={handleGanttTaskChange}
                    listCellWidth="200px"
                    columnWidth={ganttViewMode === ViewMode.Month ? 70 : ganttViewMode === ViewMode.Week ? 160 : 45}
                    rowHeight={32}
                    headerHeight={34}
                    fontSize="11px"
                    barCornerRadius={4}
                    barFill={65}
                    todayColor="rgba(59, 130, 246, 0.15)"
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center text-gray-400 gap-2">
                    <Clock size={24} className="text-amber-500 opacity-60" />
                    <p className="text-xs font-medium">
                      {t('noDatedTasksInNote', 'Bu notta henüz başlangıç/bitiş tarihli görev yok.')}
                    </p>
                    <p className="text-[11px] text-gray-400 max-w-sm">
                      Aşağıdaki tarihsiz görevlere hızlıca tarih atayabilir veya "Tarihsizleri Çizelgede Göster" seçeneğini kullanabilirsiniz.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Bottom Dock for Undated Tasks: Clean Solution for tasks without start/end dates ── */}
              {undatedTasks.length > 0 && (
                <div className="shrink-0 border-t border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-2 flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700 dark:text-gray-300 px-1">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-amber-500" />
                      <span>{t('undatedTasks', 'Tarihsiz Görevler')} ({undatedTasks.length})</span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        — Tarih atayarak Gantt çizelgesine yerleştirin:
                      </span>
                    </div>

                    <label className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                      <input
                        type="checkbox"
                        checked={showUndatedOnTimeline}
                        onChange={(e) => setShowUndatedOnTimeline(e.target.checked)}
                        className="rounded text-mac-accent focus:ring-0 cursor-pointer"
                      />
                      <span>{t('showUndatedOnGantt', 'Tarihsizleri Çizelgede Göster')}</span>
                    </label>
                  </div>

                  <div className="flex flex-col gap-1">
                    {undatedTasks.map((uTask, idx) => (
                      <div
                        key={`${uTask.note_id}-${uTask.line_number}-${idx}`}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/70 dark:border-zinc-700/60 text-xs hover:border-mac-accent/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <button
                            type="button"
                            onClick={() => onToggleTask(uTask.note_id, uTask.line_number, !uTask.completed)}
                            className="text-gray-400 hover:text-mac-accent shrink-0 cursor-pointer"
                          >
                            {uTask.completed ? (
                              <CheckCircle2 className="text-emerald-500" size={13} />
                            ) : (
                              <Circle size={13} />
                            )}
                          </button>
                          <span className={cn(
                            "truncate text-[11px]",
                            uTask.completed && "line-through text-gray-400"
                          )}>
                            {uTask.content}
                          </span>
                        </div>

                        {/* Quick-schedule buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleQuickSchedule(uTask, todayStr, todayStr)}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors cursor-pointer"
                            title="Başlangıç ve bitiş olarak bugünü ata"
                          >
                            {t('scheduleToday', 'Bugün')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickSchedule(uTask, todayStr, getEndOfWeekStr(todayStr))}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-colors cursor-pointer"
                            title="Bu haftanın sonuna kadar ata"
                          >
                            {t('scheduleThisWeek', 'Bu Hafta')}
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditTask({
                              noteId: uTask.note_id,
                              lineNumber: uTask.line_number,
                              content: uTask.content,
                              completed: uTask.completed,
                              description: uTask.description,
                              startDate: uTask.start_date,
                              endDate: uTask.end_date,
                              priority: uTask.priority,
                              assignee: uTask.assignee,
                              assignees: uTask.assignees,
                              progress: uTask.progress,
                              tags: uTask.tags,
                              relatedNotes: uTask.related_notes,
                            })}
                            className="p-1 rounded text-gray-400 hover:text-mac-accent hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            title={t('setDate', 'Tarih Belirle')}
                          >
                            <Calendar size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── List View (Alternative Full Card List) ── */
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-0.5 select-text">
              {filteredTasks.length === 0 ? (
                <div className="text-xs text-gray-400 italic py-6 text-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-lg">
                  {t('noResultsFound', 'Filtrelere uygun görev bulunamadı.')}
                </div>
              ) : (
                filteredTasks.map((task, idx) => {
                  const overdue = isTaskOverdue(task, todayStr);
                  const assigneesList = getTaskAssignees(task);
                  const taskTags = getTaskTags(task);
                  const isDone = task.completed || (task.progress ?? 0) === 100;

                  return (
                    <div
                      key={`${task.note_id}-${task.line_number}-${idx}`}
                      className={cn(
                        "flex items-start justify-between gap-2 p-2 rounded-xl border transition-all text-xs bg-gray-50/70 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 group shadow-2xs",
                        overdue ? "border-red-500/30 bg-red-500/5 dark:bg-red-950/10" : "border-gray-200/70 dark:border-zinc-700/60"
                      )}
                    >
                      {/* Left: Checkbox + Content + Metadata */}
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTask(task.note_id, task.line_number, !task.completed);
                          }}
                          className="mt-0.5 text-gray-400 hover:text-mac-accent transition-colors shrink-0 cursor-pointer"
                          title={isDone ? t('markAsIncomplete', 'Tamamlanmadı yap') : t('markAsCompleted', 'Tamamla')}
                        >
                          {isDone ? (
                            <CheckCircle2 className="text-emerald-500" size={15} />
                          ) : (
                            <Circle size={15} />
                          )}
                        </button>

                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <span
                            className={cn(
                              "font-medium leading-tight truncate",
                              isDone ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"
                            )}
                          >
                            {task.content}
                          </span>

                          {/* Metadata Badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {getPriorityBadge(task.priority)}

                            {assigneesList.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[9px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded">
                                <User size={8} /> {assigneesList.join(', ')}
                              </span>
                            )}

                            {(task.start_date || task.end_date) ? (
                              <span className="flex items-center gap-0.5 text-[9px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-700/60 px-1.5 py-0.2 rounded font-mono">
                                <Calendar size={8} /> {task.end_date ? task.end_date : task.start_date}
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-medium">
                                <Clock size={8} /> {t('undatedTasks', 'Tarihsiz')}
                              </span>
                            )}

                            {task.progress !== undefined && task.progress !== null && task.progress > 0 && task.progress < 100 && (
                              <span className="flex items-center gap-0.5 text-[9px] text-mac-accent bg-mac-accent/10 px-1.5 py-0.2 rounded font-mono font-bold">
                                {task.progress}%
                              </span>
                            )}

                            {taskTags.map(tag => (
                              <span
                                key={tag}
                                className="flex items-center gap-0.5 text-[9px] font-mono text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded"
                              >
                                <Tag size={8} /> #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        {onScrollToTask && (
                          <button
                            type="button"
                            onClick={() => onScrollToTask(task.line_number)}
                            className="p-1 rounded-md text-gray-400 hover:text-mac-accent hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            title={t('jumpToTask', 'Göreve Git')}
                          >
                            <ExternalLink size={13} />
                          </button>
                        )}

                        <button
                          type="button"
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
                          className="p-1 rounded-md text-gray-400 hover:text-mac-accent hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          title={t('editTaskProperties', 'Görev Özelliklerini Düzenle')}
                        >
                          <SlidersHorizontal size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
