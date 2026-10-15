# Contributing to H.A.N. (Hierarchical Adaptive Notebook)

Thank you for your interest in contributing to **H.A.N.**! This document provides guidelines and setup instructions for developing, testing, and submitting contributions.

---

## 🛠️ Prerequisites

- **Node.js** `>= 20` (v22 LTS recommended)
- **Rust** (stable toolchain via [rustup.rs](https://rustup.rs/))
- **wasm-pack** (for compiling `han-core` to WebAssembly):
  ```bash
  cargo install wasm-pack
  rustup target add wasm32-unknown-unknown
  ```

---

## 🚀 Local Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/han-notes-app.git
   cd han-notes-app
   ```

2. **Install JavaScript dependencies:**
   ```bash
   npm install
   ```

3. **Build the Rust/WASM core (`han-core`):**
   ```bash
   npm run build:wasm
   ```

4. **Start the development server (Web / PWA):**
   ```bash
   npm run dev
   ```

5. **Run the native desktop app (Tauri v2):**
   ```bash
   npm run tauri dev
   ```

---

## 🧪 Testing & Quality Checks

Before opening a Pull Request, please ensure all checks pass locally:

```bash
# 1. Run linter (Oxlint)
npm run lint

# 2. Run TypeScript type checker
npx tsc -b

# 3. Run unit tests (Vitest)
npm test

# 4. Run Rust workspace tests (han-core + src-tauri)
cargo test --workspace
```

---

## 🏗️ Architecture Overview

H.A.N. uses an isomorphic storage architecture (`IStorageService` in `src/services/storage/types.ts`) with three backends:
- **`TauriStorage.ts`** — Native desktop filesystem via Rust IPC (`src-tauri/src/lib.rs`)
- **`BrowserStorage.ts`** — Chromium File System Access API
- **`IndexedDBStorage.ts`** — Universal browser IndexedDB storage (Safari, Firefox, iOS, Android, and desktop browsers)

Shared Markdown/task/decision/PDF parsing lives in `han-core/src/lib.rs` and compiles to both native Rust (for Tauri) and WebAssembly (`src/wasm/han-core`). When modifying `han-core`, always run `npm run build:wasm` and `cargo test --workspace`.

---

## 🔄 Pull Request Process

1. Create a descriptive feature or bugfix branch (`feat/short-description` or `fix/issue-number`).
2. Keep pull requests focused on a single concern.
3. Add or update unit tests for new functionality or bug fixes.
4. If adding user-facing strings, add keys to both `src/locales/en.json` and `src/locales/tr.json`.
5. Ensure CI checks (`lint`, `tsc`, `vitest`, `cargo test`) pass.

By contributing to H.A.N., you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
