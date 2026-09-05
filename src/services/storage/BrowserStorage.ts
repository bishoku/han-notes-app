/**
 * BrowserStorage — Web / PWA storage provider powered by Rust WASM (han-core).
 * 
 * Uses the File System Access API (showDirectoryPicker) to read/write
 * actual .md files on the user's local disk.
 * 
 * Markdown parsing (tasks, decisions, backlinks, YAML frontmatter)
 * is executed by compiled WebAssembly from the shared `han-core` crate.
 */
import type {
  IStorageService,
  FileNode,
  NoteInfo,
  TagCount,
  BacklinkInfo,
  TaskInfo,
  TaskRegistry,
  DecisionInfo,
  DecisionRegistry,
} from './types';
import { toNoteFilePath } from '@/utils/pathUtils';
import initWasm, {
  wasm_parse_yaml_frontmatter,
  wasm_inject_yaml_frontmatter,
} from '@/wasm/han-core/han_core';
import wasmUrl from '@/wasm/han-core/han_core_bg.wasm?url';

import { saveHandle, loadHandle, clearHandle } from './browser/handleDb';
import {
  clearFileTextCache,
  readFileText,
  writeFileText,
  buildFileTree,
  getOrCreateFile,
  copyDirRecursive,
  deleteFileByPath,
} from './browser/fileOps';
import {
  getAssetUrl,
  getAssetBytes,
  clearImageCache,
  saveImageBytes,
  saveTextAsset,
  readTextAsset,
} from './browser/assetManager';
import {
  getVaultFilesBatched,
  getGlobalTasksBatched,
  getGlobalDecisionsBatched,
  getBacklinksBatched,
  invalidateNoteMetaCache,
} from './browser/vaultIndexer';

// Re-export cache invalidators for consumers
export { clearFileTextCache, clearImageCache };

// ─── WebAssembly Initialization ──────────────────────────────────────────

let wasmPromise: Promise<any> | null = null;

async function ensureWasmLoaded(): Promise<void> {
  if (!wasmPromise) {
    wasmPromise = initWasm({ module_or_path: wasmUrl });
  }
  await wasmPromise;
}

// ─── BrowserStorage Implementation ──────────────────────────────────────

export class BrowserStorage implements IStorageService {
  private dirHandle: FileSystemDirectoryHandle | null = null;

  async getSavedHandleName(): Promise<string | null> {
    try {
      const saved = await loadHandle();
      return saved ? saved.name : null;
    } catch {
      return null;
    }
  }

