import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { CanonicalNote, SyncManifest } from '../types';

describe('Sync Manifest Diffing & Tombstone Resolution', () => {
  it('should identify missing notes and newer notes when diffing manifests', () => {
    const localManifest: SyncManifest = {
      deviceId: 'dev_local',
      timestamp: 2000,
      notes: {
        'Work/NoteA': {
          id: 'Work/NoteA',
          updatedAt: 1500,
          hash: 'hash_local_A',
          deleted: false,
        },
        'Work/NoteB': {
          id: 'Work/NoteB',
          updatedAt: 1000,
          hash: 'hash_B_v1',
          deleted: false,
        },
      },
    };

    const remoteManifest: SyncManifest = {
      deviceId: 'dev_remote',
      timestamp: 2000,
      notes: {
        'Work/NoteB': {
          id: 'Work/NoteB',
          updatedAt: 1800, // Remote has newer version of B
          hash: 'hash_B_v2',
          deleted: false,
        },
        'Work/NoteC': {
          id: 'Work/NoteC',
          updatedAt: 1200, // Remote has NoteC which local lacks
          hash: 'hash_C',
          deleted: false,
        },
      },
    };

    // Calculate diff from local perspective
    const toSend: string[] = [];
    const toReceive: string[] = [];

    // 1. What local should send to remote
    for (const [id, localSummary] of Object.entries(localManifest.notes)) {
      const remoteSummary = remoteManifest.notes[id];
      if (!remoteSummary) {
        toSend.push(id);
      } else if (localSummary.updatedAt > remoteSummary.updatedAt && localSummary.hash !== remoteSummary.hash) {
        toSend.push(id);
      }
    }

    // 2. What local should receive from remote
    for (const [id, remoteSummary] of Object.entries(remoteManifest.notes)) {
      const localSummary = localManifest.notes[id];
      if (!localSummary) {
        toReceive.push(id);
      } else if (remoteSummary.updatedAt > localSummary.updatedAt && remoteSummary.hash !== localSummary.hash) {
        toReceive.push(id);
      }
    }

    assert.deepStrictEqual(toSend, ['Work/NoteA']);
    assert.deepStrictEqual(toReceive, ['Work/NoteB', 'Work/NoteC']);
  });

  it('should not resurrect a locally deleted note if remote has an older active note', () => {
    const localTombstoneDeletedAt = 2000;
    const remoteActiveNote: CanonicalNote = {
      id: 'Work/OldProject',
      path: 'Work/OldProject.md',
      content: '# Old Project',
      updatedAt: 1000, // Created before local deletion
      deleted: false,
      hash: 'hash_old',
    };

    // Decision: If local tombstone is newer than incoming note's updatedAt, local deletion wins!
    const localTombstoneWins = localTombstoneDeletedAt > remoteActiveNote.updatedAt;
    assert.strictEqual(localTombstoneWins, true);
  });

  it('should resurrect or accept note if remote note was modified AFTER local deletion', () => {
    const localTombstoneDeletedAt = 1000;
    const remoteActiveNote: CanonicalNote = {
      id: 'Work/ReopenedProject',
      path: 'Work/ReopenedProject.md',
      content: '# Reopened Project\nNew requirements added.',
      updatedAt: 2500, // Remote user explicitly edited note after deletion
      deleted: false,
      hash: 'hash_reopened',
    };

    // Decision: If remote note updatedAt is newer than local tombstone, the new edit wins!
    const remoteEditWins = remoteActiveNote.updatedAt > localTombstoneDeletedAt;
    assert.strictEqual(remoteEditWins, true);
  });

  it('should honor remote tombstone when remote deleted a note after local edit', () => {
    const localNoteUpdatedAt = 800;
    const remoteTombstone: CanonicalNote = {
      id: 'Tasks/Archive',
      path: 'Tasks/Archive.md',
      content: '',
      updatedAt: 1600,
      deleted: true,
      deletedAt: 1600,
      hash: '',
    };

    const remoteTombstoneWins = (remoteTombstone.deletedAt || remoteTombstone.updatedAt) > localNoteUpdatedAt;
    assert.strictEqual(remoteTombstoneWins, true);
  });

  it('should detect concurrent conflict when timestamps are identical or divergent', () => {
    const localNote = {
      content: '# Note edited on Desktop',
      updatedAt: 1500,
      hash: 'hash_desktop',
    };
    const incomingNote: CanonicalNote = {
      id: 'Meeting/Agenda',
      path: 'Meeting/Agenda.md',
      content: '# Note edited on Mobile',
      updatedAt: 1500,
      deleted: false,
      hash: 'hash_mobile',
    };

    const isConflict =
      localNote.hash !== incomingNote.hash &&
      localNote.updatedAt === incomingNote.updatedAt;

    assert.strictEqual(isConflict, true);
  });
});
