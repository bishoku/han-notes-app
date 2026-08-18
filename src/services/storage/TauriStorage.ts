/**
 * TauriStorage — Desktop (Native) storage provider.
 * 
 * Wraps Tauri's `invoke` API to call Rust backend commands.
 * This is the production storage for macOS/Windows/Linux desktop apps.
 */
import { invoke } from '@tauri-apps/api/core';
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

export class TauriStorage implements IStorageService {
  // ── Vault / File Tree ──

  async getVaultFiles(): Promise<NoteInfo[]> {
    return invoke<NoteInfo[]>('get_vault_files');
  }

  async getVaultTree(): Promise<FileNode[]> {
    return invoke<FileNode[]>('get_vault_tree');
  }

  async getVaultTags(): Promise<TagCount[]> {
    return invoke<TagCount[]>('get_vault_tags');
  }

  async getVaultPath(): Promise<string> {
    return invoke<string>('get_vault_path_str');
  }

  async selectVaultFolder(): Promise<string | null> {
    return invoke<string | null>('select_vault_folder');
  }

  // ── Note CRUD ──

  async readNote(id: string): Promise<string> {
    return invoke<string>('read_note', { id });
  }

  async writeNote(id: string, content: string): Promise<void> {
    await invoke('write_note', { id, content });
  }

  async createNoteInFolder(parentPath: string, title: string): Promise<void> {
    await invoke('create_note_in_folder', { parentPath, title });
  }

  async createFolder(parentPath: string, folderName: string): Promise<void> {
    await invoke('create_folder', { parentPath, folderName });
  }

  async moveNode(srcRelPath: string, destDirRelPath: string): Promise<void> {
    await invoke('move_node', { srcRelPath, destDirRelPath });
  }

  async deleteNode(relativePath: string): Promise<void> {
    await invoke('delete_node', { relativePath });
  }

  async renameNode(relativePath: string, newName: string): Promise<void> {
    await invoke('rename_node', { relativePath, newName });
  }

  async updateNoteTags(id: string, tags: string[]): Promise<void> {
    await invoke('update_note_tags', { id, tags });
  }

  // ── Tasks ──

  async getGlobalTasks(): Promise<TaskInfo[]> {
    return invoke<TaskInfo[]>('get_global_tasks');
  }

  async getTaskRegistry(): Promise<TaskRegistry> {
    return invoke<TaskRegistry>('get_task_registry');
  }

  async toggleTask(noteId: string, lineNumber: number, completed: boolean): Promise<void> {
    await invoke('toggle_task', { noteId, lineNumber, completed });
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
    await invoke('update_task_metadata', {
      noteId,
      lineNumber,
      content,
      completed,
      description,
      startDate,
      endDate,
      priority,
      assignee,
      assignees,
      progress,
      tags,
    });
  }

  // ── Decisions ──

  async getGlobalDecisions(): Promise<DecisionInfo[]> {
    return invoke<DecisionInfo[]>('get_global_decisions');
  }

  async getDecisionRegistry(): Promise<DecisionRegistry> {
    return invoke<DecisionRegistry>('get_decision_registry');
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
    await invoke('update_decision_metadata', {
      noteId,
      lineNumber,
      content,
      description,
      date,
      status,
      participants,
      approvedBy,
      tags,
    });
  }

  // ── Backlinks ──

  async getBacklinks(targetNoteId: string): Promise<BacklinkInfo[]> {
    return invoke<BacklinkInfo[]>('get_backlinks', { targetNoteId });
  }

  // ── Assets / Images ──

  async saveImageBytes(relativeNoteId: string, fileName: string, bytes: Uint8Array): Promise<string> {
    const relPath = await invoke<string>('save_image_bytes', {
      relativeNoteId,
      fileName,
      bytes: Array.from(bytes),
    });
    TauriStorage.imageCache.delete(relPath);
    TauriStorage.imageCache.delete(fileName);
    TauriStorage.imageCache.delete(`/${relPath}`);
    return relPath;
  }

  async saveTextAsset(relativeNoteId: string, fileName: string, content: string): Promise<string> {
    return invoke<string>('save_text_asset', {
      relativeNoteId,
      fileName,
      content,
    });
  }

  async readTextAsset(relativePath: string): Promise<string> {
    return invoke<string>('read_text_asset', { relativePath });
  }

  private static imageCache = new Map<string, string>();

  async getImageDataUrl(relativePath: string): Promise<string> {
    if (TauriStorage.imageCache.has(relativePath)) {
      return TauriStorage.imageCache.get(relativePath)!;
    }
    const dataUrl = await invoke<string>('get_image_data_url', { relativePath });
    TauriStorage.imageCache.set(relativePath, dataUrl);
    return dataUrl;
  }

  // ── Generic Vault Files ──

  async readVaultFile(relativePath: string): Promise<string> {
    return invoke<string>('read_text_asset', { relativePath });
  }

  async writeVaultFile(relativePath: string, content: string): Promise<void> {
    await invoke('save_text_asset', { relativeNoteId: '', fileName: relativePath, content });
  }

  async vaultFileExists(relativePath: string): Promise<boolean> {
    try {
      const content = await invoke<string>('read_text_asset', { relativePath });
      return content !== undefined && content !== null;
    } catch {
      return false;
    }
  }
}
