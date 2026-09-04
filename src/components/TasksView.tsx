import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '@/store/taskStore';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { TaskEditModal } from '@/components/TaskEditModal';
import type { TaskEditData } from '@/components/TaskEditModal';
import { useTaskFilters } from './tasks/useTaskFilters';
import { TasksGanttView } from './tasks/TasksGanttView';
import { TasksSidebarList } from './tasks/TasksSidebarList';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const TasksView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { tasks, registry, loadTasks, toggleTask, updateTaskMetadata } = useTaskStore();
  const selectNote = useNoteStore(state => state.selectNote);
  const { setViewMode, rightPanelOpen, toggleRightPanel, setSidebarOpen } = useUiStore();

  const [editingTask, setEditingTask] = useState<TaskEditData | null>(null);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const {
    activeStatusFilter,
    setActiveStatusFilter,
    activeAssigneeFilter,
    setActiveAssigneeFilter,
    availableAssignees,
    filteredTasks,
    todayStr,
  } = useTaskFilters(tasks, registry);

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

  const handleSelectNote = (noteId: string) => {
    selectNote(noteId);
    setViewMode('notes');
    navigate(`/notes/${encodeURIComponent(noteId)}`);
  };

  if (isMobile) {
    return (
      <div className="flex flex-col w-full h-full bg-mac-mainLight dark:bg-mac-mainDark">
        {/* Mobile Header */}
        <header className="shrink-0 pt-safe bg-mac-mainLight/80 dark:bg-mac-mainDark/80 backdrop-blur-xs border-b border-mac-borderLight dark:border-mac-borderDark z-30 select-none">
          <div className="h-11 min-h-[44px] flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0 -ml-1 min-w-[38px] min-h-[38px] flex items-center justify-center active:scale-95"
                title={t('expandSidebar')}
              >
                <Menu size={20} />
              </button>
              <span className="font-semibold text-xs text-gray-800 dark:text-gray-200">
                {t('tasks', 'Görevler')} ({filteredTasks.length})
              </span>
            </div>
          </div>
        </header>

        {/* Full-width Task List on mobile */}
        <div className="flex-1 overflow-y-auto min-h-0 pb-safe">
          <TasksSidebarList
            filteredTasks={filteredTasks}
            availableAssignees={availableAssignees}
            activeStatusFilter={activeStatusFilter}
            setActiveStatusFilter={setActiveStatusFilter}
            activeAssigneeFilter={activeAssigneeFilter}
            setActiveAssigneeFilter={setActiveAssigneeFilter}
            todayStr={todayStr}
            onToggleTask={toggleTask}
            onSelectNote={handleSelectNote}
            onEditTask={setEditingTask}
          />
        </div>

        {editingTask && (
          <TaskEditModal
            task={editingTask}
            onSave={handleSaveModal}
            onClose={() => setEditingTask(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full h-full">
      {/* Center Panel (Gantt Chart) */}
      <TasksGanttView
        filteredTasks={filteredTasks}
        todayStr={todayStr}
        rightPanelOpen={rightPanelOpen}
        toggleRightPanel={toggleRightPanel}
        onUpdateTask={updateTaskMetadata}
      />

      {/* Right Panel (Compact Task List & Filters) */}
      {rightPanelOpen && (
        <TasksSidebarList
          filteredTasks={filteredTasks}
          availableAssignees={availableAssignees}
          activeStatusFilter={activeStatusFilter}
          setActiveStatusFilter={setActiveStatusFilter}
          activeAssigneeFilter={activeAssigneeFilter}
          setActiveAssigneeFilter={setActiveAssigneeFilter}
          todayStr={todayStr}
          onToggleTask={toggleTask}
          onSelectNote={handleSelectNote}
          onEditTask={setEditingTask}
        />
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
