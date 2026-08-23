# How We Embedded Full Vector Diagrams Inside PNG Metadata Without Sidecar JSON Files

*A zero-clutter approach to visual note-taking using PNG tEXt chunks, LZ-compression, and standard Markdown.*

---

![alt text](../han.jpeg)


When building **[H.A.N. (Hierarchical Adaptive Notebook)](https://github.com/bishoku/han-notes-app)** — a local-first, privacy-focused Markdown notebook — we faced a major architectural dilemma that plagues almost every visual note-taking app: **How do you seamlessly integrate complex editable vector diagrams into a plain-text Markdown vault without cluttering the user's filesystem with sidecar JSON files?**

If you have ever used tools that pair an image with a `.json` schema or proprietary file formats, you know the frustration:
- Renaming or moving an image breaks the associated diagram file.
- Your vault directory gets filled with hundreds of ugly `diagram-1.json`, `diagram-1.png`, `sketch-2.json` files.
- Sharing your notes with someone outside your specific app results in broken or uneditable visual elements.

Here is how we solved this problem completely by utilizing standard **PNG `tEXt` metadata chunks** and **LZ-compression** to create 100% self-contained, universally portable, and in-place editable vector images.

---

## 🔍 The Anatomy of a PNG File

Most developers treat PNG files as static raster pixel grids. Under the hood, however, the **PNG Specification (ISO/IEC 15948)** is an extensible, chunk-based binary container format.

A valid PNG file begins with an 8-byte magic signature (`\x89PNG\r\n\x1a\n`) followed by a series of contiguous binary chunks. Each chunk follows a strict 4-part structure:

```
┌──────────────┬──────────────┬─────────────────────────┬──────────────┐
│ Length (4B)  │  Type (4B)   │       Data (N bytes)    │   CRC (4B)   │
└──────────────┴──────────────┴─────────────────────────┴──────────────┘
```

The PNG specification explicitly reserves the **`tEXt` chunk type** for keyword/text metadata strings. Crucially, image viewers, web browsers, operating system file managers, and Markdown renderers simply display the visual raster data (`IDAT` chunks) and **safely ignore ancillary chunks like `tEXt` without corrupting the image**.

---

## 🛠️ The Architecture: Embedding Vector JSON into PNG

When a user creates an architecture flowchart in **YADA** or a freehand whiteboard in **Excalidraw** inside H.A.N., the save pipeline executes the following workflow:

```
┌──────────────────────────┐
│ Vector Model (JSON / UI) │
└─────────────┬────────────┘
              │ 1. Serialize & LZ-String Compress
              ▼
┌──────────────────────────┐
│   Base64 Text Payload    │
└─────────────┬────────────┘
              │ 2. Construct `tEXt` Binary Chunk with CRC32
              ▼
┌──────────────────────────┐
│ Rendered PNG Frame Buffer│ ──► [ 3. Inject after IHDR Chunk ] ──► [ Output .png ]
└──────────────────────────┘
```

### 1. Compressing the Vector State
Complex Excalidraw scenes or multi-node architecture topologies can produce 50KB–500KB of raw JSON. To keep the resulting PNG lightweight, we compress the JSON string using LZ-based base64 encoding before packing it:

```typescript
import LZString from 'lz-string';

const jsonStr = JSON.stringify(vectorSceneData);
const compressedPayload = LZString.compressToBase64(jsonStr);
```

### 2. Crafting the Binary `tEXt` Chunk
A PNG `tEXt` chunk contains a keyword (e.g. `EXCALIDRAW_SKETCH` or `YADA_DIAGRAM`), a single null separator byte (`0x00`), and the text payload, protected by a standard 32-bit Cyclic Redundancy Check (CRC32):

```typescript
function createTextChunk(keyword: string, text: string): Uint8Array {
  const encoder = new TextEncoder();
  const keywordBytes = encoder.encode(keyword);
  const textBytes = encoder.encode(text);

  // Chunk Data: Keyword + null (0x00) + Text Payload
  const dataLength = keywordBytes.length + 1 + textBytes.length;
  const chunkData = new Uint8Array(dataLength);
  chunkData.set(keywordBytes, 0);
  chunkData[keywordBytes.length] = 0;
  chunkData.set(textBytes, keywordBytes.length + 1);

  // Chunk Type: 'tEXt' (0x74, 0x45, 0x58, 0x74)
  const typeBytes = new Uint8Array([0x74, 0x45, 0x58, 0x74]);

  // Compute CRC32 over (Type + Data)
  const crcInput = new Uint8Array(4 + dataLength);
  crcInput.set(typeBytes, 0);
  crcInput.set(chunkData, 4);
  const crc = calculateCrc32(crcInput);

  // Assemble full chunk: Length (4B) + Type (4B) + Data (NB) + CRC (4B)
  const fullChunk = new Uint8Array(4 + 4 + dataLength + 4);
  const view = new DataView(fullChunk.buffer);
  view.setUint32(0, dataLength, false); // Big-endian
  fullChunk.set(typeBytes, 4);
  fullChunk.set(chunkData, 8);
  view.setUint32(8 + dataLength, crc, false);

  return fullChunk;
}
```

### 3. Splicing the Chunk into the PNG Stream
We locate the header chunk (`IHDR`), which always occupies the first 33 bytes of a valid PNG file, and insert our custom `tEXt` chunk immediately after it:

```typescript
export function injectPngMetadata(pngBuffer: ArrayBuffer, keyword: string, data: unknown): Uint8Array {
  const compressed = LZString.compressToBase64(JSON.stringify(data));
  const textChunk = createTextChunk(keyword, compressed);
  const src = new Uint8Array(pngBuffer);

  // Find end of IHDR chunk
  const ihdrLen = new DataView(pngBuffer, 8, 4).getUint32(0, false);
  const ihdrEndOffset = 8 + 4 + 4 + ihdrLen + 4; // 33 bytes

  // Splice into output array
  const output = new Uint8Array(src.length + textChunk.length);
  output.set(src.subarray(0, ihdrEndOffset), 0);
  output.set(textChunk, ihdrEndOffset);
  output.set(src.subarray(ihdrEndOffset), ihdrEndOffset + textChunk.length);

  return output;
}
```

---

## 🔄 Instant In-Place Re-Editing from Live Preview

Because the vector data lives directly inside the image file, interacting with diagrams in the note becomes effortless:

1. In the note, the diagram is inserted with standard Markdown: `![Architecture](assets/diagram-1.png)`.
2. When the user hovers over the image in **Live Preview**, a floating **"Edit Diagram"** badge appears.
3. Clicking the button reads `assets/diagram-1.png`, scans the chunk stream for the `YADA_DIAGRAM` keyword, decompresses the JSON payload, and boots the editor modal with the full vector canvas ready for editing.
4. When saved, the file is overwritten in-place, and the live preview updates immediately.

```typescript
export function extractPngMetadata(pngBuffer: ArrayBuffer, targetKeyword: string): any | null {
  const bytes = new Uint8Array(pngBuffer);
  const view = new DataView(pngBuffer);
  let offset = 8; // Skip 8-byte PNG signature

  while (offset < bytes.length - 8) {
    const chunkLen = view.getUint32(offset, false);
    const chunkType = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));

    if (chunkType === 'tEXt') {
      const dataBytes = bytes.subarray(offset + 8, offset + 8 + chunkLen);
      const nullIdx = dataBytes.indexOf(0);
      const keyword = new TextDecoder().decode(dataBytes.subarray(0, nullIdx));

      if (keyword === targetKeyword) {
        const payload = new TextDecoder().decode(dataBytes.subarray(nullIdx + 1));
        return JSON.parse(LZString.decompressFromBase64(payload) || payload);
      }
    }
    offset += 8 + chunkLen + 4; // Move to next chunk
  }
  return null;
}
```

---

## 🎯 Key Benefits & Takeaways

1. **Zero Filesystem Clutter**: Exactly one `.png` per diagram. No loose sidecars or metadata databases.
2. **100% Portability**: Copying your vault to another computer, checking it into Git, or viewing it on GitHub preserves full visual fidelity.
3. **Cross-Platform Compatibility**: Works identically in the native Tauri desktop app and inside the browser via the File System Access API.
4. **Standard-Compliant**: Passes standard PNG validators without issues.

---

### Explore the Code
H.A.N. is 100% open-source under the MIT license. Check out the complete implementation on GitHub:
👉 **[https://github.com/bishoku/han-notes-app](https://github.com/bishoku/han-notes-app)**
