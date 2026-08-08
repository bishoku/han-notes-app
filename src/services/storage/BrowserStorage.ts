/**
 * BrowserStorage — Web / PWA storage provider.
 * 
 * Uses the File System Access API (showDirectoryPicker) to read/write
 * actual .md files on the user's local disk (e.g., ~/.han directory).
 * 
 * Logic operations (parsing tasks, decisions, backlinks from markdown)
 * are implemented in TypeScript here but will be replaced with WASM
 * calls to han-core once the WASM build pipeline is integrated.
 * 
 * Browser Compatibility:
 * - Chrome, Edge, Opera: Full support (showDirectoryPicker)
 * - Safari, Firefox: NOT supported for local directory access
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

// ─── IndexedDB for persisting the directory handle across sessions ──────

const DB_NAME = 'han-notes-browser';
const DB_VERSION = 1;
const HANDLE_STORE = 'handles';

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
  const db = await openHandleDB();
  const tx = db.transaction(HANDLE_STORE, 'readwrite');
  tx.objectStore(HANDLE_STORE).put(handle, 'vaultDir');
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDB();
  const tx = db.transaction(HANDLE_STORE, 'readonly');
  const req = tx.objectStore(HANDLE_STORE).get('vaultDir');
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ─── File System Access API Helpers ─────────────────────────────────────

async function getOrCreateFile(
  dir: FileSystemDirectoryHandle,
  path: string,
  create = false,
): Promise<FileSystemFileHandle | null> {
  const parts = path.split('/').filter(Boolean);
  let current = dir;

  for (let i = 0; i < parts.length - 1; i++) {
    try {
      current = await current.getDirectoryHandle(parts[i], { create });
    } catch {
      return null;
    }
  }

  const fileName = parts[parts.length - 1];
  try {
    return await current.getFileHandle(fileName, { create });
  } catch {
    return null;
  }
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

async function listAllMdFiles(
  dir: FileSystemDirectoryHandle,
  basePath = '',
): Promise<{ relativePath: string; name: string }[]> {
  const results: { relativePath: string; name: string }[] = [];

  for await (const entry of (dir as any).values()) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
      const subDir = await dir.getDirectoryHandle(entry.name);
      results.push(...await listAllMdFiles(subDir, entryPath));
    } else if (entry.kind === 'file' && entry.name.endsWith('.md')) {
      results.push({ relativePath: entryPath, name: entry.name });
    }
  }

  return results;
}

async function buildFileTree(
  dir: FileSystemDirectoryHandle,
  basePath = '',
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];

  for await (const entry of (dir as any).values()) {
    if (entry.name.startsWith('.')) continue;
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.kind === 'directory') {
      const subDir = await dir.getDirectoryHandle(entry.name);
      const children = await buildFileTree(subDir, entryPath);
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

// ─── Markdown Parsing Helpers (mirrors Rust han-core logic) ─────────────

function parseYamlFrontmatter(content: string): { tags: string[]; body: string } {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return { tags: [], body: content };

  const afterFirst = trimmed.slice(3);
  const endIdx = afterFirst.indexOf('\n---');
  if (endIdx === -1) return { tags: [], body: content };

  const yamlStr = afterFirst.slice(0, endIdx);
  const body = afterFirst.slice(endIdx + 4).replace(/^\n+/, '');
  const tags: string[] = [];
  let inTags = false;

  for (const line of yamlStr.split('\n')) {
    const l = line.trim();
    if (l.startsWith('tags:')) {
      inTags = true;
      const rest = l.slice(5).trim();
      if (rest.startsWith('[') && rest.endsWith(']')) {
        const inner = rest.slice(1, -1);
        inner.split(',').forEach(t => {
          const clean = t.trim().replace(/^["']|["']$/g, '').replace(/^#/, '');
          if (clean) tags.push(clean);
        });
        inTags = false;
      }
    } else if (inTags && l.startsWith('-')) {
      const clean = l.slice(1).trim().replace(/^["']|["']$/g, '').replace(/^#/, '');
      if (clean) tags.push(clean);
    } else if (l.includes(':')) {
      inTags = false;
    }
  }

  return { tags, body };
}

function injectYamlFrontmatter(tags: string[], body: string): string {
  if (tags.length === 0) return body;
  const yamlLines = ['---', 'tags:'];
  for (const t of tags) {
    yamlLines.push(`  - ${t}`);
  }
  yamlLines.push('---');
  return `${yamlLines.join('\n')}\n\n${body.trimStart()}`;
}

function pathToNoteId(relPath: string): string {
  return relPath.replace(/\.md$/, '');
}

interface ParsedTask {
  completed: boolean;
  displayText: string;
  meta: {
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    priority?: string | null;
    assignee?: string | null;
    assignees: string[];
    progress?: number | null;
    tags: string[];
  };
}

function parseTaskLine(line: string): ParsedTask | null {
  const match = line.match(/^\s*[-*+]\s*\[([ xX])\]\s*(.*)/);
  if (!match) return null;

  const completed = match[1] !== ' ';
  const rawText = match[2];
  if (!rawText.trim()) return null;

  let meta: ParsedTask['meta'] = { assignees: [], tags: [] };
  let displayText = rawText.trim();

  const commentIdx = rawText.indexOf('<!-- task:');
  if (commentIdx !== -1) {
    const afterComment = rawText.slice(commentIdx + 10);
    const endIdx = afterComment.indexOf('-->');
    if (endIdx !== -1) {
      const jsonStr = afterComment.slice(0, endIdx).trim();
      try {
        const parsed = JSON.parse(jsonStr);
        meta = {
          description: parsed.description ?? null,
          start_date: parsed.start_date ?? null,
          end_date: parsed.end_date ?? null,
          priority: parsed.priority ?? null,
          assignee: parsed.assignee ?? null,
          assignees: parsed.assignees ?? [],
          progress: parsed.progress ?? null,
          tags: parsed.tags ?? [],
        };
      } catch { /* ignore parse errors */ }
    }
    displayText = rawText.slice(0, commentIdx).trim();
  }

  return { completed, displayText, meta };
}

