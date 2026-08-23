# Architecture & Developer Guide

This document provides a technical deep-dive into H.A.N.'s architecture, codebase structure, shared Rust logic, build process, and developer workflows.

---

## 🏛️ High-Level System Architecture

H.A.N. is built around an **isomorphic architecture** that shares identical core business logic between desktop and web platforms:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 Frontend Layer                         │
│   CodeMirror 6 Editor · Excalidraw · YADA · Cytoscape · UI Stores      │
├────────────────────────────────────────────────────────────────────────┤
│                       IStorageService Interface                        │
├───────────────────────────────────┬────────────────────────────────────┤
│       Tauri Desktop Runtime       │        Browser Web Runtime         │
│     Tauri IPC & System FS I/O     │    File System Access API (FSA)    │
├───────────────────────────────────┼────────────────────────────────────┤
│         han-core (Native)         │       han-core (WebAssembly)       │
│  Rust crate: parsers, regex, ADRs │    Compiled via wasm-pack & bindgen│
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 📦 Project Structure

```
han-notes-app/
├── Cargo.toml                 # Rust workspace configuration
├── han-core/                  # Shared core logic crate (Native & WASM)
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs             # Fast Markdown, YAML frontmatter, Task & ADR parser
├── src-tauri/                 # Tauri desktop host application
│   ├── Cargo.toml
│   ├── tauri.conf.json        # Window settings, permissions, bundle metadata
│   └── src/
│       ├── main.rs
│       └── lib.rs             # Tauri command handlers for desktop filesystem
├── src/                       # React 19 + TypeScript frontend application
│   ├── components/            # UI components & Views
│   │   ├── ai/                # AI Chat Drawer, Thinking Block, Inline Composer
│   │   ├── decisions/         # Decisions Grid, Timeline, Stats & Analytics
│   │   ├── editor/            # LivePreviewEditor & RawSourceEditor
│   │   ├── git/               # Git History Drawer & Sync Status Bar
│   │   ├── mindmap/           # Cytoscape Graph View & Mindmap Toolbar
│   │   ├── search/            # QuickSearchModal & Hybrid SearchView
│   │   ├── settings/          # Settings Modal & Tabs
│   │   └── tasks/             # Tasks List, Filters & Gantt Chart View
│   ├── editor/                # CodeMirror 6 custom extensions & widgets
│   │   ├── code/              # Syntax highlighter & languages
│   │   ├── mermaid/           # Mermaid renderer & template library
│   │   ├── preview/           # Live preview decorations & event handlers
│   │   ├── widgets/           # Tables, Callouts, Badges, Checkboxes, Images
│   │   └── slashCommands.ts   # Slash command definitions & executors
│   ├── services/              # Platform services
│   │   ├── ai/                # Embedding Worker, VectorStore, RAG & LLM clients
│   │   ├── git/               # BrowserGitService, TauriGitService & Diff engine
│   │   ├── search/            # Hybrid BM25 + Vector search coordinator
│   │   └── storage/           # IStorageService, BrowserStorage, TauriStorage
│   ├── store/                 # Zustand state stores (note, task, decision, ai, git, ui)
│   └── wasm/                  # Compiled WebAssembly artifacts from han-core
└── public/
    └── models/                # Local ONNX embedding models for offline search/RAG
```

---

## 🦀 `han-core` (Rust Crate & WASM)

To ensure high performance across large vaults with thousands of markdown files, heavy parsing tasks are handled in Rust (`han-core/src/lib.rs`):

- `wasm_parse_yaml_frontmatter`: Extracts YAML headers while preserving document bodies.
- `wasm_parse_tasks_from_content`: Fast regex extraction of tasks and JSON comment metadata.
- `wasm_parse_decisions_from_content`: Extracts ADR decisions, status, and stakeholder lists.
- `wasm_find_backlinks`: Scans note contents for target `[[wikilink]]` references.
- `parse_reasoning_blocks`: Extracts `<think>`, `<|thought|>`, and reasoning scratchpads from streaming LLM outputs.

### Compiling WASM
The core crate is compiled to WebAssembly using `wasm-pack`:
```bash
npm run build:wasm
```

---

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js**: ≥ 20.x
- **Rust toolchain**: `rustc` & `cargo` (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **wasm-pack**: `cargo install wasm-pack`

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/bishoku/han-notes-app.git
cd han-notes-app

# 2. Install NPM dependencies
npm install

# 3. Build WASM bindings
npm run build:wasm

# 4. Start Web Development Server (Vite)
npm run dev

# 5. (Optional) Run Native Desktop App (Tauri)
npm run tauri dev
```

---

## 🏗️ Production Builds

### Web Application (for Static Hosting / GitHub Pages)
```bash
npm run build
```
Generates production assets in `dist/`.

### macOS Native Desktop Application (.dmg / .app)
```bash
npm run tauri build
```
Generates native macOS binaries under `src-tauri/target/release/bundle/dmg/`.

---

## 🤝 Contributing & Guidelines

1. **Keep Vault Files Clean**: Do not introduce proprietary syntax that cannot degrade gracefully to standard CommonMark or GitHub Flavored Markdown.
2. **Local-First Always**: Never introduce mandatory cloud dependencies for core features.
3. **Type Safety**: Maintain strict TypeScript typing and run `npm run lint` (`oxlint`) before submitting PRs.
