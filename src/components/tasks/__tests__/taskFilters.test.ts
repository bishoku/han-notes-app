import { describe, it } from 'vitest';
import { strict as assert } from 'node:assert';
import { isTaskOverdue, getTaskAssignees, getTaskTags } from '../useTaskFilters.ts';
import type { TaskInfo } from '@/services/storage';

describe('Task Filter Helpers & Multi-select Logic', () => {
  const sampleTasks: TaskInfo[] = [
    {
      note_id: 'note-1',
      line_number: 1,
      content: 'Fix critical auth bug',
      completed: false,
      end_date: '2026-09-01',
      priority: 'urgent',
      assignees: ['Alice', 'Bob'],
      tags: ['bug', 'auth'],
      related_notes: [],
      raw_line: '- [ ] Fix critical auth bug',
    },
    {
      note_id: 'note-1',
      line_number: 5,
      content: 'Implement dark mode toggle',
      completed: false,
      end_date: '2026-09-30',
      priority: 'medium',
      assignees: ['Bob'],
      tags: ['ui', 'frontend'],
      related_notes: [],
      raw_line: '- [ ] Implement dark mode toggle',
    },
    {
      note_id: 'note-2',
      line_number: 10,
      content: 'Write unit tests',
      completed: true,
      progress: 100,
      end_date: '2026-09-10',
      priority: 'low',
      assignee: 'Charlie',
      assignees: ['Charlie'],
      tags: ['testing'],
      related_notes: [],
      raw_line: '- [x] Write unit tests',
    },
    {
      note_id: 'note-2',
      line_number: 15,
      content: 'Unassigned backlog item',
      completed: false,
      progress: 0,
      assignees: [],
      tags: ['backlog'],
      related_notes: [],
      raw_line: '- [ ] Unassigned backlog item',
    },
  ];

  const todayStr = '2026-09-15';

  it('correctly determines overdue status', () => {
    // Task 1: end_date 2026-09-01 < 2026-09-15 and not completed -> overdue
    assert.equal(isTaskOverdue(sampleTasks[0], todayStr), true);
    // Task 2: end_date 2026-09-30 > 2026-09-15 -> not overdue
    assert.equal(isTaskOverdue(sampleTasks[1], todayStr), false);
    // Task 3: completed -> not overdue even if end_date past
    assert.equal(isTaskOverdue(sampleTasks[2], todayStr), false);
    // Task 4: no end_date -> not overdue
    assert.equal(isTaskOverdue(sampleTasks[3], todayStr), false);
  });

  it('correctly parses and normalizes assignees', () => {
    assert.deepEqual(getTaskAssignees(sampleTasks[0]), ['Alice', 'Bob']);
    assert.deepEqual(getTaskAssignees(sampleTasks[1]), ['Bob']);
    assert.deepEqual(getTaskAssignees(sampleTasks[2]), ['Charlie']);
    assert.deepEqual(getTaskAssignees(sampleTasks[3]), []);
  });

  it('correctly parses and normalizes tags with or without #', () => {
    assert.deepEqual(getTaskTags(sampleTasks[0]), ['bug', 'auth']);
    assert.deepEqual(getTaskTags(sampleTasks[1]), ['ui', 'frontend']);
    assert.deepEqual(getTaskTags(sampleTasks[2]), ['testing']);
    assert.deepEqual(getTaskTags(sampleTasks[3]), ['backlog']);
  });

  it('correctly filters tasks by multi-status (OR)', () => {
    const selectedStatuses = ['overdue', 'completed'];
    const filtered = sampleTasks.filter(task => {
      return selectedStatuses.some(status => {
        if (status === 'overdue') return isTaskOverdue(task, todayStr);
        if (status === 'in_progress') return !task.completed && (task.progress ?? 0) < 100;
        if (status === 'completed') return task.completed || (task.progress ?? 0) === 100;
        return false;
      });
    });

    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].line_number, 1);
    assert.equal(filtered[1].line_number, 10);
  });

  it('correctly filters tasks by multi-assignee (OR)', () => {
    const selectedAssignees = ['Alice', 'unassigned'];
    const filtered = sampleTasks.filter(task => {
      const taskAssignees = getTaskAssignees(task);
      const matchesUnassigned = selectedAssignees.includes('unassigned') && taskAssignees.length === 0;
      const matchesSpecific = taskAssignees.some(a => selectedAssignees.includes(a));
      return matchesUnassigned || matchesSpecific;
    });

    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].content, 'Fix critical auth bug');
    assert.equal(filtered[1].content, 'Unassigned backlog item');
  });

  it('correctly filters tasks by multi-tag (OR)', () => {
    const selectedTags = ['auth', 'ui'];
    const filtered = sampleTasks.filter(task => {
      const taskTags = getTaskTags(task);
      return taskTags.some(t => selectedTags.includes(t));
    });

    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].line_number, 1);
    assert.equal(filtered[1].line_number, 5);
  });

  it('correctly intersects Status, Assignee and Tag filters (AND)', () => {
    const selectedStatuses = ['in_progress'];
    const selectedAssignees = ['Bob'];
    const selectedTags = ['ui'];

    const filtered = sampleTasks.filter(task => {
      const statusMatches = selectedStatuses.some(status => {
        if (status === 'overdue') return isTaskOverdue(task, todayStr);
        if (status === 'in_progress') return !task.completed && (task.progress ?? 0) < 100;
        if (status === 'completed') return task.completed || (task.progress ?? 0) === 100;
        return false;
      });
      const taskAssignees = getTaskAssignees(task);
      const assigneeMatches = taskAssignees.some(a => selectedAssignees.includes(a));
      const taskTags = getTaskTags(task);
      const tagMatches = taskTags.some(t => selectedTags.includes(t));

      return statusMatches && assigneeMatches && tagMatches;
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].content, 'Implement dark mode toggle');
  });
});