interface ParsedDecision {
  content: string;
  meta: {
    description?: string | null;
    date?: string | null;
    status?: string | null;
    participants: string[];
    approved_by: string[];
    tags: string[];
  };
}

function parseDecisionLine(line: string): ParsedDecision | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('- [D]') && !trimmed.startsWith('- [d]') && !trimmed.includes('<!-- decision:')) {
    return null;
  }

  let rawText = trimmed;
  if (rawText.startsWith('- [D]') || rawText.startsWith('- [d]')) {
    rawText = rawText.slice(5).trim();
  }

  let meta: ParsedDecision['meta'] = { participants: [], approved_by: [], tags: [] };
  const commentIdx = rawText.indexOf('<!-- decision:');
  if (commentIdx !== -1) {
    const jsonPart = rawText.slice(commentIdx + 14);
    const endIdx = jsonPart.indexOf('-->');
    if (endIdx !== -1) {
      const jsonStr = jsonPart.slice(0, endIdx).trim();
      try {
        const parsed = JSON.parse(jsonStr);
        meta = {
          description: parsed.description ?? null,
          date: parsed.date ?? null,
          status: parsed.status ?? null,
          participants: parsed.participants ?? [],
          approved_by: parsed.approved_by ?? [],
          tags: parsed.tags ?? [],
        };
      } catch { /* ignore */ }
    }
  }

  const content = commentIdx !== -1 ? rawText.slice(0, commentIdx).trim() : rawText.trim();
  if (!content) return null;

  return { content, meta };
}

// ─── BrowserStorage Implementation ──────────────────────────────────────

