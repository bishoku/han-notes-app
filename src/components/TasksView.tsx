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
      <div className="flex flex-col w-full h-full bg-mac-mainLight dark:bg-mac-mainDark pt-safe pb-safe">
        {/* Mobile Header */}
        <div className="h-11 min-h-[44px] border-b border-mac-borderLight dark:border-mac-borderDark flex items-center justify-between px-3 shrink-0 bg-mac-mainLight/80 dark:bg-mac-mainDark/80 backdrop-blur-xs select-none">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer -ml-1"
              title={t('expandSidebar')}
            >
              <Menu size={18} />
            </button>
            <span className="font-semibold text-xs text-gray-800 dark:text-gray-200">
              {t('tasks', 'Görevler')} ({filteredTasks.length})
            </span>
          </div>
        </div>

        {/* Full-width Task List on mobile */}
        <div className="flex-1 overflow-y-auto min-h-0">
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
