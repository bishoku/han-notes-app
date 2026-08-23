# Knowledge Graph & Mindmap

H.A.N. allows you to connect your thoughts into an interconnected personal knowledge network (Zettelkasten). Notes are not isolated files in folders; they are interconnected nodes in an interactive graph.

---

## 🔗 Bidirectional Linking & Wiki-Links

Bidirectional linking allows ideas in one note to reference another, creating explicit semantic associations.

### Creating Links
- Type `[[` anywhere in the editor to bring up the **Wiki-link Completion Menu**.
- Pick an existing note or type a new title.
- **Aliased Links**: Use the pipe format `[[Original-Note-Title|Custom Label]]` to change how the link reads in sentence flow.

### Link Navigation
- In Live Preview, clicking a wiki-link instantly opens that note.
- If a linked note does not exist yet, H.A.N. prompts to create it immediately at that target path.

---

## 🔄 Automatic Backlinks Detection

Whenever you open a note, H.A.N. automatically scans the entire vault (accelerated by the Rust core engine) to find all other notes that reference the current note.

- **Backlink Panel**: Located in the **Editor Footer** at the bottom of the active note.
- **Context Snippets**: Each backlink shows the source note title, the line number, and a highlighted text snippet containing the mention.
- **One-Click Jump**: Click any backlink snippet to jump directly to the referring note.

---

## 🌐 Interactive Mindmap & Knowledge Graph View

Click **Mindmap** in the left sidebar to open the full-screen interactive **Cytoscape Graph View**.

```
             (Architecture)
                   │
                   ▼
         ┌──────────────────┐
         │ Core Engine (Rust)│
         └────────┬─────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌──────────────┐     ┌──────────────┐
│ Tauri Bridge │     │ WASM Target  │
└──────────────┘     └──────────────┘
        │                   │
        └─────────┬─────────┘
                  ▼
         ┌──────────────────┐
         │ React UI & State │
         └──────────────────┘
```

### Graph Capabilities
- **Force-Directed Physics Layout (`fcose`)**: Notes naturally cluster around densely linked topics and themes.
- **Node Sizing**: Nodes with higher connectivity (more incoming and outgoing links) dynamically scale in size.
- **Interactive Controls**:
  - **Zoom In / Zoom Out / Fit View**: Center and scale the entire network on screen.
  - **Node Selection Details**: Clicking any node highlights its direct neighbors and opens the **Node Details Drawer** showing connected notes, tags, and summary.
  - **Open Note**: Double-click any node to open the document in the main editor.
  - **Tag Filter**: Filter the graph to display only notes associated with specific tags.
  - **Search in Graph**: Quickly locate specific nodes within large networks of thousands of notes.
