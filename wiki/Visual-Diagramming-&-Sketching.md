# Visual Diagramming & Sketching

H.A.N. is equipped with a **dual visual diagramming engine** and **Mermaid support**, turning your notes into rich visual architecture documents and whiteboards.

```
                  ┌────────────────────────────────────────┐
                  │          Visual Engines in H.A.N.      │
                  ├──────────────────┬─────────────────────┤
                  │   📐 YADA        │   ✨ Excalidraw     │
                  │ Architecture, C4 │ Hand-drawn Sketches │
                  │ Flowcharts, DAGs │ Wireframes, Mindmaps│
                  ├──────────────────┴─────────────────────┤
                  │           🔀 Mermaid Diagrams          │
                  │   Sequence, Gantt, Class, State charts │
                  └────────────────────────────────────────┘
```

---

## 💎 Self-Contained Portable PNGs (Zero Clutter)

One of H.A.N.'s standout design innovations is how diagrams and sketches are saved:

1. **Embedded Vector Metadata**: When you save a YADA diagram or Excalidraw sketch, the complete editable JSON vector model is encoded directly inside the standard PNG image file's `tEXt` metadata chunks.
2. **Single File on Disk**: You get one clean `.png` file in your vault's `assets/` directory (e.g. `assets/diagram-1708701234.png`). There are **no separate `.json` or configuration sidecar files** polluting your file tree.
3. **Universally Shareable**: The generated PNG can be viewed in standard image viewers, GitHub previews, Slack, or web browsers, while remaining **100% editable inside H.A.N.**
4. **Seamless Re-editing**: In Live Preview mode, hovering over any embedded diagram or sketch displays a floating **"Edit Diagram" / "Edit Sketch"** button. Clicking it instantly re-opens the native editor modal with the vector canvas loaded.

---

## 📐 YADA Architecture Diagrams (`/diagram`)

[YADA](https://github.com/bishoku/yada) is an embedded visual architecture diagram editor tailored for software engineers, solution architects, and system designers.

### How to Create
1. Type `/diagram` or `/architecture` on a blank line in the editor.
2. The **YADA Architecture Modal** opens in fullscreen/dialog.
3. Add components, services, databases, queues, and draw connected dataflow lines.
4. Customize node colors, labels, icons, group containers, and C4-style boundaries.
5. Click **Save Diagram**. The image is written to `assets/` and inserted into your note:
   ```markdown
   ![Architecture Diagram](assets/diagram-1740324890123.png)
   ```

### Supported Diagram Types
- Microservice & Cloud Architecture topologies (AWS, GCP, Azure, Kubernetes)
- Distributed System Data Pipelines & Event Streams
- C4 Context, Container, and Component Diagrams
- System Flowcharts & Decision Logic Trees

---

## ✨ Excalidraw Whiteboard & Sketching (`/sketch`)

[Excalidraw](https://github.com/excalidraw/excalidraw) is a virtual collaborative whiteboard tool that lets you easily sketch diagrams that have a hand-drawn feel.

### How to Create
1. Type `/sketch` or `/whiteboard` on a blank line.
2. The **Excalidraw Modal** opens with complete drawing tools:
   - Freehand brush, rectangle, ellipse, diamond, arrows, and line tools
   - Hand-drawn styling, stroke width, fill patterns, and color palettes
   - Text labels, sticky notes, and frame groupings
   - Canvas zoom, pan, grid view, and laser pointer
3. Click **Save Sketch** to embed the self-contained PNG into your markdown file:
   ```markdown
   ![Sketch](assets/sketch-1740324901234.png)
   ```

### Use Cases
- Wireframes, UI mockups, and quick user journey maps
- Whiteboard brainstorming sessions and meeting notes
- Visual concept maps and hand-drawn system explanations

---

## 🔀 Mermaid Diagrams (`/mermaid`)

H.A.N. provides native [Mermaid.js](https://mermaid.js.org/) rendering and a dedicated live Mermaid editor modal.

### How to Create
1. Type `/mermaid` to open the **Mermaid Editor Modal** with live syntax validation and templates, or insert a fenced code block directly:
   ````markdown
   ```mermaid
   graph TD
     A[User Client] -->|HTTPS Request| B(API Gateway)
     B --> C{Authenticated?}
     C -->|Yes| D[Core Service]
     C -->|No| E[Auth Service / Login]
     D --> F[(PostgreSQL Database)]
   ```
   ````
2. In Live Preview mode, H.A.N. renders the graph directly in your document with crisp vector rendering matching your active app theme (Light / Dark).

### Supported Mermaid Visualizations
- **Flowcharts** (`graph TD` / `graph LR`)
- **Sequence Diagrams** (`sequenceDiagram`)
- **Class Diagrams** (`classDiagram`)
- **State Diagrams** (`stateDiagram-v2`)
- **Entity Relationship Diagrams** (`erDiagram`)
- **User Journey Maps** (`journey`)
- **Git Graphs** (`gitGraph`)

---

## ⚡ Lazy-Loading & Performance

Both Excalidraw and YADA are large visual drawing suites. To guarantee that H.A.N. launches instantly and uses minimal memory:
- Visual engines are **dynamically code-split and loaded on-demand** only when a user opens a diagram editor or requests a sketch session.
- Diagram PNGs in the Live Preview are cached as standard high-performance images.
