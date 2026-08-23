# Building an Isomorphic Storage Layer for Desktop (Tauri) and Browser (FSA API)

*Write once, run natively everywhere: How we unified Rust filesystem IPC and the browser File System Access API behind a single interface.*

---

![alt text](han2.jpeg)

Building a cross-platform desktop application typically forces a compromise:
- **Option A (Electron)**: High memory usage, large installer sizes (150MB+), and difficult to run on the web without a dedicated backend server.
- **Option B (Pure Web App)**: Locked inside the browser sandbox, unable to access real local directories without clunky import/export ZIP workflows.

When creating **[H.A.N. (Hierarchical Adaptive Notebook)](https://github.com/bishoku/han-notes-app)**, we chose a different path: **An isomorphic architecture that runs natively as a lightweight macOS desktop app (via Tauri and Rust) AND as a zero-install web app (via the Chromium File System Access API) using the exact same React codebase.**

Here is how we designed a unified storage abstraction layer that powers both environments with zero code duplication.

---

## 🏛️ The Architectural Challenge

The desktop and browser environments manage filesystem access in fundamentally different ways:

| Feature | Desktop (Tauri / Rust) | Web (File System Access API) |
| :--- | :--- | :--- |
| **Path Addressing** | Absolute paths (e.g. `/Users/alex/Notes/Doc.md`) | Virtual directory handles (`FileSystemDirectoryHandle`) |
| **File I/O** | Native OS syscalls via Tauri IPC bridge (`std::fs`) | Async handle streams (`getFileHandle`, `createWritable`) |
| **Directory Traversal** | Recursive synchronous/async filesystem scan | Async iterators (`handle.values()`) |
| **Persistence** | Path string stored in config/localStorage | Serialized handle stored in IndexedDB with permission prompt |

Without a clean architectural boundary, UI components would quickly become littered with messy `if (isDesktop) ... else ...` conditional blocks.

---

## 🔌 The `IStorageService` Interface

To achieve complete decoupling, we defined a strict, platform-agnostic interface:

```typescript
// services/storage/types.ts
export interface IStorageService {
  /** Returns the full recursive tree of files and directories */
  getVaultTree(): Promise<FileNode[]>;

  /** Reads raw text content of a note */
  readNote(relativePath: string): Promise<string>;

  /** Writes or updates content of a note */
  writeNote(relativePath: string, content: string): Promise<void>;

  /** Creates a new file */
  createNote(title: string, parentRelPath?: string): Promise<string>;

  /** Creates a new directory */
  createFolder(name: string, parentRelPath?: string): Promise<void>;

  /** Moves or renames a file/directory */
  moveNode(srcRelPath: string, destDirRelPath: string): Promise<void>;
  renameNode(relPath: string, newName: string): Promise<void>;

  /** Deletes a file or directory */
  deleteNode(relPath: string): Promise<void>;

  /** Global task & decision aggregations */
  getGlobalTasks(): Promise<TaskInfo[]>;
  getGlobalDecisions(): Promise<DecisionInfo[]>;
}
```

---

## 🖥️ Implementation 1: `TauriStorage` (Desktop)

In desktop mode, `TauriStorage` communicates with our Rust backend via Tauri’s high-performance IPC bridge:

```typescript
// services/storage/TauriStorage.ts
import { invoke } from '@tauri-apps/api/core';
import type { IStorageService, FileNode } from './types';

export class TauriStorage implements IStorageService {
  async getVaultTree(): Promise<FileNode[]> {
    return await invoke<FileNode[]>('get_vault_tree');
  }

  async readNote(relativePath: string): Promise<string> {
    return await invoke<string>('read_note_file', { relPath: relativePath });
  }

  async writeNote(relativePath: string, content: string): Promise<void> {
    await invoke('write_note_file', { relPath: relativePath, content });
  }
  // ...other operations invoke native Rust backend commands
}
```

On the Rust side (`src-tauri/src/lib.rs`), operations run with native NVMe read/write speeds.

---

## 🌐 Implementation 2: `BrowserStorage` (FSA API)

In the web browser, `BrowserStorage` operates directly against Chromium's `FileSystemDirectoryHandle`. When the user selects a local folder, H.A.N. reads and writes files on their actual hard drive:

```typescript
// services/storage/BrowserStorage.ts
import type { IStorageService, FileNode } from './types';

export class BrowserStorage implements IStorageService {
  private rootHandle: FileSystemDirectoryHandle | null = null;

  async readNote(relativePath: string): Promise<string> {
    const fileHandle = await this.resolveFileHandle(relativePath);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  async writeNote(relativePath: string, content: string): Promise<void> {
    const fileHandle = await this.resolveFileHandle(relativePath, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  private async resolveFileHandle(relPath: string, options?: { create?: boolean }) {
    // Navigates nested directory handles by splitting path: 'docs/api/spec.md'
    const parts = relPath.split('/').filter(Boolean);
    let currentDir = this.rootHandle!;
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i], options);
    }
    return await currentDir.getFileHandle(parts[parts.length - 1], options);
  }
}
```

---

## 🦀 Unified Parsing Engine with `han-core` (Rust + WASM)

While I/O differs between desktop and web, **business logic must remain 100% identical**. 

We extracted all core parsing logic (YAML frontmatter parsing, task regex extraction, ADR decision tracking, and wiki-link resolution) into a shared Rust crate: **`han-core`**.

```
                           han-core (Rust)
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
         Compiled to Native             Compiled to WebAssembly
       (Tauri Desktop Engine)            (wasm-pack for Browser)
```

By compiling `han-core` to both a native Rust library and WebAssembly (`wasm-pack`), both platforms execute the exact same parsing algorithms with zero divergence.

---

## 🚀 Runtime Auto-Detection

The application automatically selects the appropriate storage provider upon initialization:

```typescript
// services/storage/index.ts
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export const storage: IStorageService = isTauriEnvironment()
  ? new TauriStorage()
  : new BrowserStorage();
```

Our Zustand state stores and React UI components interact exclusively with the `storage` singleton:

```typescript
// UI Component or Store — zero platform awareness needed!
const notes = await storage.getVaultTree();
await storage.writeNote('Projects/Roadmap.md', updatedContent);
```

---

## 🎯 Key Takeaways

1. **Write UI Once**: 100% of our React views, Live Preview extensions, diagrams, and task dashboards are completely unaware of whether they are running in Tauri or Chrome.
2. **True Local-First Web App**: Users can use H.A.N. in their browser on any Chromium-powered device without installing software, while keeping all files on their own disk.
3. **Rust-Powered Native Performance**: Desktop users get instant startup, minimal memory footprint (~40MB RAM vs 300MB+ in Electron), and native OS integration.

---

### Check Out the Full Source Code
Explore how H.A.N. implements isomorphic storage on GitHub:
👉 **[https://github.com/bishoku/han-notes-app](https://github.com/bishoku/han-notes-app)**
