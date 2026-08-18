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
import initWasm, {
  wasm_parse_yaml_frontmatter,
  wasm_inject_yaml_frontmatter,
  wasm_parse_tasks_from_content,
  wasm_parse_decisions_from_content,
  wasm_find_backlinks,
} from '@/wasm/han-core/han_core';
import wasmUrl from '@/wasm/han-core/han_core_bg.wasm?url';

// ─── WebAssembly Initialization ──────────────────────────────────────────

let wasmPromise: Promise<any> | null = null;

async function ensureWasmLoaded(): Promise<void> {
  if (!wasmPromise) {
    wasmPromise = initWasm({ module_or_path: wasmUrl });
  }
  await wasmPromise;
}

// ─── IndexedDB for persisting the directory handle across sessions ──────

const DB_NAME = 'han-notes-browser';
const DB_VERSION = 1;
const HANDLE_STORE = 'handles';

// In-memory cache for fast, synchronous-like image preview without disk churn
const imageCache = new Map<string, string>();

export function clearImageCache(path?: string) {
  if (path) imageCache.delete(path);
  else imageCache.clear();
}

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, 'vaultDir');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[BrowserStorage] Failed to save directory handle:', err);
  }
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const req = tx.objectStore(HANDLE_STORE).get('vaultDir');
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[BrowserStorage] Failed to load saved handle from IndexedDB:', err);
    return null;
  }
}

async function clearHandle(): Promise<void> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).delete('vaultDir');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[BrowserStorage] Failed to clear directory handle:', err);
  }
}

// ─── File System Access API Helpers ─────────────────────────────────────

