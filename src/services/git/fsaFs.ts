import { Buffer } from 'buffer';
if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}
import { storage } from '../storage';

export interface FsStat {
  type: 'file' | 'dir';
  mode: number;
  size: number;
  ino: number;
  mtimeMs: number;
  ctimeMs: number;
  uid: number;
  gid: number;
  dev: number;
  isFile: () => boolean;
  isDirectory: () => boolean;
  isSymbolicLink: () => boolean;
}

function normalizePath(p?: string): string[] {
  if (!p) return [];
  return p.replace(/\\/g, '/').split('/').filter(Boolean);
}

export class FsaGitFs {
  private getRoot(): FileSystemDirectoryHandle {
    const s = storage as any;
    if (s && s.getDir) {
      return s.getDir();
    }
    if (s && s.dirHandle) {
      return s.dirHandle;
    }
    throw new Error('Vault directory handle not initialized.');
  }

  private async getDirectory(parts: string[], create = false): Promise<FileSystemDirectoryHandle | null> {
    let current = this.getRoot();
    for (const part of parts) {
      try {
        current = await current.getDirectoryHandle(part, { create });
      } catch {
        return null;
      }
    }
    return current;
  }

  private async getFile(path: string, create = false): Promise<FileSystemFileHandle | null> {
    const parts = normalizePath(path);
    const fileName = parts.pop();
    if (!fileName) return null;

    const dir = await this.getDirectory(parts, create);
    if (!dir) return null;

    try {
      return await dir.getFileHandle(fileName, { create });
    } catch {
      return null;
    }
  }

  // ── isomorphic-git required methods directly on fs ──

  async readFile(path: string, options?: { encoding?: string } | string): Promise<Uint8Array | string> {
    const handle = await this.getFile(path);
    if (!handle) {
      const err: any = new Error(`ENOENT: no such file or directory, open '${path}'`);
      err.code = 'ENOENT';
      throw err;
    }
    const file = await handle.getFile();
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const enc = typeof options === 'string' ? options : options?.encoding;
    if (enc === 'utf8' || enc === 'utf-8') {
      return new TextDecoder().decode(bytes);
    }
    return bytes;
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    const handle = await this.getFile(path, true);
    if (!handle) {
      throw new Error(`ENOENT: cannot create file '${path}'`);
    }
    const writable = await handle.createWritable();
    if (typeof data === 'string') {
      await writable.write(data);
    } else {
      await writable.write(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    }
    await writable.close();
  }

  async unlink(path: string): Promise<void> {
    const parts = normalizePath(path);
    const fileName = parts.pop();
    if (!fileName) return;

    const dir = await this.getDirectory(parts, false);
    if (dir) {
      try {
        await dir.removeEntry(fileName);
      } catch {
        // ignore
      }
    }
  }

  async readdir(path: string): Promise<string[]> {
    const parts = normalizePath(path);
    const dir = await this.getDirectory(parts, false);
    if (!dir) {
      const err: any = new Error(`ENOENT: no such directory, scandir '${path}'`);
      err.code = 'ENOENT';
      throw err;
    }

    const results: string[] = [];
    for await (const entry of (dir as any).values()) {
      results.push(entry.name);
    }
    return results;
  }

  async mkdir(path: string): Promise<void> {
    const parts = normalizePath(path);
    await this.getDirectory(parts, true);
  }

  async rmdir(path: string): Promise<void> {
    const parts = normalizePath(path);
    const dirName = parts.pop();
    if (!dirName) return;

    const parent = await this.getDirectory(parts, false);
    if (parent) {
      try {
        await parent.removeEntry(dirName, { recursive: true });
      } catch {
        // ignore
      }
    }
  }

  async stat(path: string): Promise<FsStat> {
    const parts = normalizePath(path);
    if (parts.length === 0) {
      // Root directory
      return {
        type: 'dir',
        mode: 0o777,
        size: 0,
        ino: 0,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
        uid: 1,
        gid: 1,
        dev: 1,
        isFile: () => false,
        isDirectory: () => true,
        isSymbolicLink: () => false,
      };
    }

    // Check if it's a directory
    const dir = await this.getDirectory(parts, false);
    if (dir) {
      return {
        type: 'dir',
        mode: 0o777,
        size: 0,
        ino: 0,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
        uid: 1,
        gid: 1,
        dev: 1,
        isFile: () => false,
        isDirectory: () => true,
        isSymbolicLink: () => false,
      };
    }

    // Check if it's a file
    const handle = await this.getFile(path, false);
    if (handle) {
      const file = await handle.getFile();
      return {
        type: 'file',
        mode: 0o666,
        size: file.size,
        ino: 0,
        mtimeMs: file.lastModified || Date.now(),
        ctimeMs: file.lastModified || Date.now(),
        uid: 1,
        gid: 1,
        dev: 1,
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
      };
    }

    const err: any = new Error(`ENOENT: no such file or directory, stat '${path}'`);
    err.code = 'ENOENT';
    throw err;
  }

  async lstat(path: string): Promise<FsStat> {
    return this.stat(path);
  }

  async readlink(path: string): Promise<string> {
    const err: any = new Error(`EINVAL: not a symlink, readlink '${path}'`);
    err.code = 'EINVAL';
    throw err;
  }

  async symlink(_target: string, _path: string): Promise<void> {
    const err: any = new Error('ENOSYS: symlinks not supported');
    err.code = 'ENOSYS';
    throw err;
  }
}

export const fsaGitFs = new FsaGitFs();
