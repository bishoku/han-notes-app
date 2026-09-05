import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { workspaceManager } from '../workspaceManager';
import { getStorageForWorkspace, moveNodeToWorkspace } from '../workspaceTransfer';
import { IndexedDBStorage } from '@/services/storage/IndexedDBStorage';
import { storage } from '@/services/storage';
import { useNoteStore } from '@/store/noteStore';
import type { Workspace } from '../types';

describe('Workspace Transfer & Cross-Workspace Move', () => {
  const wsSource: Workspace = {
    id: 'ws_src',
    name: 'Kaynak Alan',
    storageType: 'indexeddb',
    color: '#6366f1',
    icon: 'Folder',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const wsTarget: Workspace = {
    id: 'ws_tgt',
    name: 'Hedef Alan',
    storageType: 'indexeddb',
    color: '#10b981',
    icon: 'Folder',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    // Mock workspaceManager methods
    (workspaceManager as any).getWorkspace = async (id: string) => {
      if (id === 'ws_src') return wsSource;
      if (id === 'ws_tgt') return wsTarget;
      return null;
    };
    (workspaceManager as any).saveWorkspace = async () => {};
  });

  it('correctly creates an isolated IndexedDB storage instance for target workspace', async () => {
    const targetStorage = await getStorageForWorkspace('ws_tgt');
    assert.ok(targetStorage instanceof IndexedDBStorage);
    assert.strictEqual((targetStorage as IndexedDBStorage).getWorkspaceId(), 'ws_tgt');
    assert.strictEqual((targetStorage as IndexedDBStorage).getDbName(), 'han_notes_db_ws_tgt');
  });

  it('throws helpful error if target workspace does not exist', async () => {
    await assert.rejects(
      async () => {
        await getStorageForWorkspace('non_existent_ws');
      },
      /Hedef çalışma alanı bulunamadı/
    );
  });

  it('successfully moves a note from source to target workspace', async () => {
    const sourceReadMock = storage.readNote;
    const deleteNodeMock = useNoteStore.getState().deleteNode;
    const origWriteNote = IndexedDBStorage.prototype.writeNote;

    let targetWrittenNoteId = '';
    let targetWrittenContent = '';
    let deletedFromSourcePath = '';

    // Mock storage reading
    (storage as any).readNote = async (id: string) => {
      assert.strictEqual(id, 'Notes/MyIdea.md');
      return '# My Great Idea\n\nContent here with no assets.';
    };

    IndexedDBStorage.prototype.writeNote = async (id: string, content: string) => {
      targetWrittenNoteId = id;
      targetWrittenContent = content;
    };

    // Override useNoteStore deleteNode
    useNoteStore.setState({
      deleteNode: async (path: string) => {
        deletedFromSourcePath = path;
      },
    });

    try {
      const result = await moveNodeToWorkspace('Notes/MyIdea.md', 'ws_tgt', false);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.movedCount, 1);
      assert.strictEqual(result.targetWorkspaceName, 'Hedef Alan');
      assert.strictEqual(targetWrittenNoteId, 'Notes/MyIdea.md');
      assert.strictEqual(targetWrittenContent, '# My Great Idea\n\nContent here with no assets.');
      assert.strictEqual(deletedFromSourcePath, 'Notes/MyIdea.md');
    } finally {
      (storage as any).readNote = sourceReadMock;
      IndexedDBStorage.prototype.writeNote = origWriteNote;
      useNoteStore.setState({ deleteNode: deleteNodeMock });
    }
  });

  it('successfully moves an entire folder containing notes to target workspace', async () => {
    const deleteNodeMock = useNoteStore.getState().deleteNode;
    const origWriteNote = IndexedDBStorage.prototype.writeNote;
    const origReadNote = storage.readNote;
    let deletedFolder = '';
    const writtenNotes: Record<string, string> = {};

    useNoteStore.setState({
      notes: [
        { id: 'Projects/Alpha/doc1.md', path: 'Projects/Alpha/doc1.md', title: 'doc1', tags: [] },
        { id: 'Projects/Alpha/doc2.md', path: 'Projects/Alpha/doc2.md', title: 'doc2', tags: [] },
        { id: 'Other/doc3.md', path: 'Other/doc3.md', title: 'doc3', tags: [] },
      ],
      deleteNode: async (path: string) => {
        deletedFolder = path;
      },
    });

    (storage as any).readNote = async (id: string) => `# Content of ${id}`;
    IndexedDBStorage.prototype.writeNote = async (id: string, content: string) => {
      writtenNotes[id] = content;
    };

    try {
      const result = await moveNodeToWorkspace('Projects/Alpha', 'ws_tgt', true);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.movedCount, 2);
      assert.strictEqual(deletedFolder, 'Projects/Alpha');
      assert.ok(writtenNotes['Projects/Alpha/doc1.md']);
      assert.ok(writtenNotes['Projects/Alpha/doc2.md']);
      assert.strictEqual(writtenNotes['Other/doc3.md'], undefined);
    } finally {
      (storage as any).readNote = origReadNote;
      IndexedDBStorage.prototype.writeNote = origWriteNote;
      useNoteStore.setState({ deleteNode: deleteNodeMock });
    }
  });
});