export class BrowserStorage implements IStorageService {
  private dirHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Try to silently reuse a previously saved directory handle.
   * Does NOT show any browser dialogs — safe to call on page load.
   * Throws if no saved handle or permission not already granted.
   */
  async init(): Promise<void> {
    const saved = await loadHandle();
    if (saved) {
      // queryPermission is silent and does not require user gesture
      const perm = await (saved as any).queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        this.dirHandle = saved;
        return;
      }
    }
    throw new Error('No saved directory handle or permission not granted.');
  }

  /**
   * Show the directory picker dialog. MUST be called from a user gesture (click).
   */
  async pickDirectory(): Promise<void> {
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
    const dir = this.getDir();
    const files = await listAllMdFiles(dir);
    const notes: NoteInfo[] = [];

    for (const f of files) {
      const content = await readFileText(dir, f.relativePath);
      const { tags } = parseYamlFrontmatter(content);
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

  async getVaultTags(): Promise<TagCount[]> {
    const notes = await this.getVaultFiles();
    const counts = new Map<string, number>();
    for (const note of notes) {
      for (const tag of note.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const list: TagCount[] = Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }));
    list.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    return list;
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
    // Read source content
    const content = await readFileText(dir, srcRelPath);
    const fileName = srcRelPath.split('/').pop() ?? srcRelPath;
    const destPath = destDirRelPath ? `${destDirRelPath}/${fileName}` : fileName;
    // Write to destination
    await writeFileText(dir, destPath, content);
    // Delete source
    await this.deleteFileByPath(dir, srcRelPath);
  }

  async deleteNode(relativePath: string): Promise<void> {
    await this.deleteFileByPath(this.getDir(), relativePath);
  }

  async renameNode(relativePath: string, newName: string): Promise<void> {
    const dir = this.getDir();
    const content = await readFileText(dir, relativePath);
    const parts = relativePath.split('/');
    parts.pop();
    const finalName = !relativePath.includes('.') || relativePath.endsWith('.md')
      ? (newName.endsWith('.md') ? newName : `${newName}.md`)
      : newName;
    const newPath = parts.length > 0 ? `${parts.join('/')}/${finalName}` : finalName;
    await writeFileText(dir, newPath, content);
    await this.deleteFileByPath(dir, relativePath);
  }

  async updateNoteTags(id: string, tags: string[]): Promise<void> {
    const content = await this.readNote(id);
    const { body } = parseYamlFrontmatter(content);
    const newContent = injectYamlFrontmatter(tags, body);
    await this.writeNote(id, newContent);
  }

  // ── Tasks ──

  async getGlobalTasks(): Promise<TaskInfo[]> {
    const dir = this.getDir();
    const files = await listAllMdFiles(dir);
    const tasks: TaskInfo[] = [];

    for (const f of files) {
      const content = await readFileText(dir, f.relativePath);
      const noteId = pathToNoteId(f.relativePath);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const parsed = parseTaskLine(lines[i]);
        if (parsed) {
          tasks.push({
            note_id: noteId,
            line_number: i,
            content: parsed.displayText,
            completed: parsed.completed,
            description: parsed.meta.description,
            start_date: parsed.meta.start_date,
            end_date: parsed.meta.end_date,
            priority: parsed.meta.priority,
            assignee: parsed.meta.assignee,
            assignees: parsed.meta.assignees,
            progress: parsed.meta.progress,
            tags: parsed.meta.tags,
            raw_line: lines[i],
          });
        }
      }
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
    const dir = this.getDir();
    const files = await listAllMdFiles(dir);
    const decisions: DecisionInfo[] = [];

    for (const f of files) {
      const content = await readFileText(dir, f.relativePath);
      const noteId = pathToNoteId(f.relativePath);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const parsed = parseDecisionLine(lines[i]);
        if (parsed) {
          decisions.push({
            note_id: noteId,
            line_number: i,
            content: parsed.content,
            description: parsed.meta.description,
            date: parsed.meta.date,
            status: parsed.meta.status,
            participants: parsed.meta.participants,
            approved_by: parsed.meta.approved_by,
            tags: parsed.meta.tags,
            raw_line: lines[i],
          });
        }
      }
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
    const dir = this.getDir();
    const files = await listAllMdFiles(dir);
    const backlinks: BacklinkInfo[] = [];

    const titleStem = targetNoteId.split('/').pop()?.replace(/\.md$/, '') ?? targetNoteId;
    const pattern = new RegExp(
      `\\[\\[(?:${escapeRegex(targetNoteId)}|${escapeRegex(titleStem)})\\s*(?:\\|[^\\]]*)?\\]\\]`,
    );

    for (const f of files) {
      const noteId = pathToNoteId(f.relativePath);
      if (noteId.toLowerCase() === targetNoteId.toLowerCase()) continue;

      const content = await readFileText(dir, f.relativePath);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          backlinks.push({
            source_note_id: noteId,
            snippet: lines[i].trim(),
            line_number: i,
          });
        }
      }
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

    // Ensure .attachments directory exists
    let current = dir;
    for (const part of attachmentsPath.split('/').filter(Boolean)) {
      current = await current.getDirectoryHandle(part, { create: true });
    }

    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    await writable.close();

    return parentDir ? `${parentDir}/.attachments/${fileName}` : `.attachments/${fileName}`;
  }

  async getImageDataUrl(relativePath: string): Promise<string> {
    const dir = this.getDir();
    const handle = await getOrCreateFile(dir, relativePath);
    if (!handle) throw new Error(`Image not found: ${relativePath}`);

    const file = await handle.getFile();
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const ext = relativePath.split('.').pop()?.toLowerCase() ?? 'png';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    const mime = mimeMap[ext] ?? 'image/png';

    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);

    return `data:${mime};base64,${b64}`;
  }

  // ── Private Helpers ──

  private async deleteFileByPath(dir: FileSystemDirectoryHandle, path: string): Promise<void> {
    const parts = path.split('/').filter(Boolean);
    let current = dir;

    for (let i = 0; i < parts.length - 1; i++) {
      try {
        current = await current.getDirectoryHandle(parts[i]);
      } catch {
        return; // Parent doesn't exist, nothing to delete
      }
    }

    const target = parts[parts.length - 1];
    try {
      await current.removeEntry(target, { recursive: true });
    } catch {
      // Entry doesn't exist
    }
  }
}

// ─── Utility ────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
