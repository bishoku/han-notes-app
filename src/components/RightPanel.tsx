import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';
import { useTaskStore } from '@/store/taskStore';
import { TaskEditModal } from '@/components/TaskEditModal';
import { eventBus } from '@/lib/eventBus';
import { isNoteIdMatch } from '@/utils/pathUtils';
import type { TaskEditData } from '@/components/TaskEditModal';
import {
  Link2,
  List,
  FileText,
  ArrowRight,
  CheckCircle2,
  Circle,
  SlidersHorizontal,
  AlertTriangle,
  Calendar,
  User,
  Tag,
  AlignLeft,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OutlineHeading {
  level: number;
  text: string;
  line: number;
}

export const RightPanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Individual Zustand selectors — only subscribe to fields we actually use
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const backlinks = useNoteStore((s) => s.backlinks);
  const selectNote = useNoteStore((s) => s.selectNote);
  const currentNoteId = useNoteStore((s) => s.currentNoteId);
  const currentNoteContent = useNoteStore((s) => s.currentNoteContent);

  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const toggleTask = useTaskStore((s) => s.toggleTask);
  const updateTaskMetadata = useTaskStore((s) => s.updateTaskMetadata);

  const [activeTab, setActiveTab] = useState<'links' | 'outline'>('links');
  const [editingTask, setEditingTask] = useState<TaskEditData | null>(null);

  // Automatically refresh tasks list when current note changes or panel is active
  useEffect(() => {
    if (rightPanelOpen) {
      loadTasks();
    }
  }, [rightPanelOpen, currentNoteId, loadTasks]);

  // Filter tasks belonging ONLY to the currently active note
  const noteTasks = useMemo(() => {
    return tasks.filter((t) => isNoteIdMatch(t.note_id, currentNoteId));
  }, [tasks, currentNoteId]);

  // Extract H1-H4 headings via event bus from MainEditor
  const [headings, setHeadings] = useState<OutlineHeading[]>([]);

  const extractHeadings = useCallback((content: string) => {
    if (!content) {
      setHeadings([]);
      return;
    }
    const list: OutlineHeading[] = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,4})\s+(.*)/);
      if (match) {
        list.push({
          level: match[1].length,
          text: match[2].replace(/#+\s*$/, '').trim(),
          line: i,
        });
      }
    }
    setHeadings(list);
  }, []);

  useEffect(() => {
    const unbind = eventBus.on('editor:outline-update', (content) => extractHeadings(content));
    const winHandler = (e: CustomEvent<string>) => extractHeadings(e.detail);
    window.addEventListener('outline-content-update' as any, winHandler);

    return () => {
      unbind();
      window.removeEventListener('outline-content-update' as any, winHandler);
    };
  }, [extractHeadings]);

  // Also extract headings on initial load / note switch
  useEffect(() => {
    if (currentNoteId && currentNoteContent) {
      extractHeadings(currentNoteContent);
    }
  }, [currentNoteId, extractHeadings]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rightPanelOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
        onClick={() => toggleRightPanel()}
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-[85%] max-w-[340px] md:relative md:inset-auto md:z-auto md:w-[25%] md:min-w-[250px] h-full bg-mac-sidebarLight dark:bg-mac-sidebarDark border-l border-mac-borderLight dark:border-mac-borderDark flex flex-col transition-all duration-200 ease-mac-ease shadow-2xl md:shadow-none animate-in slide-in-from-right duration-200 pt-safe pb-safe">
        {/* Tabs */}
        <div className="flex items-center p-2 border-b border-mac-borderLight dark:border-mac-borderDark gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('links')}
            className={cn(
              'flex-1 flex justify-center py-1.5 rounded-md transition-all duration-150 relative cursor-pointer',
              activeTab === 'links'
                ? 'bg-white dark:bg-zinc-800 shadow-mac-panel text-mac-accent font-medium'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
            title={t('backlinks')}
          >
            <Link2 size={16} />
            {backlinks.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-mac-accent" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('outline')}
            className={cn(
              'flex-1 flex justify-center py-1.5 rounded-md transition-all duration-150 relative cursor-pointer',
              activeTab === 'outline'
                ? 'bg-white dark:bg-zinc-800 shadow-mac-panel text-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
            title={t('outline')}
          >
            <List size={16} />
            {(headings.length > 0 || noteTasks.length > 0) && (
              <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
            )}
          </button>
          <button
            onClick={toggleRightPanel}
            className="md:hidden p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md cursor-pointer ml-1"
            title={t('close')}
          >
            <X size={16} />
          </button>
        </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col select-none">
        {activeTab === 'links' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {t('backlinks')}
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                {backlinks.length}
              </span>
            </div>

            {backlinks.length === 0 ? (
              <div className="text-xs text-gray-400 italic p-3 text-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-lg">
                {t('noResultsFound')}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {backlinks.map((link, idx) => (
                  <button
                    key={`${link.source_note_id}-${idx}`}
                    onClick={() => {
                      selectNote(link.source_note_id);
                      setViewMode('notes');
                      navigate(`/notes/${encodeURIComponent(link.source_note_id)}`);
                    }}
                    className="group text-left p-3 rounded-lg bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80 shadow-sm hover:border-mac-accent/50 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 group-hover:text-mac-accent transition-colors">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText size={13} className="text-mac-accent" />
                        <span className="truncate">{link.source_note_id}</span>
                      </div>
                      <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 bg-gray-50 dark:bg-zinc-800/50 p-1.5 rounded font-mono">
                      {link.snippet}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Outline & Note Tasks Vertical Split View */}
        {activeTab === 'outline' && (
          <div className="flex flex-col h-full gap-3 overflow-hidden">
            {/* Top Half: Table of Contents (Headings) */}
            <div className="flex-1 overflow-y-auto min-h-[140px] pr-1">
              <div className="flex items-center justify-between mb-2 sticky top-0 bg-mac-sidebarLight dark:bg-mac-sidebarDark py-1 z-10">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t('outline')}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                  {headings.length}
                </span>
              </div>

              {headings.length === 0 ? (
                <div className="text-xs text-gray-400 italic p-3 text-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-lg">
                  {t('noHeadingsFound')}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {headings.map((h, idx) => (
                    <div
                      key={`${h.line}-${idx}`}
                      style={{ paddingLeft: `${(h.level - 1) * 10 + 4}px` }}
                      className={cn(
                        'py-1.5 px-2 rounded text-xs cursor-pointer select-none transition-colors hover:bg-black/5 dark:hover:bg-white/5 truncate flex items-center gap-1.5 group',
                        h.level === 1 && 'font-bold text-gray-900 dark:text-gray-100 text-sm',
                        h.level === 2 && 'font-semibold text-gray-800 dark:text-gray-200',
                        h.level === 3 && 'font-medium text-gray-700 dark:text-gray-300',
                        h.level === 4 && 'font-normal text-gray-500 dark:text-gray-400'
                      )}
                      onClick={() => {
                        eventBus.emit('editor:scroll-to-heading', { line: h.line });
                        window.dispatchEvent(new CustomEvent('scroll-to-heading', { detail: { line: h.line } }));
                      }}
                    >
                      <span className="text-[9px] font-mono text-gray-400 group-hover:text-mac-accent transition-colors shrink-0">
                        H{h.level}
                      </span>
                      <span className="truncate">{h.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vertical Splitter Divider */}
            <div className="border-t border-gray-200 dark:border-zinc-800 my-1 shrink-0" />

            {/* Bottom Half: Tasks in Active Note */}
            <div className="flex-1 overflow-y-auto min-h-[160px] pr-1">
              <div className="flex items-center justify-between mb-2 sticky top-0 bg-mac-sidebarLight dark:bg-mac-sidebarDark py-1 z-10">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-mac-accent" />
                  {t('tasksInNote')}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-mac-accent/10 text-mac-accent border border-mac-accent/20">
                  {noteTasks.length}
                </span>
              </div>

              {noteTasks.length === 0 ? (
                <div className="text-xs text-gray-400 italic p-3 text-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-lg">
                  {t('noTasksInNote')}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {noteTasks.map((task, idx) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const overdue =
                      !task.completed && task.end_date && task.end_date < todayStr && (task.progress ?? 0) < 100;
                    const assigneesList =
                      task.assignees && task.assignees.length > 0
                        ? task.assignees
                        : task.assignee
                        ? [task.assignee]
                        : [];

                    return (
                      <div
                        key={`${task.note_id}-${task.line_number}-${idx}`}
                        className={cn(
                          'p-2.5 rounded-xl bg-white dark:bg-zinc-900 border transition-all text-xs flex flex-col gap-2 shadow-2xs hover:shadow-xs',
                          overdue ? 'border-red-500/40 bg-red-500/5 dark:bg-red-950/10' : 'border-gray-100 dark:border-zinc-800'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <button
                              onClick={() => toggleTask(task.note_id, task.line_number, !task.completed)}
                              className="mt-0.5 text-gray-400 hover:text-mac-accent transition-colors shrink-0 cursor-pointer"
                            >
                              {task.completed || (task.progress ?? 0) === 100 ? (
                                <CheckCircle2 className="text-emerald-500" size={16} />
                              ) : (
                                <Circle size={16} />
                              )}
                            </button>
                            <span
                              className={cn(
                                'font-medium leading-tight truncate',
                                (task.completed || (task.progress ?? 0) === 100) &&
                                  'line-through text-gray-400 dark:text-gray-500'
                              )}
                            >
                              {task.content}
                            </span>
                          </div>

                          <button
                            onClick={() =>
                              setEditingTask({
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
                              })
                            }
                            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-mac-accent transition-colors shrink-0 cursor-pointer"
                            title={t('editTaskModalTitle')}
                          >
                            <SlidersHorizontal size={13} />
                          </button>
                        </div>

                        {/* Task Description */}
                        {task.description && (
                          <div className="ml-6 text-[11px] text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800/60 p-2 rounded-lg border border-gray-100 dark:border-zinc-800/80 flex items-start gap-1.5 whitespace-pre-wrap leading-normal">
                            <AlignLeft size={11} className="text-gray-400 mt-0.5 shrink-0" />
                            <span>{task.description}</span>
                          </div>
                        )}

                        {/* Sub Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {overdue && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full font-bold bg-red-500 text-white">
                              <AlertTriangle size={9} /> {t('taskFilterOverdue')}
                            </span>
                          )}

                          {task.end_date && (
                            <span className="font-mono text-gray-500 dark:text-gray-400 flex items-center gap-0.5 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                              <Calendar size={10} /> {task.end_date}
                            </span>
                          )}

                          {assigneesList.length > 0 && (
                            <div className="flex items-center gap-1">
                              {assigneesList.map((person) => (
                                <span
                                  key={person}
                                  className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5 bg-blue-500/10 px-1.5 py-0.5 rounded font-medium border border-blue-500/20"
                                >
                                  <User size={10} /> {person}
                                </span>
                              ))}
                            </div>
                          )}

                          {task.tags && task.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              {task.tags.map((t) => (
                                <span key={t} className="font-mono text-gray-400 flex items-center gap-0.5">
                                  <Tag size={9} /> #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Task Edit Modal directly from Right Panel */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onSave={async (updated) => {
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
            if (currentNoteId) {
              await selectNote(currentNoteId);
            }
          }}
          onClose={() => setEditingTask(null)}
        />
      )}
    </aside>
  </>
  );
};