  async init(): Promise<void> {
    await ensureWasmLoaded();
    const saved = await loadHandle();
    if (saved) {
      try {
        const perm = await (saved as any).queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          this.dirHandle = saved;
          return;
        }
      } catch (err) {
        console.warn('[BrowserStorage] queryPermission check failed:', err);
      }
    }
    throw new Error('No saved directory handle or permission not granted.');
  }

  async requestPermissionForSaved(): Promise<boolean> {
    await ensureWasmLoaded();
    const saved = await loadHandle();
    if (!saved) return false;
    try {
      const perm = await (saved as any).requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        this.dirHandle = saved;
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[BrowserStorage] requestPermission failed:', err);
      return false;
    }
  }

  async clearSavedHandle(): Promise<void> {
    this.dirHandle = null;
    await clearHandle();
  }

  async pickDirectory(): Promise<FileSystemDirectoryHandle> {
    await ensureWasmLoaded();
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    if (handle) {
      this.dirHandle = handle;
      await saveHandle(handle);
      clearFileTextCache();
      clearImageCache();
      invalidateNoteMetaCache();
    }
    return handle;
  }

  private activeWorkspaceId: string = 'default';

  /**
   * Switches the active directory handle for a specific workspace.
   */
  async setWorkspace(workspaceId: string, handle: FileSystemDirectoryHandle): Promise<void> {
    await ensureWasmLoaded();
    this.activeWorkspaceId = workspaceId;
    this.dirHandle = handle;
    clearFileTextCache();
    clearImageCache();
    invalidateNoteMetaCache();
  }

  getActiveWorkspaceId(): string {
    return this.activeWorkspaceId;
  }

  getDirectoryHandle(): FileSystemDirectoryHandle | null {
    return this.dirHandle;
  }

  private getDir(): FileSystemDirectoryHandle {
    if (!this.dirHandle) {
      throw new Error('Vault directory not initialized. Call init() first.');
    }
    return this.dirHandle;
  }

  // ── Vault / File Tree ──

  async getVaultFiles(): Promise<NoteInfo[]> {
    await ensureWasmLoaded();
    return getVaultFilesBatched(this.getDir());
  }

  async getVaultTree(): Promise<FileNode[]> {
    return buildFileTree(this.getDir());
  }

  async getVaultPath(): Promise<string> {
    return this.dirHandle?.name ? `/${this.dirHandle.name}` : 'Local Vault';
  }

  async selectVaultFolder(): Promise<string | null> {
    await this.pickDirectory();
    clearFileTextCache();
    clearImageCache();
    invalidateNoteMetaCache();
    return this.dirHandle?.name ? `/${this.dirHandle.name}` : null;
  }

  async getVaultTags(): Promise<TagCount[]> {
    const notes = await this.getVaultFiles();
    const counts = new Map<string, number>();

    for (const note of notes) {
      for (const tag of note.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  // ── Note CRUD ──

  async readNote(id: string): Promise<string> {
    const path = toNoteFilePath(id);
    return readFileText(this.getDir(), path);
  }

  async writeNote(id: string, content: string): Promise<void> {
    const path = toNoteFilePath(id);
    await writeFileText(this.getDir(), path, content);
    invalidateNoteMetaCache(path);
  }

  async createNoteInFolder(parentPath: string, title: string): Promise<void> {
    const fileName = title.endsWith('.md') ? title : `${title}.md`;
    const path = parentPath ? `${parentPath}/${fileName}` : fileName;
    const noteTitle = title.replace(/\.md$/, '');
    await writeFileText(this.getDir(), path, `# ${noteTitle}\n`);
    invalidateNoteMetaCache(path);
  }

  async createFolder(parentPath: string, folderName: string): Promise<void> {
    const dir = this.getDir();
    let current = dir;
    if (parentPath) {
      for (const part of parentPath.split('/').filter(Boolean)) {
        current = await current.getDirectoryHandle(part, { create: true });
      }
    }
    await current.getDirectoryHandle(folderName, { create: true });
  }

  async moveNode(srcRelPath: string, destDirRelPath: string): Promise<void> {
    const dir = this.getDir();
    const fileName = srcRelPath.split('/').pop() ?? srcRelPath;
    const destPath = destDirRelPath ? `${destDirRelPath}/${fileName}` : fileName;

    if (srcRelPath === destPath) return;

    if (destDirRelPath === srcRelPath || destDirRelPath.startsWith(`${srcRelPath}/`)) {
      console.warn(`Cannot move folder "${srcRelPath}" into its own subfolder "${destDirRelPath}"`);
      return;
    }

    const srcFile = await getOrCreateFile(dir, srcRelPath, false);
    if (srcFile) {
      const content = await readFileText(dir, srcRelPath);
      await writeFileText(dir, destPath, content);
      await deleteFileByPath(dir, srcRelPath);
    } else {
      const srcParts = srcRelPath.split('/').filter(Boolean);
      let currentSrc = dir;
      for (const part of srcParts) {
        currentSrc = await currentSrc.getDirectoryHandle(part);
      }

      const destParts = destPath.split('/').filter(Boolean);
      let currentDest = dir;
      for (const part of destParts) {
        currentDest = await currentDest.getDirectoryHandle(part, { create: true });
      }

      await copyDirRecursive(currentSrc, currentDest);
      await deleteFileByPath(dir, srcRelPath);
    }

    invalidateNoteMetaCache(srcRelPath);
    invalidateNoteMetaCache(destPath);
  }

  async deleteNode(relativePath: string): Promise<void> {
    await deleteFileByPath(this.getDir(), relativePath);
    invalidateNoteMetaCache(relativePath);
  }

  async renameNode(relativePath: string, newName: string): Promise<void> {
    const dir = this.getDir();
    const srcFile = await getOrCreateFile(dir, relativePath, false);

    if (srcFile) {
      const content = await readFileText(dir, relativePath);
      const parts = relativePath.split('/').filter(Boolean);
      parts.pop();
      const finalName = newName.endsWith('.md') ? newName : `${newName}.md`;
      const newPath = parts.length > 0 ? `${parts.join('/')}/${finalName}` : finalName;

      if (relativePath === newPath) return;

      await writeFileText(dir, newPath, content);
      await deleteFileByPath(dir, relativePath);
      invalidateNoteMetaCache(relativePath);
      invalidateNoteMetaCache(newPath);
    } else {
      const cleanNewName = newName.replace(/\.md$/, '').trim();
      const srcParts = relativePath.split('/').filter(Boolean);
      srcParts.pop();
      const newPath = srcParts.length > 0 ? `${srcParts.join('/')}/${cleanNewName}` : cleanNewName;

      if (relativePath === newPath) return;

      let currentSrc = dir;
      for (const part of relativePath.split('/').filter(Boolean)) {
        currentSrc = await currentSrc.getDirectoryHandle(part);
      }

      let currentDest = dir;
      for (const part of newPath.split('/').filter(Boolean)) {
        currentDest = await currentDest.getDirectoryHandle(part, { create: true });
      }

      await copyDirRecursive(currentSrc, currentDest);
      await deleteFileByPath(dir, relativePath);
      invalidateNoteMetaCache();
    }
  }

  async updateNoteTags(id: string, tags: string[]): Promise<void> {
    await ensureWasmLoaded();
    const content = await this.readNote(id);
    const parsed = wasm_parse_yaml_frontmatter(content);
    const body: string = parsed?.[1] ?? content;
    const newContent = wasm_inject_yaml_frontmatter(JSON.stringify({ tags }), body);
    await this.writeNote(id, newContent);
  }

  // ── Tasks ──

  async getGlobalTasks(): Promise<TaskInfo[]> {
    await ensureWasmLoaded();
    return getGlobalTasksBatched(this.getDir());
  }

  async getTaskRegistry(): Promise<TaskRegistry> {
    const tasks = await this.getGlobalTasks();
    const assigneesSet = new Set<string>();
    const tagsSet = new Set<string>();

    for (const t of tasks) {
      for (const a of t.assignees) assigneesSet.add(a.trim());
      if (t.assignee) assigneesSet.add(t.assignee.trim());
      for (const tag of t.tags) tagsSet.add(tag.trim());
    }

    return {
      assignees: Array.from(assigneesSet).sort(),
      tags: Array.from(tagsSet).sort(),
    };
  }

  async toggleTask(noteId: string, lineNumber: number, completed: boolean): Promise<void> {
    const content = await this.readNote(noteId);
    const lines = content.split('\n');

    if (lineNumber < lines.length) {
      lines[lineNumber] = completed
        ? lines[lineNumber].replace('[ ]', '[x]')
        : lines[lineNumber].replace('[x]', '[ ]').replace('[X]', '[ ]');
      await this.writeNote(noteId, lines.join('\n'));
    }
  }

  async updateTaskMetadata(
    noteId: string,
    lineNumber: number,
    content: string,
    completed: boolean,
    description: string | null,
    startDate: string | null,
    endDate: string | null,
    priority: string | null,
    assignee: string | null,
    assignees: string[],
    progress: number | null,
    tags: string[],
  ): Promise<void> {
    const fileContent = await this.readNote(noteId);
    const lines = fileContent.split('\n');

    if (lineNumber < lines.length) {
      const indent = lines[lineNumber].match(/^(\s*)/)?.[1] ?? '';
      const checkChar = completed ? 'x' : ' ';

      const meta: Record<string, any> = {};
      if (description) meta.description = description;
      if (startDate) meta.start_date = startDate;
      if (endDate) meta.end_date = endDate;
      if (priority) meta.priority = priority;
      if (assignee) meta.assignee = assignee;
      if (assignees.length > 0) meta.assignees = assignees;
      if (progress !== null && progress !== undefined) meta.progress = progress;
      if (tags.length > 0) meta.tags = tags;

      const hasMeta = Object.keys(meta).length > 0;
      lines[lineNumber] = hasMeta
        ? `${indent}- [${checkChar}] ${content} <!-- task:${JSON.stringify(meta)} -->`
        : `${indent}- [${checkChar}] ${content}`;

      await this.writeNote(noteId, lines.join('\n'));
    }
  }

  // ── Decisions ──

  async getGlobalDecisions(): Promise<DecisionInfo[]> {
    await ensureWasmLoaded();
    return getGlobalDecisionsBatched(this.getDir());
  }

  async getDecisionRegistry(): Promise<DecisionRegistry> {
    const decisions = await this.getGlobalDecisions();
    const participantsSet = new Set<string>();
    const approvedBySet = new Set<string>();
    const tagsSet = new Set<string>();

    for (const d of decisions) {
      for (const p of d.participants) participantsSet.add(p.trim());
      for (const a of d.approved_by) approvedBySet.add(a.trim());
      for (const t of d.tags) tagsSet.add(t.trim());
    }

    return {
      participants: Array.from(participantsSet).sort(),
      approved_by: Array.from(approvedBySet).sort(),
      tags: Array.from(tagsSet).sort(),
    };
  }

  async updateDecisionMetadata(
    noteId: string,
    lineNumber: number,
    content: string,
    description: string | null,
    date: string | null,
    status: string | null,
    participants: string[],
    approvedBy: string[],
    tags: string[],
  ): Promise<void> {
    const fileContent = await this.readNote(noteId);
    const lines = fileContent.split('\n');

    if (lineNumber < lines.length) {
      const indent = lines[lineNumber].match(/^(\s*)/)?.[1] ?? '';
      const meta = { description, date, status, participants, approved_by: approvedBy, tags };
      const jsonMeta = JSON.stringify(meta);
      lines[lineNumber] = `${indent}- [D] ${content} <!-- decision:${jsonMeta} -->`;
      await this.writeNote(noteId, lines.join('\n'));
    }
  }

  // ── Backlinks ──

  async getBacklinks(targetNoteId: string): Promise<BacklinkInfo[]> {
    await ensureWasmLoaded();
    return getBacklinksBatched(this.getDir(), targetNoteId);
  }

  async saveImageBytes(relativeNoteId: string, fileName: string, bytes: Uint8Array): Promise<string> {
    return saveImageBytes(this.getDir(), relativeNoteId, fileName, bytes);
  }

  async saveAttachment(relativePath: string, bytes: Uint8Array): Promise<void> {
    const cleanPath = relativePath.replace(/^\/+|\/+$/g, '');
    const parts = cleanPath.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error(`Invalid attachment path: ${relativePath}`);

    let current = this.getDir();
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }

    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    await writable.close();

    clearImageCache(cleanPath);
    clearImageCache(fileName);
  }

  async saveTextAsset(relativeNoteId: string, fileName: string, content: string): Promise<string> {
    return saveTextAsset(this.getDir(), relativeNoteId, fileName, content);
  }

  async readTextAsset(relativePath: string): Promise<string> {
    return readTextAsset(this.getDir(), relativePath);
  }

  async getImageDataUrl(relativePath: string): Promise<string> {
    return getAssetUrl(this.getDir(), relativePath);
  }

  async getImageBytes(relativePath: string): Promise<Uint8Array> {
    return getAssetBytes(this.getDir(), relativePath);
  }

  async resolveAssetUrl(_currentNoteId: string, assetPath: string): Promise<string> {
    return this.getImageDataUrl(assetPath);
  }

  // ── Generic Vault Files (.han_history, configs, etc.) ──

  async readVaultFile(relativePath: string): Promise<string> {
    return readFileText(this.getDir(), relativePath);
  }

  async writeVaultFile(relativePath: string, content: string): Promise<void> {
    await writeFileText(this.getDir(), relativePath, content);
  }

  async vaultFileExists(relativePath: string): Promise<boolean> {
    try {
      const file = await getOrCreateFile(this.getDir(), relativePath, false);
      return file !== null;
    } catch {
      return false;
    }
  }
}
