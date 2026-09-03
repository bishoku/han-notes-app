# PDF Workflows & Research Guide

H.A.N. provides a dedicated, research-grade PDF workflow designed for researchers, engineers, academics, and avid readers. You can import documents into your vault, extract structured summaries with local/cloud AI, read PDFs side-by-side with your Markdown notes, and capture page-referenced citations with a single click.

---

## 🚀 Overview of Capabilities

```
┌─────────────────────────┐          ┌─────────────────────────┐
│     PDF Document        │          │   Active Markdown Note  │
│  (in .attachments/)     │          │                         │
│                         │          │ # Research Analysis     │
│  "Decentralized storage │  Select  │                         │
│   allows nodes to..."   │ ───────> │ > [!QUOTE]              │
│                         │   Quote  │ > Decentralized storage │
│  [Page 8 / 42]          │          │ > allows nodes to...    │
│                         │ <─────── │ >                       │
│                         │   Click  │ > — [[paper.pdf#page=8]]│
└─────────────────────────┘   Link   └─────────────────────────┘
```

1. **Smart PDF Import**: Choose destination folders, archive the original PDF to `.attachments/`, and generate linked Markdown notes automatically.
2. **AI-Powered Structured Extraction**: Convert dense PDFs into structured study notes with executive summaries, key takeaways, and YAML frontmatter tags.
3. **Academic Multi-Column Flow (Rust / WASM)**: Merge two-column research papers and fix broken line wraps using the high-performance `han-core` engine.
4. **Side-by-Side Split Reader**: Read PDFs in an interactive, resizable pane right next to your Markdown editor.
5. **Smart Quote Callouts (`> [!QUOTE]`)**: Select any passage in the PDF and click **Nota Alıntı Ekle** to insert cleaned, de-hyphenated callouts with exact page references.
6. **Bidirectional Deep Linking (`#page=X`)**: Click any PDF page link inside your notes to instantly jump to that exact page in the viewer.
7. **Native PDF Export**: Print or export formatted Markdown notes to paginated PDFs with professional typography.

---

## 📥 1. Importing PDFs

### How to Import a PDF
1. In the left sidebar, click the **+ PDF İçe Aktar** (or **+ Import PDF**) button, or right-click any folder in the vault tree and select **PDF İçe Aktar**.
2. In the import dialog:
   - **Target Folder**: Select the destination folder in your vault (e.g. `Research/Papers`) or create a new subfolder inline.
   - **PDF Source**: Drag and drop your `.pdf` file or click to browse.
   - **Note Title**: Provide a title for the generated Markdown note (defaults to the PDF filename).

### Storage & Archival Architecture
When a PDF is imported:
- The original PDF file is saved inside a hidden `.attachments/` folder within the selected target directory (e.g. `Research/Papers/.attachments/PaperTitle.pdf`).
- The newly created Markdown note is placed right next to it (e.g. `Research/Papers/PaperTitle.md`).
- A reference link `[[Research/Papers/.attachments/PaperTitle.pdf]]` is embedded into the note, establishing a permanent two-way link between the Markdown note and the original document.

### Import Processing Modes

| Mode | Processing Engine | Best For |
| :--- | :--- | :--- |
| **Doğrudan Metin Çıkarımı (Direct Extraction)** | Built-in PDF.js parser | Fast ingestion, extracting raw pages with a table of contents and per-page sections. |
| **Akıllı Yapay Zeka Özeti (AI Structured)** | Integrated AI / LLM engine | Dense reports, textbooks, and long papers. Creates executive summaries, key concept breakdowns, and tag suggestions. |
| **Çift Sütun & Akademik Düzenleme (Two-Column Flow)** | `han-core` (Rust / WASM) | Academic papers and conference proceedings formatted in two columns. Automatically de-hyphenates words and reconstructs natural reading order. |

Once import completes, H.A.N. automatically opens the newly generated Markdown note in the editor.

---

## 📖 2. Side-by-Side Split Reader

