/**
 * fileOps.ts — Low-level File System Access API operations and file tree builder.
 */
import type { FileNode } from '../types';
import { toNoteFilePath, normalizeNoteId } from '@/utils/pathUtils';

// In-memory text cache to prevent duplicate disk reads across multiple store operations
const fileTextCache = new Map<string, string>();

export function clearFileTextCache(path?: string): void {
  if (path) {
    fileTextCache.delete(path);
    fileTextCache.delete(toNoteFilePath(path));
    fileTextCache.delete(normalizeNoteId(path));
  } else {
    fileTextCache.clear();
  }
}

export function setFileTextCache(path: string, content: string): void {
  fileTextCache.set(path, content);
}

export async function getOrCreateFile(
  dir: FileSystemDirectoryHandle,
  path: string,
  create = false
): Promise<FileSystemFileHandle | null> {
  const parts = path.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return null;

  let current = dir;
  for (const part of parts) {
    try {
      current = await current.getDirectoryHandle(part, { create });
    } catch {
      return null;
    }
  }

  try {
    return await current.getFileHandle(fileName, { create });
  } catch {
    return null;
  }
}

export async function listAllMdFiles(
  dir: FileSystemDirectoryHandle,
  prefix = ''
): Promise<Array<{ name: string; relativePath: string }>> {
  const results: Array<{ name: string; relativePath: string }> = [];

  for await (const entry of (dir as any).values()) {
    if (entry.name.startsWith('.')) continue;

    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      const sub = await listAllMdFiles(entry as FileSystemDirectoryHandle, entryPath);
      results.push(...sub);
    } else if (entry.kind === 'file' && entry.name.endsWith('.md')) {
      results.push({ name: entry.name, relativePath: entryPath });
    }
  }

  return results;
}

export async function readFileText(
  dir: FileSystemDirectoryHandle,
  path: string
): Promise<string> {
  const cached = fileTextCache.get(path);
  if (cached !== undefined) {
    return cached;
  }
  const handle = await getOrCreateFile(dir, path);
  if (!handle) return '';
  const file = await handle.getFile();
  const text = await file.text();
  fileTextCache.set(path, text);
  return text;
}

export async function writeFileText(
  dir: FileSystemDirectoryHandle,
  path: string,
  content: string
): Promise<void> {
  const handle = await getOrCreateFile(dir, path, true);
  if (!handle) throw new Error(`Cannot create file: ${path}`);
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  fileTextCache.set(path, content);
}

export async function buildFileTree(
  dir: FileSystemDirectoryHandle,
  prefix = ''
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];

  for await (const entry of (dir as any).values()) {
    if (entry.name.startsWith('.')) continue;

    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      const children = await buildFileTree(entry as FileSystemDirectoryHandle, entryPath);
      nodes.push({
        name: entry.name,
        relative_path: entryPath,
        is_dir: true,
        children,
      });
    } else if (entry.kind === 'file' && entry.name.endsWith('.md')) {
      const displayName = entry.name.replace(/\.md$/, '');
      nodes.push({
        name: displayName,
        relative_path: entryPath,
        is_dir: false,
        children: [],
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
    return a.is_dir ? -1 : 1;
  });

  return nodes;
}

export async function copyDirRecursive(
  srcDir: FileSystemDirectoryHandle,
  destDir: FileSystemDirectoryHandle
): Promise<void> {
  for await (const entry of (srcDir as any).values()) {
    if (entry.kind === 'file') {
      const srcFile = await (entry as FileSystemFileHandle).getFile();
      const destFileHandle = await destDir.getFileHandle(entry.name, { create: true });
      const writable = await destFileHandle.createWritable();
      await writable.write(await srcFile.arrayBuffer());
      await writable.close();
    } else if (entry.kind === 'directory') {
      const subDestDir = await destDir.getDirectoryHandle(entry.name, { create: true });
      await copyDirRecursive(entry as FileSystemDirectoryHandle, subDestDir);
    }
  }
}

export async function deleteFileByPath(
  dir: FileSystemDirectoryHandle,
  path: string
): Promise<void> {
  clearFileTextCache(path);

  const parts = path.split('/').filter(Boolean);
  const targetName = parts.pop();
  if (!targetName) return;

  let current = dir;
  for (const part of parts) {
    try {
      current = await current.getDirectoryHandle(part);
    } catch {
      return;
    }
  }

  try {
    await current.removeEntry(targetName, { recursive: true });
  } catch {
    // Entry might not exist
  }
}
