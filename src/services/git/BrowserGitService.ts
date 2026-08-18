/**
 * BrowserGitService.ts — 100% Genuine, Standard Git Engine for Web powered by isomorphic-git.
 * 
 * Directly reads & writes standard Git repositories (.git/HEAD, .git/config, .git/objects, .git/refs)
 * on the user's hard drive using FileSystemDirectoryHandle.
 * 
 * Works seamlessly with Terminal CLI (`git status`, `git log`, `git diff`), Desktop Tauri, and Web PWA!
 */
import { Buffer } from 'buffer';
if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}
import git from 'isomorphic-git';
import { fsaGitFs } from './fsaFs';
import type { IGitService, GitStatusInfo, GitCommitInfo, GitDiffResult, GitSyncResult } from './types';
import { computeLineDiff } from './diffHelper';
import { storage } from '../storage';

export class BrowserGitService implements IGitService {
  isSupported(): boolean {
    return true;
  }

  async getStatus(): Promise<GitStatusInfo> {
    try {
      const branches = await git.listBranches({ fs: fsaGitFs, dir: '/' }).catch(() => []);
      const isInitialized = await git.resolveRef({ fs: fsaGitFs, dir: '/', ref: 'HEAD' }).then(() => true).catch(() => false) || branches.length > 0;

      if (!isInitialized) {
        // Check if .git directory exists
        const exists = await storage.vaultFileExists('.git/config').catch(() => false);
        if (!exists) {
          return {
            isInitialized: false,
            branch: 'main',
            modifiedFiles: [],
            untrackedFiles: [],
            stagedFiles: [],
            ahead: 0,
            behind: 0,
            lastCommit: null,
            remoteUrl: null,
          };
        }
      }

      const branch = await git.currentBranch({ fs: fsaGitFs, dir: '/', fullname: false }).catch(() => 'main') || 'main';
      const remoteUrl = await git.getConfig({ fs: fsaGitFs, dir: '/', path: 'remote.origin.url' }).catch(() => null);

      // Get status matrix: [filepath, headStatus, workdirStatus, stageStatus]
      const matrix = await git.statusMatrix({ fs: fsaGitFs, dir: '/' }).catch(() => []);
      const modifiedFiles: string[] = [];
      const untrackedFiles: string[] = [];
      const stagedFiles: string[] = [];

      for (const [filepath, head, workdir, stage] of matrix) {
        if (filepath.startsWith('.git')) continue;
        if (head === 0 && workdir === 2 && stage === 0) {
          untrackedFiles.push(filepath);
        } else if (workdir !== stage || head !== workdir) {
          modifiedFiles.push(filepath);
        }
      }

      // Last commit
      let lastCommit: GitCommitInfo | null = null;
      try {
        const commits = await git.log({ fs: fsaGitFs, dir: '/', depth: 1 });
        if (commits.length > 0) {
          const c = commits[0];
          lastCommit = {
            hash: c.oid,
            shortHash: c.oid.slice(0, 7),
            author: c.commit.author.name,
            email: c.commit.author.email,
            date: new Date(c.commit.author.timestamp * 1000).toISOString(),
            timestamp: c.commit.author.timestamp * 1000,
            message: c.commit.message.trim(),
          };
        }
      } catch {
        // No commits yet
      }

      return {
        isInitialized: true,
        branch,
        modifiedFiles,
        untrackedFiles,
        stagedFiles,
        ahead: 0,
        behind: 0,
        lastCommit,
        remoteUrl,
      };
    } catch (err) {
      console.warn('Failed to get git status:', err);
      return {
        isInitialized: false,
        branch: 'main',
        modifiedFiles: [],
        untrackedFiles: [],
        stagedFiles: [],
        ahead: 0,
        behind: 0,
        lastCommit: null,
        remoteUrl: null,
      };
    }
  }

