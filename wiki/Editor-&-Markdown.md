# Editor & Markdown Guide

H.A.N. features a hybrid CodeMirror 6 editor with **Live Preview** and **Raw Markdown** modes, allowing you to edit styled documents in-place without distraction.

---

## ⚡ Live Preview vs. Raw Mode

You can toggle between **Live Preview** and **Raw Markdown** using the switch button in the top-right header or by pressing <kbd>Cmd</kbd> + <kbd>E</kbd> (<kbd>Ctrl</kbd> + <kbd>E</kbd>).

- **Live Preview Mode**: Renders headings, bold/italic text, Notion-style tables, task badges, decision pills, callout alerts, code blocks, and diagrams in real-time while remaining fully editable directly with your cursor.
- **Raw Mode**: Displays the pure underlying Markdown syntax with monospaced typography, ideal for precise formatting, frontmatter tweaking, or advanced regex edits.

---

## 🪄 Slash Commands (`/`)

Typing `/` on any blank line opens the **Slash Command Menu**. Use arrow keys or start typing to filter commands, then press <kbd>Enter</kbd> to insert.

```
┌──────────────────────────────────────────────┐
│  Type a command... (/task, /diagram, ...)    │
├──────────────────────────────────────────────┤
│  Format                                      │
│  [H1]  Heading 1       # Large section       │
│  [H2]  Heading 2       ## Medium section     │
│  [H3]  Heading 3       ### Small section     │
│  [💬]  Blockquote      > Quote or reference  │
│  [📊]  Table           Interactive table     │
│  [💻]  Code Block      Syntax highlighting   │
│  [ℹ️]   Note Callout    > [!NOTE] Alert       │
│  [⚠️]  Warning Callout > [!WARNING] Alert    │
│  [💡]  Tip Callout     > [!TIP] Alert        │
│  [➖]  Divider (HR)    --- Horizontal rule   │
│  [😀]  Emoji Picker    Open emoji selector   │
├──────────────────────────────────────────────┤
│  Organization                                │
│  [🏷️]  Tag             Add note tags         │
│  [☑️]  Task Item       - [ ] Checklist item  │
│  [🛡️]  Decision        - [D] Decision record │
├──────────────────────────────────────────────┤
│  Visual & Media                              │
│  [🖼️]  Image           Insert or drag image  │
│  [📐]  Architecture    Open YADA Diagram     │
│  [✨]  Sketch          Open Excalidraw Canvas│
│  [🔀]  Mermaid         Open Mermaid Editor   │
└──────────────────────────────────────────────┘
```

---

## 🎨 Rich Text & Block Formatting

### Headings
```markdown
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
```

### Text Styling
```markdown
**Bold text** or __bold text__
*Italic text* or _italic text_
~~Strikethrough~~
`inline code`
==highlighted text==
```

### Callouts (Alerts)
H.A.N. natively supports GitHub-style callouts with distinct color-coded icons and borders:

```markdown
> [!NOTE]
> Helpful background information, context, or explanation.

> [!TIP]
> Helpful advice, optimizations, or shortcuts.

> [!IMPORTANT]
> Crucial information required for success.

> [!WARNING]
> Warnings about breaking changes or things to avoid.

> [!CAUTION]
> Critical actions that may result in data loss or disruption.
```

In Live Preview, callouts render as styled alert cards with live editable text inside.

---

## 📊 Notion-Style Tables

H.A.N. renders Markdown tables into clean, interactive tables with column headers and alignment support.

```markdown
| Feature | Supported | Notes |
| :--- | :---: | ---: |
| Markdown | Yes | CommonMark + GFM |
| Live Preview | Yes | CodeMirror 6 |
| Local Storage | Yes | Plain .md files |
```

- In Live Preview, tables display clean cell borders, background zebra striping, and alignment according to `:---` (left), `:---:` (center), and `---:` (right).
- Insert a starter table anytime with `/table`.

---

## 💻 Syntax-Highlighted Code Blocks

H.A.N. includes syntax highlighting for **over 100 programming and markup languages** (JavaScript, TypeScript, Rust, Python, Go, C++, SQL, JSON, YAML, Bash, Dockerfile, and many more).

````markdown
```rust
fn calculate_fibonacci(n: u32) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => calculate_fibonacci(n - 1) + calculate_fibonacci(n - 2),
    }
}
```
````

- **Language Badge**: In Live Preview, the language is shown as a floating pill on the top right.
- **Copy Button**: One-click copy for fast clipboard extraction.
- **Dedicated Code Editor Modal**: Use `/code` or click the code block widget to open a dedicated full-featured modal with indentation guides and language selection.

---

## 🖼️ Media & Resizable Images

### Inserting Images
1. **Drag & Drop**: Drag an image file (`.png`, `.jpg`, `.svg`, `.webp`, `.gif`) directly into the editor. It is automatically saved to the vault's assets folder and inserted as `![](assets/image.png)`.
2. **Clipboard Paste**: Copy any image to your clipboard and press <kbd>Cmd</kbd> + <kbd>V</kbd> (<kbd>Ctrl</kbd> + <kbd>V</kbd>).
3. **Slash Command**: Type `/image` to open the file chooser.

### Resizing Images
In Live Preview, images render with interactive resize handles. Drag the corner handle to resize, and the width dimension is preserved in the markdown. Click the image to open it in the **Fullscreen Media Viewer**.

---

## 🔗 Wiki-Links & Autocomplete

Link notes together effortlessly using double brackets `[[note-name]]`:

- Type `[[` anywhere in the editor to open the **Wiki-link Autocomplete Popup**.
- Start typing the name of any note in your vault; press <kbd>Enter</kbd> to insert.
- **Custom Display Text**: Use the pipe character `[[Target Note|Display Title]]` to link to `Target Note` while displaying custom text.
- Clicking any wiki-link in Live Preview immediately navigates to that note. If the target note does not exist, H.A.N. offers to create it automatically.

---

## 😀 Emoji Autocomplete (`:emoji:`)

- Type `:` followed by at least two characters (e.g. `:fire:`, `:rocket:`, `:check:`, `:heart:`, `:brain:`) to open the instant emoji suggestion dropdown.
- Alternatively, type `/emoji` to open the full visual Emoji Category Picker.

---

## 🏷️ YAML Frontmatter & Tags

Notes support YAML frontmatter at the very top of the file for structured metadata:

```markdown
---
tags:
  - architecture
  - backend
  - release-v1
project: Core Engine
author: John Doe
---

# Main Content Starts Here
```

- Tags defined in frontmatter are automatically indexed across the entire vault.
- The **Tag Bar** below the note title in the editor allows adding, editing, or removing tags with auto-completing pill badges.
