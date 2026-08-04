import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, User, Tag, AlertCircle, Percent, CheckSquare, AlignLeft } from 'lucide-react';
import { EditModal } from '@/components/EditModal';
import { MultiBadgeSelect } from '@/components/MultiBadgeSelect';
import { DateRangePicker } from '@/components/DateRangePicker';
import { useTaskStore } from '@/store/taskStore';

export interface TaskEditData {
  noteId: string;
  lineNumber: number;
  content: string;
  completed: boolean;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  priority?: string | null;
  assignee?: string | null;
  assignees?: string[];
  progress?: number | null;
  tags?: string[];
}

interface TaskEditModalProps {
  task: TaskEditData;
  onSave: (updated: TaskEditData) => Promise<void>;
  onClose: () => void;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({ task, onSave, onClose }) => {
  const { registry, loadTaskRegistry } = useTaskStore();
  const { t } = useTranslation();

  const [content, setContent] = useState(task.content);
  const [completed, setCompleted] = useState(task.completed);
  const [description, setDescription] = useState(task.description || '');
  const [startDate, setStartDate] = useState(task.startDate || '');
  const [endDate, setEndDate] = useState(task.endDate || '');
  const [priority, setPriority] = useState(task.priority || 'medium');
  
  const initialAssignees = task.assignees && task.assignees.length > 0 
    ? task.assignees 
    : (task.assignee ? [task.assignee] : []);
  const [assignees, setAssignees] = useState<string[]>(initialAssignees);

  const [progress, setProgress] = useState<number>(task.progress ?? (task.completed ? 100 : 0));
  const [tags, setTags] = useState<string[]>(task.tags || []);

  useEffect(() => {
    loadTaskRegistry();
  }, [loadTaskRegistry]);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await onSave({
      noteId: task.noteId,
      lineNumber: task.lineNumber,
      content: content.trim(),
      completed: progress === 100 ? true : completed,
      description: description.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      priority: priority || null,
      assignee: assignees.join(', ') || null,
      assignees,
      progress: Number(progress),
      tags,
    });
  };

  return (
    <EditModal
      icon={<CheckSquare size={18} className="text-mac-accent" />}
      title={t('editTaskDetails')}
      accentClass="bg-mac-accent hover:bg-blue-600"
      onSubmit={handleSubmit}
      onClose={onClose}
      footerLeft={
        <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 font-medium">
          <input
            type="checkbox"
            checked={completed || progress === 100}
            onChange={(e) => {
              setCompleted(e.target.checked);
              if (e.target.checked) setProgress(100);
              else if (progress === 100) setProgress(0);
            }}
            className="rounded accent-mac-accent"
          />
          {t('markCompleted')}
        </label>
      }
    >
      {/* Task Title */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-gray-600 dark:text-gray-400">{t('taskTitle')}</label>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('taskTitlePlaceholder')}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-mac-accent/40 font-medium text-gray-800 dark:text-gray-200"
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
          <AlignLeft size={12} /> {t('description')}
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('taskDescPlaceholder')}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-mac-accent/40 text-gray-800 dark:text-gray-200 resize-y"
        />
      </div>

      {/* Date Range */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
          <Calendar size={12} /> {t('taskTimeline')}
        </label>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
      </div>

      {/* Priority & Progress */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <AlertCircle size={12} /> {t('priorityLevel')}
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-mac-accent/40 text-gray-800 dark:text-gray-200 font-medium"
          >
            <option value="low">{t('priorityLow')}</option>
            <option value="medium">{t('priorityMedium')}</option>
            <option value="high">{t('priorityHigh')}</option>
            <option value="urgent">{t('priorityUrgent')}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label className="font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <Percent size={12} /> {t('progress')}
            </label>
            <span className="font-mono font-bold text-mac-accent">{progress}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            onChange={(e) => {
              const val = Number(e.target.value);
              setProgress(val);
              if (val === 100) setCompleted(true);
              else if (val === 0) setCompleted(false);
            }}
            className="w-full accent-mac-accent cursor-pointer mt-1"
          />
        </div>
      </div>

      {/* Assignees */}
      <MultiBadgeSelect
        label={t('assignees')}
        icon={<User size={12} />}
        values={assignees}
        onChange={setAssignees}
        suggestions={registry.assignees}
        placeholder={t('assigneePlaceholder')}
        badgeStyle="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
      />

      {/* Tags */}
      <MultiBadgeSelect
        label={t('tagsLabel')}
        icon={<Tag size={12} />}
        values={tags}
        onChange={setTags}
        suggestions={registry.tags}
        placeholder={t('tagsPlaceholder')}
        badgeStyle="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700"
      />
    </EditModal>
  );
};
