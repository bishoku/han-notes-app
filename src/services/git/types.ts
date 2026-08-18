/**
 * types.ts — Core TypeScript definitions for HAN Notes Git Versioning & Sync.
 */

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
  message: string;
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';
}

export interface GitStatusInfo {
  isInitialized: boolean;
  branch: string;
  modifiedFiles: string[];
  untrackedFiles: string[];
  stagedFiles: string[];
  ahead: number;
  behind: number;
  lastCommit?: GitCommitInfo | null;
  remoteUrl?: string | null;
}

export interface GitDiffLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface GitDiffResult {
  filePath: string;
  oldContent: string;
  newContent: string;
  lines: GitDiffLine[];
  additions: number;
  deletions: number;
}

export interface GitSyncSettings {
  enabled: boolean;
  mode: 'local' | 'bitbucket' | 'github' | 'custom';
  remoteUrl: string;
  branch: string;
  authorName: string;
  authorEmail: string;
  autoCommit: boolean;
  autoCommitIntervalMinutes: number; // e.g. 3, 5, 10
  autoSync: boolean;
  autoSyncIntervalMinutes: number; // e.g. 5, 15, 30
  githubPat?: string;
}

export interface GitSyncResult {
  success: boolean;
  message: string;
  updatedFiles?: string[];
  conflict?: boolean;
}

export interface IGitService {
  isSupported(): boolean;
  getStatus(): Promise<GitStatusInfo>;
  init(): Promise<void>;
  createCommit(message: string): Promise<string>;
  getNoteHistory(filePath?: string, limit?: number): Promise<GitCommitInfo[]>;
  getNoteDiff(filePath: string, commitHash?: string): Promise<GitDiffResult>;
  getFileContentAtCommit(filePath: string, commitHash: string): Promise<string>;
  revertNoteToCommit(filePath: string, commitHash: string): Promise<void>;
  getRemoteUrl(): Promise<string | null>;
  setRemoteUrl(url: string): Promise<void>;
  pull(): Promise<GitSyncResult>;
  push(): Promise<GitSyncResult>;
  sync(commitMessage?: string): Promise<GitSyncResult>;
}
