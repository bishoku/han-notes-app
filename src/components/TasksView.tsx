import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '@/store/taskStore';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import { TaskEditModal } from '@/components/TaskEditModal';
import type { TaskEditData } from '@/components/TaskEditModal';
import { useTaskFilters } from './tasks/useTaskFilters';
import { TasksGanttView } from './tasks/TasksGanttView';
import { TasksSidebarList } from './tasks/TasksSidebarList';

export const TasksView: React.FC = () => {
  const navigate = useNavigate();
  const { tasks, registry, loadTasks, toggleTask, updateTaskMetadata } = useTaskStore();
  const selectNote = useNoteStore(state => state.selectNote);
  const { setViewMode, rightPanelOpen, toggleRightPanel } = useUiStore();

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
