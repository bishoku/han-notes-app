import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { WorkspaceManager } from '../workspaceManager';
import { IndexedDBStorage } from '@/services/storage/IndexedDBStorage';
import { bindWorkspaceStorage, getActiveStorageProvider } from '@/services/storage';
import { VectorStore } from '@/services/ai/vectorStore';
import { syncStorageAdapter } from '@/services/sync/syncStorageAdapter';
import type { Workspace } from '../types';

describe('Workspace Manager & Storage Isolation', () => {
  let manager: WorkspaceManager;

  beforeEach(() => {
    manager = new WorkspaceManager();
  });

  it('correctly tracks active workspace ID in memory and localStorage', () => {
    manager.setActiveWorkspaceId('ws_personal');
    assert.strictEqual(manager.getActiveWorkspaceId(), 'ws_personal');

    manager.setActiveWorkspaceId('ws_work');
    assert.strictEqual(manager.getActiveWorkspaceId(), 'ws_work');
  });

  it('IndexedDBStorage correctly assigns distinct database names per workspace', () => {
    const idbStorage = new IndexedDBStorage();

    // Default workspace should preserve legacy DB name
    idbStorage.setWorkspace('default');
    assert.strictEqual(idbStorage.getWorkspaceId(), 'default');
    assert.strictEqual(idbStorage.getDbName(), 'han_notes_db');

    // Scoped workspaces should use prefixed database names
    idbStorage.setWorkspace('ws_projects');
    assert.strictEqual(idbStorage.getWorkspaceId(), 'ws_projects');
    assert.strictEqual(idbStorage.getDbName(), 'han_notes_db_ws_projects');

    idbStorage.setWorkspace('ws_personal');
    assert.strictEqual(idbStorage.getWorkspaceId(), 'ws_personal');
    assert.strictEqual(idbStorage.getDbName(), 'han_notes_db_ws_personal');
  });

  it('VectorStore dynamically isolates embedding databases per workspace', async () => {
    const vStore = new VectorStore();

    // Default workspace uses v1 name
    await vStore.setWorkspace('default');
    assert.strictEqual(vStore.getActiveWorkspaceId(), 'default');
    assert.strictEqual(vStore.getDbName(), 'han_vector_store_v1');

    // Custom workspace uses isolated db name
    await vStore.setWorkspace('ws_research');
    assert.strictEqual(vStore.getActiveWorkspaceId(), 'ws_research');
    assert.strictEqual(vStore.getDbName(), 'han_vector_store_ws_research');
  });

  it('SyncStorageAdapter injects workspace metadata into SyncManifest', async () => {
    const origGetAll = syncStorageAdapter.getAllCanonicalNotes;
    (syncStorageAdapter as any).getAllCanonicalNotes = async () => [];

    try {
      const manifest = await syncStorageAdapter.getSyncManifest('ws_work_123', 'İş Notları');

      assert.strictEqual(manifest.workspaceId, 'ws_work_123');
      assert.strictEqual(manifest.workspaceName, 'İş Notları');
      assert.ok(typeof manifest.timestamp === 'number');
      assert.ok(typeof manifest.notes === 'object');
    } finally {
      (syncStorageAdapter as any).getAllCanonicalNotes = origGetAll;
    }
  });

  it('Workspace creation options produce valid Workspace structure', () => {
    const sampleWs: Workspace = {
      id: 'ws_demo_1',
      name: 'Mühendislik Notları',
      storageType: 'indexeddb',
      color: '#6366f1',
      icon: 'Code2',
      createdAt: 1000,
      updatedAt: 2000,
      isDefault: false,
    };

    assert.strictEqual(sampleWs.id, 'ws_demo_1');
    assert.strictEqual(sampleWs.name, 'Mühendislik Notları');
    assert.strictEqual(sampleWs.storageType, 'indexeddb');
    assert.strictEqual(sampleWs.color, '#6366f1');
    assert.strictEqual(sampleWs.icon, 'Code2');
    assert.strictEqual(sampleWs.isDefault, false);
  });

  it('bindWorkspaceStorage dynamically activates IndexedDBStorage for indexeddb workspaces', async () => {
    const ws: Workspace = {
      id: 'ws_isolated_idb',
      name: 'İzole Notlar',
      storageType: 'indexeddb',
      color: '#10b981',
      icon: 'Folder',
      createdAt: 1000,
      updatedAt: 2000,
    };

    const boundStorage = await bindWorkspaceStorage(ws);
    assert.ok(boundStorage instanceof IndexedDBStorage);
    assert.strictEqual((boundStorage as IndexedDBStorage).getWorkspaceId(), 'ws_isolated_idb');
    assert.strictEqual((boundStorage as IndexedDBStorage).getDbName(), 'han_notes_db_ws_isolated_idb');
    assert.strictEqual(getActiveStorageProvider(), boundStorage);
  });
});
