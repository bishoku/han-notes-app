/**
 * IndexedDBStorage — Offline, Local-First storage provider for Mobile & Unsupported Browsers.
 * 
 * Implements IStorageService to provide complete note taking, task/decision indexing,
 * backlink tracking, asset storage, and file tree management when File System Access API
 * is not supported (e.g. Mobile Safari, Android browsers, Firefox).
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
import { toNoteFilePath, normalizeNoteId, extractTitleFromId, extractFolderFromId } from '@/utils/pathUtils';
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
  if (typeof window === 'undefined') return;
  if (!wasmPromise) {
    try {
      wasmPromise = initWasm({ module_or_path: wasmUrl });
    } catch (err) {
      console.warn('[IndexedDBStorage] Failed to initialize WASM module:', err);
      return;
    }
  }
  await wasmPromise;
}

// ─── Database Schema & Records ───────────────────────────────────────────

export interface DbNoteRecord {
  id: string; // normalized ID (e.g. "Work/Project")
  path: string; // relative file path (e.g. "Work/Project.md")
  title: string;
  content: string;
  updatedAt: number;
  deleted: boolean;
  deletedAt?: number;
  tags: string[];
}

export interface DbFolderRecord {
  path: string; // e.g. "Work" or "Work/Projects"
  name: string;
  createdAt: number;
}

export interface DbAssetRecord {
  path: string; // relative path e.g. "_assets/image.png"
  fileName: string;
  bytes: Uint8Array;
  mimeType: string;
  updatedAt: number;
}

export interface DbVaultFileRecord {
  path: string;
  content: string;
  updatedAt: number;
}

const DB_NAME = 'han_notes_db';
const DB_VERSION = 1;

const STORE_NOTES = 'notes';
const STORE_FOLDERS = 'folders';
const STORE_ASSETS = 'assets';
const STORE_VAULT_FILES = 'vault_files';

export class IndexedDBStorage implements IStorageService {
  private currentWorkspaceId: string = 'default';
  private db: IDBDatabase | null = null;
  private assetUrlCache = new Map<string, string>();

  /**
   * Sets the active workspace and resets the underlying DB connection.
   */
  public setWorkspace(workspaceId: string): void {
    if (this.currentWorkspaceId !== workspaceId) {
      this.currentWorkspaceId = workspaceId;
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      this.assetUrlCache.clear();
    }
  }

  public getWorkspaceId(): string {
    return this.currentWorkspaceId;
  }

  public getDbName(): string {
    return this.currentWorkspaceId === 'default'
      ? DB_NAME
      : `${DB_NAME}_${this.currentWorkspaceId}`;
  }

  /**
   * Drops the IndexedDB database for a specific workspace upon deletion.
   */
  public static async deleteWorkspaceDatabase(workspaceId: string): Promise<void> {
    const dbName = workspaceId === 'default' ? DB_NAME : `${DB_NAME}_${workspaceId}`;
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Opens or retrieves the singleton IndexedDB connection for the active workspace.
   */
  async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available in this environment.'));
    }

    const dbName = this.getDbName();
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, DB_VERSION);

      request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = (e.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NOTES)) {
          const noteStore = db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
          noteStore.createIndex('path', 'path', { unique: true });
          noteStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          noteStore.createIndex('deleted', 'deleted', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
          db.createObjectStore(STORE_FOLDERS, { keyPath: 'path' });
        }

        if (!db.objectStoreNames.contains(STORE_ASSETS)) {
          db.createObjectStore(STORE_ASSETS, { keyPath: 'path' });
        }

        if (!db.objectStoreNames.contains(STORE_VAULT_FILES)) {
          db.createObjectStore(STORE_VAULT_FILES, { keyPath: 'path' });
        }
      };

      request.onsuccess = async () => {
        this.db = request.result;
        await this.seedWelcomeNoteIfEmpty();
        resolve(this.db);
      };

      request.onerror = () => {
        reject(new Error(`IndexedDB open failed: ${request.error?.message}`));
      };
    });
  }

  /**
   * Seeds an introductory note on first launch if vault is completely empty.
   */
  private async seedWelcomeNoteIfEmpty(): Promise<void> {
    try {
      const files = await this.getAllActiveNotes();
      if (this.currentWorkspaceId === 'default' && files.length === 0) {
        const welcomeContent = `# H.A.N. Not Defteri / H.A.N. Notes

Yerel öncelikli, uçtan uca şifreli ve doğrudan eşler arası (P2P) senkronizasyonlu not defterinize hoş geldiniz.

## Özellikler
- **Yerel Öncelikli Depolama:** Verileriniz cihazınızda saklanır.
- **P2P Senkronizasyon:** QR kod ile masaüstü ve mobil cihazlarınız arasında güvenli senkronizasyon.
- **Görevler & Kararlar:** Markdown içinde yapay zeka ve görev takibi.

- [ ] İlk notumu inceledim <!-- task:{"priority":"high"} -->
- [D] Mobil ve Masaüstü senkronizasyonu başlatıldı <!-- decision:{"status":"accepted"} -->
`;
        await this.writeNote('welcome', welcomeContent);
      }
    } catch {
      // Ignore seeding errors
    }
  }

  // ── Helper DB Operations ──

  async getAllActiveNotes(): Promise<DbNoteRecord[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NOTES, 'readonly');
      const store = tx.objectStore(STORE_NOTES);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result as DbNoteRecord[]) || [];
        resolve(records.filter((n) => !n.deleted));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getAllNotesIncludingDeleted(): Promise<DbNoteRecord[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NOTES, 'readonly');
      const store = tx.objectStore(STORE_NOTES);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result as DbNoteRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  private async getAllFolders(): Promise<DbFolderRecord[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FOLDERS, 'readonly');
      const store = tx.objectStore(STORE_FOLDERS);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result as DbFolderRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getNoteRecord(id: string): Promise<DbNoteRecord | null> {
    const cleanId = normalizeNoteId(id);
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NOTES, 'readonly');
      const store = tx.objectStore(STORE_NOTES);
      const req = store.get(cleanId);

      req.onsuccess = () => {
        const res = req.result as DbNoteRecord | undefined;
        if (res && !res.deleted) {
          resolve(res);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ── Vault / File Tree ──

  async getVaultFiles(): Promise<NoteInfo[]> {
    await ensureWasmLoaded();
    const records = await this.getAllActiveNotes();

    return records.map((r) => {
      let tags = r.tags || [];
      if (!tags.length && r.content) {
        try {
          const parsed = wasm_parse_yaml_frontmatter(r.content);
          if (parsed?.[0]?.tags && Array.isArray(parsed[0].tags)) {
            tags = parsed[0].tags;
          }
        } catch {
          // Fallback tag regex
          const match = r.content.match(/^---\n([\s\S]*?)\n---/);
          if (match) {
            const tagLine = match[1].match(/tags:\s*\[(.*?)\]/);
            if (tagLine) {
              tags = tagLine[1].split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, ''));
            }
          }
        }
      }

      return {
        id: r.id,
        title: r.title || extractTitleFromId(r.id),
        path: r.path,
        tags,
      };
    });
  }

  async getVaultTree(): Promise<FileNode[]> {
    const [notes, folders] = await Promise.all([this.getAllActiveNotes(), this.getAllFolders()]);

    const rootNodes: FileNode[] = [];
    const dirMap = new Map<string, FileNode>();

    // Helper to get or create directory node
    const ensureDir = (dirPath: string): FileNode => {
      const normalized = dirPath.replace(/^\/+|\/+$/g, '');
      if (dirMap.has(normalized)) return dirMap.get(normalized)!;

      const parts = normalized.split('/');
      const name = parts[parts.length - 1];
      const node: FileNode = {
        name,
        relative_path: normalized,
        is_dir: true,
        children: [],
      };

      dirMap.set(normalized, node);

      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join('/');
        const parent = ensureDir(parentPath);
        if (!parent.children.some((c) => c.relative_path === normalized)) {
          parent.children.push(node);
        }
      } else {
        if (!rootNodes.some((c) => c.relative_path === normalized)) {
          rootNodes.push(node);
        }
      }

      return node;
    };

    // Ensure explicit folders
    for (const f of folders) {
      if (f.path) ensureDir(f.path);
    }

    // Add notes into directory hierarchy
    for (const note of notes) {
      const parts = note.path.split('/');
      const fileName = parts.pop()!;
      const fileNode: FileNode = {
        name: fileName,
        relative_path: note.path,
        is_dir: false,
        children: [],
      };

      if (parts.length > 0) {
        const parentDir = ensureDir(parts.join('/'));
        parentDir.children.push(fileNode);
      } else {
        rootNodes.push(fileNode);
      }
    }

    // Sort nodes: directories first, then alphabetical
    const sortNodes = (nodes: FileNode[]) => {
      nodes.sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const node of nodes) {
        if (node.is_dir && node.children.length > 0) {
          sortNodes(node.children);
        }
      }
    };

    sortNodes(rootNodes);
    return rootNodes;
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

  async getVaultPath(): Promise<string> {
    return 'IndexedDB Vault';
  }

  async selectVaultFolder(): Promise<string | null> {
    return 'IndexedDB Vault';
  }

  // ── Note CRUD ──

  async readNote(id: string): Promise<string> {
    const record = await this.getNoteRecord(id);
    if (!record) {
      throw new Error(`Note not found: ${id}`);
    }
    return record.content;
  }

  async writeNote(id: string, content: string): Promise<void> {
    await ensureWasmLoaded();
    const cleanId = normalizeNoteId(id);
    const filePath = toNoteFilePath(cleanId);
    const title = extractTitleFromId(cleanId);

    let tags: string[] = [];
    try {
      const parsed = wasm_parse_yaml_frontmatter(content);
      if (parsed?.[0]?.tags && Array.isArray(parsed[0].tags)) {
        tags = parsed[0].tags;
      }
    } catch {
      // Ignored
    }

    const record: DbNoteRecord = {
      id: cleanId,
      path: filePath,
      title,
      content,
      updatedAt: Date.now(),
      deleted: false,
      tags,
    };

    // Auto-create parent folders if necessary
    const parentFolder = extractFolderFromId(cleanId);
    if (parentFolder) {
      await this.createFolder('', parentFolder);
    }

    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NOTES, 'readwrite');
      const store = tx.objectStore(STORE_NOTES);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async createNoteInFolder(parentPath: string, title: string): Promise<void> {
    const cleanTitle = title.replace(/\.md$/, '');
    const id = parentPath ? `${parentPath}/${cleanTitle}` : cleanTitle;
    await this.writeNote(id, `# ${cleanTitle}\n\n`);
  }

  async createFolder(parentPath: string, folderName: string): Promise<void> {
    const cleanParent = parentPath.replace(/^\/+|\/+$/g, '');
    const cleanFolder = folderName.replace(/^\/+|\/+$/g, '');
    const fullPath = cleanParent ? `${cleanParent}/${cleanFolder}` : cleanFolder;

    const parts = fullPath.split('/').filter(Boolean);
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FOLDERS, 'readwrite');
      const store = tx.objectStore(STORE_FOLDERS);

      let accumulated = '';
      for (const part of parts) {
        accumulated = accumulated ? `${accumulated}/${part}` : part;
        store.put({
          path: accumulated,
          name: part,
          createdAt: Date.now(),
        });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async moveNode(srcRelPath: string, destDirRelPath: string): Promise<void> {
    const cleanSrc = srcRelPath.replace(/^\/+|\/+$/g, '');
    const cleanDestDir = destDirRelPath.replace(/^\/+|\/+$/g, '');
    const fileName = cleanSrc.split('/').pop() ?? cleanSrc;
    const destPath = cleanDestDir ? `${cleanDestDir}/${fileName}` : fileName;

    if (cleanSrc === destPath) return;

    const isNote = cleanSrc.endsWith('.md');
    const db = await this.getDb();

    if (isNote) {
      const oldId = normalizeNoteId(cleanSrc);
      const newId = normalizeNoteId(destPath);
      const note = await this.getNoteRecord(oldId);
      if (note) {
        await this.deleteNode(cleanSrc);
        await this.writeNote(newId, note.content);
      }
    } else {
      // Folder move
      const tx = db.transaction([STORE_NOTES, STORE_FOLDERS], 'readwrite');
      const noteStore = tx.objectStore(STORE_NOTES);
      const folderStore = tx.objectStore(STORE_FOLDERS);

      // Move notes with prefix
      const noteReq = noteStore.getAll();
      noteReq.onsuccess = () => {
        const notes = (noteReq.result as DbNoteRecord[]) || [];
        for (const n of notes) {
          if (n.path === cleanSrc || n.path.startsWith(`${cleanSrc}/`)) {
            const subPath = n.path.slice(cleanSrc.length);
            const newPath = `${destPath}${subPath}`;
            const newId = normalizeNoteId(newPath);
            noteStore.delete(n.id);
            noteStore.put({
              ...n,
              id: newId,
              path: newPath,
              title: extractTitleFromId(newId),
              updatedAt: Date.now(),
            });
          }
        }
      };

      // Move folder records
      const folderReq = folderStore.getAll();
      folderReq.onsuccess = () => {
        const folders = (folderReq.result as DbFolderRecord[]) || [];
        for (const f of folders) {
          if (f.path === cleanSrc || f.path.startsWith(`${cleanSrc}/`)) {
            const sub = f.path.slice(cleanSrc.length);
            const newFPath = `${destPath}${sub}`;
            folderStore.delete(f.path);
            folderStore.put({
              path: newFPath,
              name: newFPath.split('/').pop() || f.name,
              createdAt: f.createdAt,
            });
          }
        }
      };
    }
  }

  async deleteNode(relativePath: string): Promise<void> {
    const cleanPath = relativePath.replace(/^\/+|\/+$/g, '');
    const isNote = cleanPath.endsWith('.md');
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NOTES, STORE_FOLDERS], 'readwrite');
      const noteStore = tx.objectStore(STORE_NOTES);
      const folderStore = tx.objectStore(STORE_FOLDERS);

      if (isNote) {
        const noteId = normalizeNoteId(cleanPath);
        const req = noteStore.get(noteId);
        req.onsuccess = () => {
          const rec = req.result as DbNoteRecord | undefined;
          if (rec) {
            // Soft-delete tombstone record
            noteStore.put({
              ...rec,
              deleted: true,
              deletedAt: Date.now(),
            });
          }
        };
      } else {
        // Delete all notes under folder
        const noteReq = noteStore.getAll();
        noteReq.onsuccess = () => {
          const notes = (noteReq.result as DbNoteRecord[]) || [];
          for (const n of notes) {
            if (n.path.startsWith(`${cleanPath}/`) || n.path === cleanPath) {
              noteStore.put({
                ...n,
                deleted: true,
                deletedAt: Date.now(),
              });
            }
          }
        };

        // Delete folder records
        const folderReq = folderStore.getAll();
        folderReq.onsuccess = () => {
          const folders = (folderReq.result as DbFolderRecord[]) || [];
          for (const f of folders) {
            if (f.path.startsWith(`${cleanPath}/`) || f.path === cleanPath) {
              folderStore.delete(f.path);
            }
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async renameNode(relativePath: string, newName: string): Promise<void> {
    const cleanPath = relativePath.replace(/^\/+|\/+$/g, '');
    const isNote = cleanPath.endsWith('.md');
    const parts = cleanPath.split('/');
    parts.pop();

    const finalName = isNote
      ? (newName.endsWith('.md') ? newName : `${newName}.md`)
      : newName.replace(/\.md$/, '').trim();
    const newPath = parts.length > 0 ? `${parts.join('/')}/${finalName}` : finalName;

    await this.moveNode(cleanPath, parts.join('/'));
    if (newPath !== cleanPath) {
      await this.moveNode(cleanPath, parts.join('/'));
    }
  }

  async updateNoteTags(id: string, tags: string[]): Promise<void> {
    await ensureWasmLoaded();
    const content = await this.readNote(id);
    let newContent = content;
    try {
      const parsed = wasm_parse_yaml_frontmatter(content);
      const body: string = parsed?.[1] ?? content;
      newContent = wasm_inject_yaml_frontmatter(JSON.stringify({ tags }), body);
    } catch {
      newContent = `---\ntags: [${tags.join(', ')}]\n---\n\n${content}`;
    }
    await this.writeNote(id, newContent);
  }

  // ── Tasks ──

  async getGlobalTasks(): Promise<TaskInfo[]> {
    await ensureWasmLoaded();
    const notes = await this.getAllActiveNotes();
    const allTasks: TaskInfo[] = [];

    for (const n of notes) {
      try {
        const tasks = wasm_parse_tasks_from_content(n.content, n.id) || [];
        allTasks.push(...tasks);
      } catch {
        // Fallback simple task parser
        const lines = n.content.split('\n');
        lines.forEach((line, idx) => {
          const match = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
          if (match) {
            allTasks.push({
              note_id: n.id,
              line_number: idx,
              content: match[3],
              completed: match[2].toLowerCase() === 'x',
              assignees: [],
              tags: [],
              raw_line: line,
            });
          }
        });
      }
    }

    return allTasks;
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
    const notes = await this.getAllActiveNotes();
    const allDecisions: DecisionInfo[] = [];

    for (const n of notes) {
      try {
        const decisions = wasm_parse_decisions_from_content(n.content, n.id) || [];
        allDecisions.push(...decisions);
      } catch {
        // Fallback decision parser
        const lines = n.content.split('\n');
        lines.forEach((line, idx) => {
          const match = line.match(/^(\s*)-\s*\[D\]\s*(.*)$/);
          if (match) {
            allDecisions.push({
              note_id: n.id,
              line_number: idx,
              content: match[2],
              participants: [],
              approved_by: [],
              tags: [],
              raw_line: line,
            });
          }
        });
      }
    }

    return allDecisions;
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
    const notes = await this.getAllActiveNotes();
    const backlinks: BacklinkInfo[] = [];

    for (const n of notes) {
      if (n.id === targetNoteId) continue;
      try {
        const found = wasm_find_backlinks(n.content, n.id, targetNoteId);
        if (Array.isArray(found)) {
          backlinks.push(...found);
        }
      } catch {
        // Regex fallback
        const lines = n.content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes(`[[${targetNoteId}]]`) || line.includes(`](${targetNoteId})`)) {
            backlinks.push({
              source_note_id: n.id,
              snippet: line.trim(),
              line_number: idx + 1,
            });
          }
        });
      }
    }

    return backlinks;
  }

  // ── Assets / Images ──

  async saveImageBytes(relativeNoteId: string, fileName: string, bytes: Uint8Array): Promise<string> {
    const noteFolder = relativeNoteId ? extractFolderFromId(relativeNoteId) : '';
    const assetPath = noteFolder ? `${noteFolder}/_assets/${fileName}` : `_assets/${fileName}`;

    const db = await this.getDb();
    const record: DbAssetRecord = {
      path: assetPath,
      fileName,
      bytes,
      mimeType: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSETS, 'readwrite');
      tx.objectStore(STORE_ASSETS).put(record);
      tx.oncomplete = () => {
        // Invalidate object URL cache if present
        if (this.assetUrlCache.has(assetPath)) {
          URL.revokeObjectURL(this.assetUrlCache.get(assetPath)!);
          this.assetUrlCache.delete(assetPath);
        }
        resolve(assetPath);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveTextAsset(relativeNoteId: string, fileName: string, content: string): Promise<string> {
    const bytes = new TextEncoder().encode(content);
    return this.saveImageBytes(relativeNoteId, fileName, bytes);
  }

  async readTextAsset(relativePath: string): Promise<string> {
    const bytes = await this.getImageBytes(relativePath);
    return new TextDecoder().decode(bytes);
  }

  async getImageDataUrl(relativePath: string): Promise<string> {
    const cleanPath = relativePath.replace(/^\/+|\/+$/g, '');
    if (this.assetUrlCache.has(cleanPath)) {
      return this.assetUrlCache.get(cleanPath)!;
    }

    const bytes = await this.getImageBytes(cleanPath);
    const mime = cleanPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const blob = new Blob([bytes as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    this.assetUrlCache.set(cleanPath, url);
    return url;
  }

  async getImageBytes(relativePath: string): Promise<Uint8Array> {
    const cleanPath = relativePath.replace(/^\/+|\/+$/g, '');
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSETS, 'readonly');
      const req = tx.objectStore(STORE_ASSETS).get(cleanPath);

      req.onsuccess = () => {
        const record = req.result as DbAssetRecord | undefined;
        if (record && record.bytes) {
          resolve(record.bytes);
        } else {
          // If not found in assets, try vault_files
          this.readVaultFile(cleanPath)
            .then((text) => resolve(new TextEncoder().encode(text)))
            .catch(() => reject(new Error(`Asset not found: ${cleanPath}`)));
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async resolveAssetUrl(_currentNoteId: string, assetPath: string): Promise<string> {
    return this.getImageDataUrl(assetPath);
  }

  // ── Generic Vault Files (.han_history, .han_sync_metadata.json, configs) ──

  async readVaultFile(relativePath: string): Promise<string> {
    const cleanPath = relativePath.replace(/^\/+|\/+$/g, '');
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VAULT_FILES, 'readonly');
      const req = tx.objectStore(STORE_VAULT_FILES).get(cleanPath);

      req.onsuccess = () => {
        const record = req.result as DbVaultFileRecord | undefined;
        if (record) {
          resolve(record.content);
        } else {
          reject(new Error(`Vault file not found: ${cleanPath}`));
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async writeVaultFile(relativePath: string, content: string): Promise<void> {
    const cleanPath = relativePath.replace(/^\/+|\/+$/g, '');
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VAULT_FILES, 'readwrite');
      const record: DbVaultFileRecord = {
        path: cleanPath,
        content,
        updatedAt: Date.now(),
      };
      tx.objectStore(STORE_VAULT_FILES).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async vaultFileExists(relativePath: string): Promise<boolean> {
    try {
      await this.readVaultFile(relativePath);
      return true;
    } catch {
      return false;
    }
  }
}
