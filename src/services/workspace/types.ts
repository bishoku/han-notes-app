/**
 * Workspace Data Models & Platform-Agnostic Types.
 */

export type WorkspaceStorageType = 'browser' | 'indexeddb' | 'tauri';

export interface Workspace {
  /** Unique workspace identifier (e.g. "default", "ws_1725537600_abc") */
  id: string;
  /** Human-readable workspace name (e.g. "Kişisel", "İş Notları") */
  name: string;
  /** Storage backend type */
  storageType: WorkspaceStorageType;
  /** Hex color for UI badge / icon (e.g. "#6366f1") */
  color: string;
  /** Lucide icon name (e.g. "Folder", "Briefcase", "Book", "Sparkles", "Code", "Brain") */
  icon: string;
  /** Creation timestamp in ms */
  createdAt: number;
  /** Last accessed / modified timestamp in ms */
  updatedAt: number;
  /** True if this is the default initial workspace */
  isDefault?: boolean;
  /** Directory name on local disk (for browser FSA) */
  handleName?: string;
  /** Absolute folder path on local disk (for Tauri) */
  folderPath?: string;
}

export interface WorkspaceCreationOptions {
  name: string;
  color?: string;
  icon?: string;
  storageType?: WorkspaceStorageType;
  handleName?: string;
  folderPath?: string;
}
