# Search & Navigation

Finding knowledge quickly across thousands of notes is effortless in H.A.N. thanks to **Hybrid Search** (combining traditional keyword matching with semantic AI embeddings) and the **Quick Switcher**.

---

## ⚡ Quick Search Modal (`Cmd+K` / `Ctrl+K`)

Press <kbd>Cmd</kbd> + <kbd>K</kbd> (or <kbd>Ctrl</kbd> + <kbd>K</kbd>) anywhere in H.A.N. to open the **Quick Search Modal**.

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Type note name, tag (#tag), or keyword...                │
├─────────────────────────────────────────────────────────────┤
│ 📄 Architecture/Auth-Spec.md       #security #oauth         │
│    "Implement refresh token rotation with httpOnly cookies" │
│                                                             │
│ 📄 Projects/Roadmap-2026.md        #planning                │
│    "Q3 deliverables: complete local-first RAG integration"  │
│                                                             │
│ 📄 Meeting-Notes/2026-08-20.md     #team #decisions         │
│    "Decision: migrate vector storage to client IndexedDB"   │
└─────────────────────────────────────────────────────────────┘
```

- **Fuzzy Title Matching**: Instantly jump to notes by typing fragments of their title or folder path.
- **Tag Filter**: Type `#` followed by a tag name (e.g. `#architecture`) to narrow down notes.
- **Keyboard Navigation**: Use <kbd>↑</kbd> and <kbd>↓</kbd> arrow keys to select, and <kbd>Enter</kbd> to open. Press <kbd>Esc</kbd> to dismiss.

---

## 🧠 Hybrid Search (Keyword + Semantic Vector Search)

Click **Search** in the left sidebar or select Search View to access the comprehensive **Full-Vault Hybrid Search Engine**.

```
                           User Search Query
                                   │
                  ┌────────────────┴────────────────┐
                  ▼                                 ▼
         BM25 Full-Text Match             Vector Embedding Match
         (Exact words & codes)            (Semantic concepts & intent)
                  │                                 │
                  └────────────────┬────────────────┘
                                   ▼
                       Reciprocal Rank Fusion (RRF)
                                   │
                                   ▼
                         Unified Ranked Results
```

### Why Hybrid Search?
- **Lexical / Keyword Search (BM25)**: Exceptional for finding specific function names, exact acronyms, error codes, and unique terms (e.g. `wasm_bindgen`, `Bug #402`, `RFC-6749`).
- **Semantic Vector Search**: Understands conceptual meaning even when exact words differ (e.g., searching *"how to store user sessions"* retrieves notes on *"JWT cookie authentication"*).
- **Reciprocal Rank Fusion (RRF)**: Merges scores from both engines to deliver the most accurate ranking possible.

---

## 👁️ Real-Time Note Preview Pane

In the Search View, selecting any result in the left list displays a live, formatted preview of the document in the right-hand **Note Preview Pane**:
- Highlights matching keywords and semantic context snippets.
- Displays frontmatter tags and document path.
- Click **Open in Editor** to immediately begin writing or editing.
