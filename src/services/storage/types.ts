/**
 * Storage Service Interface — Platform-agnostic contract for all I/O operations.
 * 
 * Both TauriStorage (desktop) and BrowserStorage (PWA/web) implement this interface.
 * The frontend (Zustand stores, components) only depends on this interface,
 * never on platform-specific APIs directly.
 */

// ─── Core Data Types ───────────────────────────────────────────────────────

export interface FileNode {
  name: string;
  relative_path: string;
  is_dir: boolean;
  children: FileNode[];
}

export interface NoteInfo {
  id: string;
  title: string;
  path: string;
  tags: string[];
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface BacklinkInfo {
  source_note_id: string;
  snippet: string;
  line_number: number;
}

export interface TaskInfo {
  note_id: string;
  line_number: number;
  content: string;
  completed: boolean;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  priority?: string | null;
  assignee?: string | null;
  assignees: string[];
  progress?: number | null;
  tags: string[];
  raw_line: string;
}

export interface TaskRegistry {
  assignees: string[];
  tags: string[];
}

export interface DecisionInfo {
  note_id: string;
  line_number: number;
  content: string;
  description?: string | null;
  date?: string | null;
  status?: string | null;
  participants: string[];
  approved_by: string[];
  tags: string[];
  raw_line: string;
}

export interface DecisionRegistry {
  participants: string[];
  approved_by: string[];
  tags: string[];
}

// ─── Storage Service Interface ─────────────────────────────────────────────

export interface IStorageService {
  // ── Vault / File Tree ──
  getVaultFiles(): Promise<NoteInfo[]>;
  getVaultTree(): Promise<FileNode[]>;
  getVaultTags(): Promise<TagCount[]>;

  // ── Note CRUD ──
  readNote(id: string): Promise<string>;
  writeNote(id: string, content: string): Promise<void>;
  createNoteInFolder(parentPath: string, title: string): Promise<void>;
  createFolder(parentPath: string, folderName: string): Promise<void>;
  moveNode(srcRelPath: string, destDirRelPath: string): Promise<void>;
  deleteNode(relativePath: string): Promise<void>;
  renameNode(relativePath: string, newName: string): Promise<void>;
  updateNoteTags(id: string, tags: string[]): Promise<void>;

  // ── Tasks ──
  getGlobalTasks(): Promise<TaskInfo[]>;
  getTaskRegistry(): Promise<TaskRegistry>;
  toggleTask(noteId: string, lineNumber: number, completed: boolean): Promise<void>;
  updateTaskMetadata(
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
  ): Promise<void>;

  // ── Decisions ──
  getGlobalDecisions(): Promise<DecisionInfo[]>;
  getDecisionRegistry(): Promise<DecisionRegistry>;
  updateDecisionMetadata(
    noteId: string,
    lineNumber: number,
    content: string,
    description: string | null,
    date: string | null,
    status: string | null,
    participants: string[],
    approvedBy: string[],
    tags: string[],
  ): Promise<void>;

  // ── Backlinks ──
  getBacklinks(targetNoteId: string): Promise<BacklinkInfo[]>;

  // ── Assets / Images ──
  saveImageBytes(relativeNoteId: string, fileName: string, bytes: Uint8Array): Promise<string>;
  saveTextAsset(relativeNoteId: string, fileName: string, content: string): Promise<string>;
  readTextAsset(relativePath: string): Promise<string>;
  getImageDataUrl(relativePath: string): Promise<string>;
}