You can open any PDF in the split reader at any time:
- Click on any PDF wiki-link in your notes (e.g. `[[path/to/paper.pdf]]` or `[[paper.pdf#page=4]]`).
- Right-click an attachment in the sidebar and choose **Bölünmüş Ekranda Aç** (Open in Split View).

### Reader Features
- **Resizable Split Pane**: Drag the divider handle on the right edge of the PDF viewer to adjust the reading width to your liking.
- **Retina / HiDPI Crisp Rendering**: The canvas engine detects your screen's `window.devicePixelRatio` (e.g. 2x on Mac Retina) to render vector-sharp text without blurriness.
- **Page Navigation & Zoom**:
  - Use the top navigation bar to step through pages or jump directly to a page number.
  - Zoom controls allow scaling between 75% and 250% for comfortable reading.
- **Context-Aware Lifecycle**: When you switch to a different note in your vault, the PDF split viewer closes automatically so your workspace stays uncluttered.

---

## ✍️ 3. One-Click Citations & Quote Callouts

Taking notes while reading is friction-free:

1. **Select Text**: Highlight any word, sentence, or multi-line paragraph in the PDF.
2. **Click the Floating Pill**: A floating badge labeled **Nota Alıntı Ekle** (*Add Quote to Note*) appears immediately below your selection.
3. **Automatic Insertion & Formatting**:
   - The selected text is processed through `formatPdfQuote`:
     - Hard line breaks within sentences are joined into fluid paragraphs.
     - Hyphenated words across line ends (e.g. `distri-\nbuted`) are reconstructed (`distributed`).
     - Every single line is prefixed with `> ` to prevent multi-line quotes from leaking outside the callout block.
   - The quote is formatted as a GitHub-style `> [!QUOTE]` callout block and inserted at your cursor position (or appended to the end of the note):

```markdown
> [!QUOTE] Alıntı
> Distributed consensus allows heterogeneous nodes to agree on a single data state without a centralized authority.
>
> — [[Research/.attachments/raft-consensus.pdf#page=12]]
```

4. **Live Preview Rendering**: In the Markdown editor's Live Preview mode, the callout renders as a dedicated quotation card with a purple accent border and an active link back to the document.

---

## 🔗 4. Deep Page Linking (`#page=X`)

H.A.N. supports page-level deep linking using standard URI fragment syntax:

```markdown
[[filename.pdf#page=14]]
[[folder/.attachments/book.pdf#page=82|Bölüm 3: Dağıtık Sistemler]]
```

### How Navigation Works:
- Clicking any link containing `#page=X` in your note immediately checks if the reader is already open:
  - If open, it smoothly turns to **Page X** and scrolls the document to the top.
  - If closed, it opens the PDF viewer side-by-side directly at **Page X**.
- Works with both plain PDF links and citation links generated by the quote tool.

---

## 🖨️ 5. Native PDF Export

You can export any Markdown document to a professional PDF:

1. Open the note you want to export.
2. In the top editor header, click the **PDF Dışa Aktar** (Printer icon) button.
3. The system print dialogue opens with H.A.N.'s dedicated print stylesheet:
   - Sidebar, header, navigation controls, and floating toolbars are automatically hidden.
   - Tables, callouts, diagrams, and code blocks are formatted for standard A4 / US Letter pagination.
   - Document title is automatically populated as the default file name.
4. Select **Save as PDF** in your operating system's print dialog.

---

## 🔬 Architecture & Technical Details

- **Rendering Engine**: `pdfjs-dist` (Mozilla PDF.js v4) integrated with custom React canvas & text layers.
- **Sub-Pixel Text Layer**: Synchronized CSS custom properties (`--scale-factor`, `--total-scale-factor`, `--user-unit`) guarantee that every character glyph in the invisible text layer matches the rendered canvas pixel-for-pixel.
- **WASM Text Processor**: The `han-core` Rust crate implements string cleaning, paragraph stitching, and hyphenation resolution, compiled to WebAssembly for instant execution in both desktop and web targets.
