# Getting Started with H.A.N.

This guide covers installing H.A.N., setting up your local vault, understanding platform support, and mastering the essential keyboard shortcuts.

---

## 🖥️ Platform Support & Installation

H.A.N. is designed as a hybrid platform that functions seamlessly both as a native desktop application and directly inside web browsers.

| Platform | Type | Requirements | Where to Get |
| :--- | :--- | :--- | :--- |
| **macOS** | Native Desktop App (Tauri) | macOS 11.0+ (Apple Silicon & Intel) | [GitHub Releases](https://github.com/bishoku/han-notes-app/releases) |
| **Chromium Browsers** (Chrome, Edge, Arc, Brave) | Web App (Direct Disk Access) | File System Access API support | [Live Web App](https://bishoku.github.io/han-notes-app/) |
| **PWA (Progressive Web App)** | Installable Web App | Chromium browser | Click "Install App" in browser URL bar |
| **Safari / Firefox** | Unsupported | Missing native File System Access API | Use desktop app or Chromium |

### Installing the macOS App
1. Download the latest `.dmg` installer from the [Releases](https://github.com/bishoku/han-notes-app/releases) page.
2. Open the `.dmg` file and drag `H.A.N.` into your `Applications` folder.
3. Launch `H.A.N.`. On first launch, macOS Gatekeeper may prompt you to confirm opening the application.

### Using the Web Version
1. Navigate to [https://bishoku.github.io/han-notes-app/](https://bishoku.github.io/han-notes-app/) in Chrome, Edge, Arc, or Brave.
2. Click **Open Vault** (or select a local folder).
3. Grant permission for the browser to read and write to your chosen directory.
4. *Tip:* You can install H.A.N. as a PWA by clicking the install icon in your browser's omnibox for an app-like windowed experience with offline support.

---

## 📁 Setting Up Your Vault

A **Vault** in H.A.N. is simply a standard folder on your computer's file system containing Markdown (`.md`) files, subdirectories, and media assets.

### Creating or Opening a Vault
1. Launch H.A.N.
2. If no vault is active, you will be prompted with the **Welcome Screen**.
3. Click **Select Folder** / **Open Vault**.
4. Choose an existing folder (such as an Obsidian vault, a documentation folder, or a Git repository) or create an empty directory (e.g., `~/Documents/MyNotes`).
5. H.A.N. will instantly index the directory tree, parse note tags, aggregate tasks, extract decisions, and render your notes.

### Switching Vaults
You can switch workspaces at any time:
- Click the **Vault Name / Switch** icon at the top of the sidebar.
- Choose a different directory on your disk.

---

## ⌨️ Essential Keyboard Shortcuts

H.A.N. is built for keyboard-driven efficiency. Below are the primary hotkeys:

| Shortcut (macOS) | Shortcut (Win/Linux) | Action |
| :--- | :--- | :--- |
| <kbd>Cmd</kbd> + <kbd>K</kbd> | <kbd>Ctrl</kbd> + <kbd>K</kbd> | Open Quick Search & Note Switcher |
| <kbd>Cmd</kbd> + <kbd>S</kbd> | <kbd>Ctrl</kbd> + <kbd>S</kbd> | Force Save & Git Snapshot |
| <kbd>Cmd</kbd> + <kbd>B</kbd> | <kbd>Ctrl</kbd> + <kbd>B</kbd> | Toggle Left Sidebar |
| <kbd>/</kbd> (in empty line) | <kbd>/</kbd> (in empty line) | Trigger Slash Command Menu |
| <kbd>[</kbd><kbd>[</kbd> | <kbd>[</kbd><kbd>[</kbd> | Trigger Wiki-link Autocomplete |
| <kbd>:</kbd> (e.g. `:rocket:`) | <kbd>:</kbd> | Trigger Emoji Autocomplete |
| <kbd>Cmd</kbd> + <kbd>E</kbd> | <kbd>Ctrl</kbd> + <kbd>E</kbd> | Toggle Preview / Raw Markdown Mode |
| <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> | Toggle AI Assistant Drawer |
| <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd> | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd> | Open Note Git History (Time Machine) |
| <kbd>Esc</kbd> | <kbd>Esc</kbd> | Close Active Modal / Drawer / Menu |

---

## 🧭 Interface Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│ [≡] Vault: My Project    [🔍 Search (Cmd+K)]        [Theme] [AI] [Git] │
├───────────────┬───────────────────────────────────────────┬────────────┤
│ 📂 Explorer   │ 📝 Main Editor (Live Preview / Raw)       │ 🤖 AI /    │
│  ├── 📁 Docs  │    Title & Frontmatter Tags               │    History │
│  └── Note.md  │    ------------------------------------   │    Drawer  │
│               │    Markdown content with embedded widgets │            │
│ 📊 Views      │    (Tables, Callouts, Diagrams, Tasks)    │            │
│  • Notes      │                                           │            │
│  • Tasks      │                                           │            │
│  • Decisions  ├───────────────────────────────────────────┤            │
│  • Mindmap    │ 🔗 Backlinks & Word Count                 │            │
└───────────────┴───────────────────────────────────────────┴────────────┘
```

1. **Sidebar (Left)**: Contains the File Tree Explorer, View Switcher (Notes, Tasks, Decisions, Mindmap, Search), Tag Filter, and Git Status Bar.
2. **Main Editor (Center)**: Features dual-mode editing (Live Preview & Raw Markdown), breadcrumb navigation, tag bar, and footer with word count, reading time, and backlinks.
3. **Right Drawer (Collapsible)**: Holds the AI Assistant Chat and the Git Time Machine Diff Viewer.

---

## ⏭️ Next Steps
- Learn all formatting options in the [[Editor & Markdown Guide|Editor-&-Markdown]].
- Create interactive diagrams in [[Visual Diagramming & Sketching|Visual-Diagramming-&-Sketching]].
- Track project action items in [[Task Management & Gantt|Task-Management]].
