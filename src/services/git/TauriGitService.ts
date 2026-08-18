/**
 * TauriGitService.ts — Desktop Git implementation using native Git CLI via Rust backend.
 * Full support for on-prem Bitbucket (SSH/HTTPS), GitHub, GitLab and local versioning.
 */
import { invoke } from '@tauri-apps/api/core';
import type { IGitService, GitStatusInfo, GitCommitInfo, GitDiffResult, GitSyncResult } from './types';
import { computeLineDiff } from './diffHelper';

export class TauriGitService implements IGitService {
  isSupported(): boolean {
    return true;
  }

  async getStatus(): Promise<GitStatusInfo> {
    return invoke<GitStatusInfo>('git_status');
  }

  async init(): Promise<void> {
    await invoke('git_init');
  }

  async createCommit(message: string): Promise<string> {
    return invoke<string>('git_commit', { message });
  }

  async getNoteHistory(filePath?: string, limit = 50): Promise<GitCommitInfo[]> {
    return invoke<GitCommitInfo[]>('git_log', { filePath, limit });
  }

  async getFileContentAtCommit(filePath: string, commitHash: string): Promise<string> {
    return invoke<string>('git_show', { filePath, commitHash });
  }

  async getNoteDiff(filePath: string, commitHash?: string): Promise<GitDiffResult> {
    // 1. If commitHash is provided, get old content at commit and current content from disk
    if (commitHash) {
      const oldContent = await this.getFileContentAtCommit(filePath, commitHash);
      const currentContent = await invoke<string>('read_note', { id: filePath });
      return computeLineDiff(oldContent, currentContent, filePath);
    }

    // 2. Uncommitted diff against HEAD
    const currentContent = await invoke<string>('read_note', { id: filePath });
    // In case of uncommitted diff, get HEAD content
    try {
      const headContent = await this.getFileContentAtCommit(filePath, 'HEAD');
      return computeLineDiff(headContent, currentContent, filePath);
    } catch {
      return computeLineDiff('', currentContent, filePath);
    }
  }

  async revertNoteToCommit(filePath: string, commitHash: string): Promise<void> {
    await invoke('git_revert_file', { filePath, commitHash });
  }

  async getRemoteUrl(): Promise<string | null> {
    return invoke<string | null>('git_remote_get');
  }

  async setRemoteUrl(url: string): Promise<void> {
    await invoke('git_remote_set', { url });
  }

  async pull(): Promise<GitSyncResult> {
    return invoke<GitSyncResult>('git_pull');
  }

  async push(): Promise<GitSyncResult> {
    return invoke<GitSyncResult>('git_push');
  }

  async sync(commitMessage = 'Auto-sync notes'): Promise<GitSyncResult> {
    // 1. Commit local changes first
    try {
      const status = await this.getStatus();
      if (status.modifiedFiles.length > 0 || status.untrackedFiles.length > 0) {
        await this.createCommit(commitMessage);
      }
    } catch (e: any) {
      console.warn('Auto-commit before sync skipped:', e?.message || e);
    }

    // 2. Pull remote changes with rebase
    const pullResult = await this.pull();
    if (!pullResult.success && pullResult.conflict) {
      return pullResult;
    }

    // 3. Push to remote
    const pushResult = await this.push();
    return {
      success: pushResult.success,
      message: pushResult.success ? 'Senkronizasyon tamamlandı.' : pushResult.message,
      updatedFiles: pullResult.updatedFiles,
    };
  }
}
