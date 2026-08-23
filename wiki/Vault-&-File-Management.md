# Vault & File Management

H.A.N. operates directly on standard folders on your hard drive. There is no hidden binary database or proprietary sync format. This guide covers file organization, folder hierarchies, drag-and-drop operations, and storage architecture.

---

## 🗂️ Folder Structure & File Organization

Inside your vault, H.A.N. mirrors your local folder structure as a clean nested tree in the left sidebar:

```
MyVault/
├── .git/                      # Local Git repository (optional)
├── assets/                    # Images, YADA diagrams, Excalidraw sketches
│   ├── diagram-174032.png
│   └── sketch-174033.png
├── Architecture/
│   ├── Auth-Spec.md
│   └── Storage-Engine.md
├── Projects/
│   └── Roadmap-2026.md
└── Welcome.md
```

### Supported File Operations
- **Create Note**: Click the `+ Note` icon in the sidebar or right-click any folder.
- **Create Folder**: Click the `+ Folder` icon to add nested subfolders.
- **Rename**: Right-click any file/folder or click the options menu to rename. Wiki-links referencing the old path update automatically.
- **Move / Drag & Drop**: Drag files and drop them into target folders in the tree.
- **Delete**: Right-click to delete notes or directories.

---

## 🏷️ Tagging System & Filters

H.A.N. aggregates all tags from note frontmatter and displays them in the **Tags Explorer** in the sidebar:

- **Tag Badges**: Displays the tag name and note count (e.g. `#architecture (14)`).
- **Tag Filtering**: Clicking any tag in the sidebar filters the file tree to only show notes containing that tag. Click again to clear the filter.
- **Tag Editing**: Add or remove tags directly from the Note Header bar above the editor.

---

## 💾 Storage Engine & Isomorphic Architecture

H.A.N. achieves cross-platform consistency by abstracting file system I/O behind the unified `IStorageService` interface:

```
┌─────────────────────────────────────────────────────────────────┐
│                    IStorageService Interface                    │
│   readFile, writeFile, listTree, createFolder, moveNode, etc.  │
├────────────────────────────────┬────────────────────────────────┤
│       TauriStorage (Desktop)   │    BrowserStorage (Web)        │
│       Native Rust I/O via IPC  │    File System Access API      │
├────────────────────────────────┴────────────────────────────────┤
│                     han-core (Rust / WASM)                      │
│     Markdown Parsing, Task Extraction, Decision Extraction      │
└─────────────────────────────────────────────────────────────────┘
```

1. **TauriStorage (Desktop App)**: Direct file system operations via Rust backend commands (`std::fs`), offering raw NVMe speeds and infinite vault capacity.
2. **BrowserStorage (Web App)**: Uses Chromium's `window.showDirectoryPicker()` and `FileSystemDirectoryHandle` to read and write directly to your local folders with zero cloud intermediary.
3. **Rust & WASM Parser (`han-core`)**: Both desktop and web use the exact same Rust parser logic compiled to native code on desktop and WebAssembly on the web, guaranteeing 100% feature and parsing parity.
