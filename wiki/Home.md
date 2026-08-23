# Welcome to H.A.N. (Hierarchical Adaptive Notebook)

<div align="center">
  <img src="https://raw.githubusercontent.com/bishoku/han-notes-app/main/docs/app-icon-128.png" alt="H.A.N. Logo" width="128" />
  <h3>Your thoughts, structured. Your decisions, tracked. Your knowledge, connected.</h3>
  <p>
    <strong>A local-first, privacy-respecting, extensible knowledge operating system for thinkers, builders, and teams.</strong>
  </p>
</div>

---

## 🌟 What is H.A.N.?

**H.A.N.** (**H**ierarchical **A**daptive **N**otebook) is a modern, local-first note-taking and knowledge management platform designed to bridge the gap between simple Markdown editors, visual diagramming tools, task managers, and architecture decision trackers.

Unlike proprietary SaaS tools that lock your thoughts into proprietary databases in the cloud, H.A.N. keeps **100% of your data as standard plain-text Markdown (`.md`) files on your local file system**. You own your data forever.

H.A.N. is available both as a **blazing-fast native macOS desktop application** (powered by Tauri & Rust) and as a **zero-install web application** running directly in Chromium browsers via the modern File System Access API.

---

## 💡 Core Philosophy

1. **Local-First & Future-Proof**: All notes, metadata, tasks, decisions, and diagrams are stored in transparent, open formats (Markdown with YAML frontmatter and standard HTML comments) on your storage device.
2. **Dual-Engine Visual Power**: Effortlessly mix deep textual documentation with visual diagrams (YADA architecture models, Excalidraw whiteboards, and Mermaid diagrams).
3. **Actionable Knowledge**: Turn static notes into an active workflow engine with global task aggregation, interactive Gantt timelines, and Architecture Decision Records (ADRs).
4. **Connected Thinking**: Bidirectional wiki-links (`[[note]]`), automatic backlinks, and an interactive Cytoscape knowledge graph let you discover connections organically.
5. **Private & Local-First AI**: Integrated AI assistant and Hybrid Search with local vector embeddings running in your browser/desktop using WebWorkers and ONNX. No sensitive notes sent to third-party vector databases.
6. **Built-in Time Machine**: Native Git versioning lets you track every edit, view visual diffs, and restore any note to any point in time with one click.

---

## 🧭 Feature Matrix

| Feature Domain | Capabilities |
| :--- | :--- |
| **📝 Editor** | Live Preview & Raw CodeMirror 6 editor, Slash Commands (`/`), Notion-style tables, Callout alerts (`[!NOTE]`, `[!WARNING]`, `[!TIP]`), Code blocks with 100+ languages syntax highlighting, Resizable images, Emoji autocomplete (`:smile:`). |
| **📐 Diagrams & Sketches** | Embedded **YADA** (architecture & system flowcharts), embedded **Excalidraw** (freehand whiteboard & sketching), **Mermaid** diagrams, portable PNGs with embedded editable `tEXt` vector metadata. |
| **✅ Task Management** | Standard Markdown checklists (`- [ ]`), rich metadata (Priority, Multi-Assignees, Start/End Dates, Progress %, Tags), Inline editor modal, Global Task list, Filters, interactive **Gantt timeline view**. |
| **📋 Decisions (ADR)** | Architecture Decision tracking (`- [D]`), status tracking (Approved, Draft/Pending, Deferred), Participants, Approvers, Timeline & Grid view, Analytics & Metrics cards. |
| **🔗 Knowledge Graph** | Wiki-links (`[[note-name]]`), automatic backlink aggregation, interactive Cytoscape knowledge graph / mindmap with force-directed physics layout (`fcose`). |
| **🤖 AI & Semantic RAG** | On-device embedding generation via WebWorker (`all-MiniLM-L6-v2`), IndexedDB vector database, note-scoped and global chat sessions, attached note context, streaming responses with `<think>` reasoning extraction. |
| **🔍 Search** | Quick modal (`Cmd/Ctrl+K`), Hybrid Search (Full-Text Search + Semantic Vector embeddings), Real-time note preview. |
| **⏳ Git Versioning** | Integrated Git engine (Tauri native & `isomorphic-git` for web), auto-commit snapshots, visual line diffs, note-level rollback time machine, remote sync (GitHub / GitLab). |
| **🗂️ Vault Management** | Multi-level folder tree, drag-and-drop file organization, tag management, fast vault switching. |
| **🎨 Customization** | 6 built-in themes (Light, Dark, Nord, Dracula, Synthwave, Retro), adjustable typography scale, Multilingual UI (English & Turkish). |

---

## 📚 Wiki Navigation

Explore the complete documentation pages below:

### 🚀 Getting Started & Fundamentals
- [[Getting Started|Getting-Started]]: Installation, platform support, vault setup, and keyboard shortcuts.
- [[Editor & Markdown Guide|Editor-&-Markdown]]: Full guide to Live Preview, slash commands, callouts, tables, and formatting.
- [[Vault & File Management|Vault-&-File-Management]]: Folder structures, drag-and-drop, tagging, and storage internals.

### 🎨 Visuals & Creativity
- [[Visual Diagramming & Sketching|Visual-Diagramming-&-Sketching]]: YADA architecture diagrams, Excalidraw sketches, Mermaid flowcharts, and portable PNGs.

### 📊 Productivity & Knowledge Systems
- [[Task Management & Gantt|Task-Management]]: Checklist syntax, task metadata, global task tracking, and Gantt charts.
- [[Decision Tracking (ADR)|Decision-Tracking]]: Documenting decisions, tracking approval status, timeline views, and metrics.
- [[Knowledge Graph & Mindmap|Knowledge-Graph-&-Mindmap]]: Wiki-links, backlinks, graph exploration, and node navigation.

### 🧠 Intelligence & Version Control
- [[AI Assistant & Local RAG|AI-Assistant-&-RAG]]: Configuring LLM providers, local vector embeddings, thinking processes, and chat sessions.
- [[Search & Navigation|Search-&-Navigation]]: Quick search, hybrid search (keyword + semantic), and note previewing.
- [[Git Versioning & Time Machine|Git-Versioning-&-Sync]]: Commit history, visual diffs, note rollback, and remote sync.

### ⚙️ Customization & Technical Reference
- [[Settings & Customization|Settings-&-Customization]]: Themes, typography, languages, and custom configurations.
- [[Architecture & Development|Architecture-&-Development]]: Rust crate (`han-core`), WebAssembly, Tauri backend, React 19 architecture, and build guide.

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/bishoku">bishoku</a> and the open-source community.</sub>
</div>
