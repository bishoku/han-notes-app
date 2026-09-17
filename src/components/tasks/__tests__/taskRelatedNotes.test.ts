import { describe, it } from 'vitest';
import { strict as assert } from 'node:assert';
import { parseTaskLineText, parseDecisionLineText } from '../../../utils/lineParser.ts';
import { useGraphStore } from '../../../store/graphStore.ts';

describe('Task & Decision Related Notes Parsing and Persistence', () => {
  it('correctly parses related_notes from a task line comment', () => {
    const line = '- [ ] Review architecture <!-- task:{"priority":"high","related_notes":["docs/arch","projects/han"]} -->';
    const parsed = parseTaskLineText(line);

    assert.ok(parsed);
    assert.equal(parsed.content, 'Review architecture');
    assert.equal(parsed.priority, 'high');
    assert.deepEqual(parsed.relatedNotes, ['docs/arch', 'projects/han']);
  });

  it('correctly falls back to empty array when no related notes exist in task', () => {
    const line = '- [ ] Simple task without metadata';
    const parsed = parseTaskLineText(line);

    assert.ok(parsed);
    assert.equal(parsed.content, 'Simple task without metadata');
    assert.deepEqual(parsed.relatedNotes, []);
  });

  it('correctly parses camelCase relatedNotes if provided', () => {
    const line = '- [x] Completed task <!-- task:{"relatedNotes":["meeting-1"]} -->';
    const parsed = parseTaskLineText(line);

    assert.ok(parsed);
    assert.equal(parsed.completed, true);
    assert.deepEqual(parsed.relatedNotes, ['meeting-1']);
  });

  it('correctly parses related_notes from a decision line comment', () => {
    const line = '- [D] Use SQLite for local storage <!-- decision:{"status":"approved","related_notes":["rfc/001"]} -->';
    const parsed = parseDecisionLineText(line);

    assert.ok(parsed);
    assert.equal(parsed.content, 'Use SQLite for local storage');
    assert.equal(parsed.status, 'approved');
    assert.deepEqual(parsed.relatedNotes, ['rfc/001']);
  });

  it('correctly generates task-ref graph edges in graphStore when note has task with related_notes', () => {
    const graphState = useGraphStore.getState();
    graphState.resetGraph();

    const note1Content = `
# Source Note
Here is some text.
- [ ] Implement feature <!-- task:{"priority":"urgent","related_notes":["target-note"]} -->
    `.trim();

    graphState.updateNoteContent('source-note', note1Content);

    const { nodes, edges } = useGraphStore.getState();

    // Verify target-note was added (as ghost or existing node)
    const targetNode = nodes.find(n => n.id === 'target-note');
    assert.ok(targetNode, 'Target note should exist in graph nodes');

    // Verify task-ref edge was created
    const taskEdge = edges.find(e => e.source === 'source-note' && e.target === 'target-note' && e.type === 'task-ref');
    assert.ok(taskEdge, 'An edge of type task-ref should connect source-note to target-note');

    // Verify source node outgoing links and target node incoming links
    const sourceNode = nodes.find(n => n.id === 'source-note');
    assert.ok(sourceNode?.outgoingLinks.includes('target-note'));
    assert.ok(targetNode?.incomingLinks.includes('source-note'));
  });
});
