/**
 * Sync Engine Types — Canonical Data Model & Protocol Definitions
 * 
 * Provides an intermediate representation that decouples physical storage
 * (local filesystem .md files, IndexedDB records, Tauri backend) from the P2P sync engine.
 */

export interface CanonicalNote {
  /** Normalized unique note identifier (e.g. "Work/Architecture") */
  id: string;
  /** Relative file path within the vault (e.g. "Work/Architecture.md") */
  path: string;
  /** Full raw markdown content */
  content: string;
  /** Last modification timestamp in milliseconds */
  updatedAt: number;
  /** Tombstone marker indicating soft deletion */
  deleted: boolean;
  /** Timestamp when deleted in milliseconds, if applicable */
  deletedAt?: number;
  /** SHA-256 hash digest of content for fast equality checks */
  hash: string;
}

export interface NoteSummary {
  id: string;
  updatedAt: number;
  hash: string;
  deleted: boolean;
  deletedAt?: number;
}

export interface SyncManifest {
  deviceId: string;
  timestamp: number;
  notes: Record<string, NoteSummary>;
}

export type SyncState =
  | 'idle'
  | 'generating_key'
  | 'connecting_signaling'
  | 'waiting_peer'
  | 'connecting_peer'
  | 'syncing'
  | 'completed'
  | 'error';

export type SyncRole = 'host' | 'peer';

export interface SyncProgress {
  stage: 'handshake' | 'manifest' | 'transferring' | 'finalizing';
  totalNotes: number;
  transferredNotes: number;
  currentNoteTitle?: string;
  direction: 'sending' | 'receiving' | 'bidirectional';
}

export interface SyncReport {
  syncedAt: number;
  sentNotesCount: number;
  receivedNotesCount: number;
  deletedNotesCount: number;
  conflictsCount: number;
  details: string[];
}

// ── WebRTC DataChannel Protocol Messages ─────────────────────────────────────

export type P2PMessage =
  | { type: 'MANIFEST'; manifest: SyncManifest }
  | { type: 'MANIFEST_ACK' }
  | { type: 'NOTE_PAYLOAD'; note: CanonicalNote; index: number; total: number }
  | { type: 'SYNC_DONE'; sentCount: number }
  | { type: 'SYNC_ACK' }
  | { type: 'ERROR'; message: string };

// ── Signaling Protocol Messages (over ephemeral WebSocket) ───────────────────

export type SignalingMessage =
  | { type: 'ready'; role: SyncRole }
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit }
  | { type: 'bye' };

// ── Sync Metadata File Schema ────────────────────────────────────────────────

export interface VaultSyncMetadata {
  version: 1;
  deviceId: string;
  notes: Record<
    string,
    {
      updatedAt: number;
      hash: string;
    }
  >;
  tombstones: Record<
    string,
    {
      deletedAt: number;
      path: string;
    }
  >;
}
