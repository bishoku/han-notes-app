<div align="center">

<img src="docs/app-icon-128.png" alt="H.A.N." width="128" />

# H.A.N.

**Hierarchical Adaptive Notebook**

*Your thoughts, structured. Your decisions, tracked. Your knowledge, connected.*

[Live Demo](https://bishoku.github.io/han-notes-app/) · [Download macOS App](https://github.com/bishoku/han-notes-app/releases) · [Report Bug](https://github.com/bishoku/han-notes-app/issues)

---

</div>

## ✨ What is H.A.N.?

H.A.N. is a local-first, privacy-focused note-taking app that works both as a **native macOS app** and directly in your **browser**. Your notes live as plain Markdown files on your disk — no cloud, no lock-in, no subscriptions.

Built with the philosophy that your notes should be **yours**, H.A.N. combines the simplicity of Markdown with powerful features like task tracking, decision logging, and bidirectional linking.

## 🖥️ Platforms

| Platform | How | Status |
|----------|-----|--------|
| **macOS** | Native desktop app (Tauri) | ✅ Available |
| **Chrome / Edge / Arc** | [Web app](https://bishoku.github.io/han-notes-app/) via File System Access API | ✅ Available |
| **Safari / Firefox** | Not supported (no File System Access API) | ⛔ |

## 🎯 Features

### 📝 Editor
- **Live Preview** — See formatted Markdown as you type, switch to raw mode anytime
- **Wiki-links** — Connect notes with `[[note-name]]` syntax, auto-complete included
- **Slash Commands** — Type `/` to insert headings, lists, code blocks, images, and more
- **Tables** — Notion-style table editing with add row/column controls
- **Code Blocks** — Syntax highlighting for 100+ languages
- **Image Support** — Drag & drop or paste images directly into notes

### ✅ Tasks
- **Global Task View** — See all tasks across your entire vault in one place
- **Rich Metadata** — Priority, assignees, dates, progress, and tags per task
- **Inline Editing** — Click any task in the editor to edit its metadata
- **Gantt View** — Visualize task timelines (coming soon)

### 📋 Decisions
- **Decision Tracking** — Log decisions with `- [D]` syntax
- **Metadata** — Status, participants, approvers, dates, and tags
- **Global Decision View** — Browse all decisions across notes

### 🔗 Knowledge Graph
- **Backlinks** — See which notes link to the current note
- **Bidirectional Links** — Navigate your knowledge network effortlessly
- **Tag System** — Organize notes with frontmatter tags, filter by tag

### 🗂️ Vault Management
- **Folder Tree** — Organize notes in nested folders with drag & drop
- **File Operations** — Create, rename, move, and delete notes and folders
- **Local Storage** — All data stored as `.md` files in a directory you control

### 🎨 Design
- **macOS-native feel** — Designed to feel at home on macOS
- **Dark & Light Mode** — Follows system preference or manual toggle
- **Multilingual** — English & Turkish (i18n ready for more)

## 🏗️ Architecture

H.A.N. uses an **isomorphic architecture** that runs the same React codebase on both platforms:

```
┌─────────────────────────────────────────────┐
│              React UI (Stores)              │
│         noteStore · taskStore · etc.        │
├─────────────────────────────────────────────┤
│           IStorageService Interface         │
├──────────────────┬──────────────────────────┤
│   TauriStorage   │     BrowserStorage       │
│  (Rust Backend)  │ (File System Access API) │
├──────────────────┤──────────────────────────┤
│   han-core (Rust)│  han-core (WASM-ready)   │
│  Pure logic crate│  Same logic, web target  │
└──────────────────┴──────────────────────────┘
```

- **`han-core/`** — Shared Rust crate with pure logic (Markdown parsing, task extraction, etc.), compilable to both native and WASM
- **`TauriStorage`** — Desktop: calls Rust backend via Tauri IPC
- **`BrowserStorage`** — Web: reads/writes files via File System Access API

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) ≥ 20
- [Rust](https://rustup.rs/) (for desktop app only)

### Development

```bash
# Clone the repo
git clone https://github.com/bishoku/han-notes-app.git
cd han-notes-app

# Install dependencies
npm install

# Run in browser (web mode)
npm run dev

# Run as desktop app (Tauri)
npm run tauri dev
```

### Build

```bash
# Build web version (for GitHub Pages / static hosting)
npm run build

# Build macOS app (.dmg)
npm run tauri build
```

## 📁 Project Structure

```
han-notes-app/
├── han-core/                 # Shared Rust crate (WASM-ready)
│   └── src/lib.rs            # Pure logic: parsing, structs, WASM bindings
├── src-tauri/                # Tauri desktop backend
│   └── src/lib.rs            # I/O commands: file read/write, vault scanning
├── src/                      # React frontend
│   ├── components/           # UI components
│   ├── editor/               # CodeMirror plugins & widgets
│   ├── services/storage/     # Platform-agnostic storage layer
│   │   ├── types.ts          # IStorageService interface
│   │   ├── TauriStorage.ts   # Desktop implementation
│   │   ├── BrowserStorage.ts # Browser implementation
│   │   └── index.ts          # Auto-detection & export
│   ├── store/                # Zustand state management
│   └── layouts/              # App layout
└── .github/workflows/        # CI/CD (Pages deploy + macOS build)
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Zustand |
| **Editor** | CodeMirror 6, custom live preview plugins |
| **Styling** | Tailwind CSS 4, Lucide icons, Geist font |
| **Desktop** | Tauri 2, Rust |
| **Core Logic** | Rust (WASM-ready via `wasm-bindgen`) |
| **Browser Storage** | File System Access API |
| **CI/CD** | GitHub Actions |

## 📄 License

MIT © [bishoku](https://github.com/bishoku)

---

<div align="center">

**H.A.N.** — *Because your notes deserve better.*

</div>