  private async listAllVaultFiles(dir = ''): Promise<string[]> {
    const results: string[] = [];
    try {
      const entries = await fsaGitFs.readdir(dir || '/');
      for (const name of entries) {
        if (name === '.git') continue;
        const rel = dir ? `${dir}/${name}` : name;
        try {
          const stat = await fsaGitFs.stat(rel);
          if (stat.isDirectory()) {
            const sub = await this.listAllVaultFiles(rel);
            results.push(...sub);
          } else {
            results.push(rel);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    return results;
  }

  async init(): Promise<void> {
    await git.init({ fs: fsaGitFs, dir: '/', defaultBranch: 'main' });
    await this.createCommit('İlk yerel versiyon (Initial commit)');
  }

  async createCommit(message: string): Promise<string> {
    // 1. Stage all vault files (including .attachments, images, diagrams, markdown)
    const allFiles = await this.listAllVaultFiles();
    for (const fileRelPath of allFiles) {
      try {
        await git.add({ fs: fsaGitFs, dir: '/', filepath: fileRelPath });
      } catch (e) {
        console.warn(`Failed to stage ${fileRelPath}:`, e);
      }
    }

    // 2. Stage deleted files (remove from Git index)
    try {
      const matrix = await git.statusMatrix({ fs: fsaGitFs, dir: '/' });
      for (const [filepath, head, workdir, stage] of matrix) {
        if (filepath.startsWith('.git')) continue;
        if (workdir === 0 && (head === 1 || stage === 1)) {
          try {
            await git.remove({ fs: fsaGitFs, dir: '/', filepath });
          } catch (e) {
            console.warn(`Failed to stage removal for ${filepath}:`, e);
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Check if working tree has changes
    try {
      const matrix = await git.statusMatrix({ fs: fsaGitFs, dir: '/' });
      const hasChanges = matrix.some(([filepath, head, workdir, stage]) => {
        if (filepath.startsWith('.git')) return false;
        return head !== stage || workdir !== stage;
      });

      if (!hasChanges) {
        // No changes to commit, return current HEAD oid
        const currentHead = await git.resolveRef({ fs: fsaGitFs, dir: '/', ref: 'HEAD' }).catch(() => null);
        if (currentHead) {
          return currentHead;
        }
      }
    } catch {
      // First commit
    }

    // 4. Create genuine standard Git commit object
    const sha = await git.commit({
      fs: fsaGitFs,
      dir: '/',
      message: message.trim() || 'Not güncellemesi',
      author: {
        name: 'HAN Kullanıcısı',
        email: 'user@han-notes.local',
      },
    });

    return sha;
  }

  async getNoteHistory(filePath?: string, limit = 50): Promise<GitCommitInfo[]> {
    try {
      const commits = await git.log({ fs: fsaGitFs, dir: '/', depth: limit });
      const targetRelPath = filePath ? (filePath.endsWith('.md') ? filePath : `${filePath}.md`) : null;
      const results: GitCommitInfo[] = [];

      for (const c of commits) {
        if (targetRelPath) {
          // Check if file existed or changed in this commit
          try {
            const blob = await git.readBlob({ fs: fsaGitFs, dir: '/', oid: c.oid, filepath: targetRelPath });
            if (blob && blob.blob) {
              results.push({
                hash: c.oid,
                shortHash: c.oid.slice(0, 7),
                author: c.commit.author.name,
                email: c.commit.author.email,
                date: new Date(c.commit.author.timestamp * 1000).toISOString(),
                timestamp: c.commit.author.timestamp * 1000,
                message: c.commit.message.trim(),
              });
            }
          } catch {
            // File did not exist at this commit
          }
        } else {
          results.push({
            hash: c.oid,
            shortHash: c.oid.slice(0, 7),
            author: c.commit.author.name,
            email: c.commit.author.email,
            date: new Date(c.commit.author.timestamp * 1000).toISOString(),
            timestamp: c.commit.author.timestamp * 1000,
            message: c.commit.message.trim(),
          });
        }
      }

      return results;
    } catch (err) {
      console.warn('Failed to load git log:', err);
      return [];
    }
  }

  async getFileContentAtCommit(filePath: string, commitHash: string): Promise<string> {
    const targetRelPath = filePath.endsWith('.md') ? filePath : `${filePath}.md`;
    try {
      const { blob } = await git.readBlob({
        fs: fsaGitFs,
        dir: '/',
        oid: commitHash,
        filepath: targetRelPath,
      });
      return new TextDecoder().decode(blob);
    } catch (err) {
      console.warn(`Failed to read blob at commit ${commitHash}:`, err);
      return '';
    }
  }

  async getNoteDiff(filePath: string, commitHash?: string): Promise<GitDiffResult> {
    const noteId = filePath.replace(/\.md$/, '');
    let currentContent = '';
    try {
      currentContent = await storage.readNote(noteId);
    } catch {
      currentContent = '';
    }

    let oldContent = '';
    if (commitHash) {
      oldContent = await this.getFileContentAtCommit(filePath, commitHash);
    } else {
      // Get HEAD content
      try {
        const headSha = await git.resolveRef({ fs: fsaGitFs, dir: '/', ref: 'HEAD' });
        oldContent = await this.getFileContentAtCommit(filePath, headSha);
      } catch {
        oldContent = '';
      }
    }

    return computeLineDiff(oldContent, currentContent, filePath);
  }

  async revertNoteToCommit(filePath: string, commitHash: string): Promise<void> {
    const noteId = filePath.replace(/\.md$/, '');
    const content = await this.getFileContentAtCommit(filePath, commitHash);
    if (content !== undefined && content !== null) {
      await storage.writeNote(noteId, content);
      await this.createCommit(`Geri yüklendi (${commitHash.slice(0, 7)}): ${noteId}`);
    }
  }

  async getRemoteUrl(): Promise<string | null> {
    try {
      return await git.getConfig({ fs: fsaGitFs, dir: '/', path: 'remote.origin.url' });
    } catch {
      return null;
    }
  }

  async setRemoteUrl(url: string): Promise<void> {
    try {
      await git.setConfig({ fs: fsaGitFs, dir: '/', path: 'remote.origin.url', value: url });
    } catch (err) {
      console.warn('Failed to set remote url in git config:', err);
    }
  }

  async pull(): Promise<GitSyncResult> {
    return { success: true, message: 'Yerel modda güncel.' };
  }

  async push(): Promise<GitSyncResult> {
    return { success: true, message: 'Yerel modda kaydedildi.' };
  }

  async sync(commitMessage = 'Auto-sync'): Promise<GitSyncResult> {
    await this.createCommit(commitMessage);
    return { success: true, message: 'Yerel snapshot alındı.' };
  }
}