async function getOrCreateFile(
  dir: FileSystemDirectoryHandle,
  path: string,
  create = false,
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

async function listAllMdFiles(
  dir: FileSystemDirectoryHandle,
  prefix = '',
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

async function readFileText(
  dir: FileSystemDirectoryHandle,
  path: string,
): Promise<string> {
  const handle = await getOrCreateFile(dir, path);
  if (!handle) return '';
  const file = await handle.getFile();
  return file.text();
}

async function writeFileText(
  dir: FileSystemDirectoryHandle,
  path: string,
  content: string,
): Promise<void> {
  const handle = await getOrCreateFile(dir, path, true);
  if (!handle) throw new Error(`Cannot create file: ${path}`);
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function buildFileTree(
  dir: FileSystemDirectoryHandle,
  prefix = '',
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

function pathToNoteId(relPath: string): string {
  return relPath.replace(/\.md$/, '');
}

// ─── BrowserStorage Implementation ──────────────────────────────────────

export class BrowserStorage implements IStorageService {
  private dirHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Get the name of the saved directory handle (if one exists in IndexedDB).
   */
  async getSavedHandleName(): Promise<string | null> {
    try {
      const saved = await loadHandle();
      return saved ? saved.name : null;
    } catch {
      return null;
    }
  }

  /**
   * Try to silently reuse a previously saved directory handle.
   * Does NOT show any browser dialogs — safe to call on page load.
   * Throws if no saved handle or permission not already granted.
   */
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

  /**
   * Request permission for a previously saved directory handle inside a user gesture (click).
   * Returns true if permission was granted, false otherwise.
   */
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

  /**
   * Clear the saved directory handle from IndexedDB.
   */
  async clearSavedHandle(): Promise<void> {
    this.dirHandle = null;
    await clearHandle();
  }

  /**
   * Show the directory picker dialog. MUST be called from a user gesture (click).
   */
  async pickDirectory(): Promise<void> {
    await ensureWasmLoaded();
    this.dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    if (this.dirHandle) {
      await saveHandle(this.dirHandle);
    }
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
    const dir = this.getDir();
    const files = await listAllMdFiles(dir);
    const notes: NoteInfo[] = [];

    for (const f of files) {
      const content = await readFileText(dir, f.relativePath);
      const parsed = wasm_parse_yaml_frontmatter(content);
      const tags: string[] = parsed?.[0]?.tags || [];
      const noteId = pathToNoteId(f.relativePath);
      const title = f.name.replace(/\.md$/, '');
      notes.push({ id: noteId, title, path: f.relativePath, tags });
    }

    notes.sort((a, b) => a.title.localeCompare(b.title));
    return notes;
  }

  async getVaultTree(): Promise<FileNode[]> {
    return buildFileTree(this.getDir());
  }

  async getVaultPath(): Promise<string> {
    return this.dirHandle?.name ? `/${this.dirHandle.name}` : 'Local Vault';
  }

  async selectVaultFolder(): Promise<string | null> {
    await this.pickDirectory();
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
    const path = id.endsWith('.md') ? id : `${id}.md`;
    return readFileText(this.getDir(), path);
  }

  async writeNote(id: string, content: string): Promise<void> {
    const path = id.endsWith('.md') ? id : `${id}.md`;
    await writeFileText(this.getDir(), path, content);
  }

  async createNoteInFolder(parentPath: string, title: string): Promise<void> {
    const fileName = title.endsWith('.md') ? title : `${title}.md`;
    const path = parentPath ? `${parentPath}/${fileName}` : fileName;
    const noteTitle = title.replace(/\.md$/, '');
    await writeFileText(this.getDir(), path, `# ${noteTitle}\n`);
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

    // CRITICAL: Prevent moving a file/folder to the exact same path (which would overwrite and delete itself)
    if (srcRelPath === destPath) {
      return;
    }

    // Prevent moving a folder into its own subfolder
    if (destDirRelPath === srcRelPath || destDirRelPath.startsWith(`${srcRelPath}/`)) {
      console.warn(`Cannot move folder "${srcRelPath}" into its own subfolder "${destDirRelPath}"`);
      return;
    }

    // Check if source is a file or a folder
    const srcFile = await getOrCreateFile(dir, srcRelPath, false);
    if (srcFile) {
      // Source is a file
      const content = await readFileText(dir, srcRelPath);
      await writeFileText(dir, destPath, content);
      await this.deleteFileByPath(dir, srcRelPath);
    } else {
      // Source is a directory — copy recursively
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

      await this.copyDirRecursive(currentSrc, currentDest);
      await this.deleteFileByPath(dir, srcRelPath);
    }
  }

  private async copyDirRecursive(
    srcDir: FileSystemDirectoryHandle,
    destDir: FileSystemDirectoryHandle,
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
        await this.copyDirRecursive(entry as FileSystemDirectoryHandle, subDestDir);
      }
    }
  }

  async deleteNode(relativePath: string): Promise<void> {
    await this.deleteFileByPath(this.getDir(), relativePath);
  }

  async renameNode(relativePath: string, newName: string): Promise<void> {
    const dir = this.getDir();
    const srcFile = await getOrCreateFile(dir, relativePath, false);

    if (srcFile) {
      // ── Source is a FILE ──
      const content = await readFileText(dir, relativePath);
      const parts = relativePath.split('/').filter(Boolean);
      parts.pop();
      const finalName = newName.endsWith('.md') ? newName : `${newName}.md`;
      const newPath = parts.length > 0 ? `${parts.join('/')}/${finalName}` : finalName;

      // Prevent renaming to the exact same path
      if (relativePath === newPath) return;

      await writeFileText(dir, newPath, content);
      await this.deleteFileByPath(dir, relativePath);
    } else {
      // ── Source is a DIRECTORY ──
      const cleanNewName = newName.replace(/\.md$/, '').trim();
      const srcParts = relativePath.split('/').filter(Boolean);
      srcParts.pop(); // Remove old folder name to get parent
      const newPath = srcParts.length > 0 ? `${srcParts.join('/')}/${cleanNewName}` : cleanNewName;

      // Prevent renaming to the exact same path
      if (relativePath === newPath) return;

      // 1. Get source directory handle
      let currentSrc = dir;
      for (const part of relativePath.split('/').filter(Boolean)) {
        currentSrc = await currentSrc.getDirectoryHandle(part);
      }

      // 2. Create destination directory handle
      let currentDest = dir;
      for (const part of newPath.split('/').filter(Boolean)) {
        currentDest = await currentDest.getDirectoryHandle(part, { create: true });
      }

      // 3. Copy directory contents recursively
      await this.copyDirRecursive(currentSrc, currentDest);

      // 4. Delete old directory
      await this.deleteFileByPath(dir, relativePath);
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
    const dir = this.getDir();
    const files = await listAllMdFiles(dir);
    const tasks: TaskInfo[] = [];

    for (const f of files) {
      const content = await readFileText(dir, f.relativePath);
      const noteId = pathToNoteId(f.relativePath);
      const fileTasks: TaskInfo[] = wasm_parse_tasks_from_content(content, noteId) || [];
      tasks.push(...fileTasks);
    }

    return tasks;
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
    const dir = this.getDir();
    const files = await listAllMdFiles(dir);
    const decisions: DecisionInfo[] = [];

    for (const f of files) {
      const content = await readFileText(dir, f.relativePath);
      const noteId = pathToNoteId(f.relativePath);
      const fileDecisions: DecisionInfo[] = wasm_parse_decisions_from_content(content, noteId) || [];
      decisions.push(...fileDecisions);
    }

    return decisions;
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
    const dir = this.getDir();
    const files = await listAllMdFiles(dir);
    const backlinks: BacklinkInfo[] = [];

    for (const f of files) {
      const noteId = pathToNoteId(f.relativePath);
      if (noteId.toLowerCase() === targetNoteId.toLowerCase()) continue;

      const content = await readFileText(dir, f.relativePath);
      const links: BacklinkInfo[] = wasm_find_backlinks(content, noteId, targetNoteId) || [];
      backlinks.push(...links);
    }

    return backlinks;
  }

  // ── Assets / Images ──

  async saveImageBytes(relativeNoteId: string, fileName: string, bytes: Uint8Array): Promise<string> {
    const dir = this.getDir();
    const parentDir = relativeNoteId.includes('/')
      ? relativeNoteId.split('/').slice(0, -1).join('/')
      : '';

    const attachmentsPath = parentDir
      ? `${parentDir}/.attachments`
      : '.attachments';

    let current = dir;
    for (const part of attachmentsPath.split('/').filter(Boolean)) {
      current = await current.getDirectoryHandle(part, { create: true });
    }

    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    await writable.close();

    const relPath = parentDir ? `${parentDir}/.attachments/${fileName}` : `.attachments/${fileName}`;
    imageCache.delete(relPath);
    imageCache.delete(fileName);
    imageCache.delete(`/${relPath}`);

    return relPath;
  }

  async saveTextAsset(relativeNoteId: string, fileName: string, content: string): Promise<string> {
    const dir = this.getDir();
    const parentDir = relativeNoteId.includes('/')
      ? relativeNoteId.split('/').slice(0, -1).join('/')
      : '';

    const attachmentsPath = parentDir
      ? `${parentDir}/.attachments`
      : '.attachments';

    let current = dir;
    for (const part of attachmentsPath.split('/').filter(Boolean)) {
      current = await current.getDirectoryHandle(part, { create: true });
    }

    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    const relPath = parentDir
      ? `${parentDir}/.attachments/${fileName}`
      : `.attachments/${fileName}`;

    // Invalidate / update memory cache immediately
    imageCache.delete(relPath);
    imageCache.delete(fileName);

    return relPath;
  }

  async readTextAsset(relativePath: string): Promise<string> {
    const dir = this.getDir();
    const parts = relativePath.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error('Invalid path');

    let current = dir;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part);
    }

    const fileHandle = await current.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async getImageDataUrl(relativePath: string): Promise<string> {
    if (imageCache.has(relativePath)) {
      return imageCache.get(relativePath)!;
    }

    const dir = this.getDir();
    const parts = relativePath.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error('Invalid path');

    let current: FileSystemDirectoryHandle = dir;
    let found = true;
    for (const part of parts) {
      try {
        current = await current.getDirectoryHandle(part);
      } catch {
        found = false;
        break;
      }
    }

    if (found) {
      try {
        const fileHandle = await current.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            imageCache.set(relativePath, res);
            resolve(res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } catch {
        // Fallback to recursive search
      }
    }

    // Recursive search fallback in case path was just the filename or relative to subfolder
    async function searchInDir(d: FileSystemDirectoryHandle, target: string): Promise<File | null> {
      for await (const entry of (d as any).values()) {
        if (entry.kind === 'file' && entry.name === target) {
          return (entry as FileSystemFileHandle).getFile();
        }
        if (entry.kind === 'directory') {
          const sub = await searchInDir(entry as FileSystemDirectoryHandle, target);
          if (sub) return sub;
        }
      }
      return null;
    }

    const file = await searchInDir(dir, fileName);
    if (!file) {
      throw new Error(`File not found in vault: ${relativePath}`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        imageCache.set(relativePath, res);
        resolve(res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async resolveAssetUrl(_currentNoteId: string, assetPath: string): Promise<string> {
    return this.getImageDataUrl(assetPath);
  }

  // ── Generic Vault Files (.han_history, configs, etc.) ──

  async readVaultFile(relativePath: string): Promise<string> {
    const dir = this.getDir();
    return readFileText(dir, relativePath);
  }

  async writeVaultFile(relativePath: string, content: string): Promise<void> {
    const dir = this.getDir();
    await writeFileText(dir, relativePath, content);
  }

  async vaultFileExists(relativePath: string): Promise<boolean> {
    try {
      const dir = this.getDir();
      const file = await getOrCreateFile(dir, relativePath, false);
      return file !== null;
    } catch {
      return false;
    }
  }

  private async deleteFileByPath(dir: FileSystemDirectoryHandle, path: string): Promise<void> {
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
}
