# P2P Encrypted Sync & Mobile Companion

H.A.N. features a **zero-backend, local-first, peer-to-peer (P2P) synchronization engine** protected by **End-to-End Encryption (E2EE)**. It allows you to seamlessly synchronize your entire notes vault between your desktop computer and mobile devices (or between two computers) without trusting any cloud provider with your unencrypted data.

---

## 🌟 Core Philosophy & Design Principles

Unlike traditional SaaS note apps that store your notes on central servers in plain text or with provider-managed encryption keys, H.A.N.'s sync engine operates on three unshakeable rules:

1. **Zero-Knowledge Encryption (AES-GCM 256)**: All note contents, paths, tags, tasks, decisions, and sync metadata are encrypted on your device before transmission. No unencrypted payload ever touches the network.
2. **True Peer-to-Peer Data Transfer (WebRTC)**: Data flows directly between your devices over an encrypted WebRTC `RTCDataChannel`. No application server acts as a storage intermediary.
3. **Ephemeral Signaling**: A lightweight WebSocket signaling relay is used solely for the initial WebRTC connection handshake (SDP offer/answer and ICE candidate exchange). The moment the direct P2P data channel opens, the WebSocket connection is **immediately terminated**, dropping server resource utilization to zero.

---

## 🏗️ High-Level Synchronization Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   H.A.N. Desktop / Mobile App                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────┐                         ┌───────────────────────┐
│ Desktop / Tauri /    │                         │ Mobile / Unsupported  │
│ File System Access   │                         │ Fallback (IndexedDB)  │
│ (Raw .md on disk)    │                         │ (han_notes_db)        │
└──────────┬───────────┘                         └───────────┬───────────┘
           │                                                 │
           └────────────────────────┬────────────────────────┘
                                    ▼
                     ┌──────────────────────────────┐
                     │     SyncStorageAdapter       │
                     │ (Canonical Note & Tombstone) │
                     └──────────────┬───────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
   ┌──────────────────────┐                   ┌──────────────────────┐
   │    Web Crypto API    │                   │   Signaling Relay    │
   │  (AES-GCM 256 E2EE)  │                   │ (Cloudflare Worker + │
   │  Ephemeral QR Key    │                   │   Durable Objects)   │
   └───────────┬──────────┘                   └──────────┬───────────┘
               │                                         │
               │        WebSocket Dropped on Open        │
               │  ◄──────────────────────────────────────┤
               ▼                                         ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                 WebRTC P2P DataChannel                          │
   │           16 KiB Framed Packets & Flow Control                  │
   └─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Cryptography & Key Exchange

### 1. Ephemeral 256-Bit AES-GCM Key Generation
When you initiate a sync session on your host device (Desktop), H.A.N. uses the native **Web Crypto API** to generate a cryptographically strong, ephemeral 256-bit symmetric key:
- **Algorithm**: `AES-GCM` with a 256-bit key length.
- **Random IV**: Every individual message transmitted across the DataChannel is encrypted with a unique 12-byte initialization vector (`crypto.getRandomValues(new Uint8Array(12))`).
- **Content Integrity**: Each note payload includes a SHA-256 content hash to detect changes and verify integrity without transferring redundant data.

### 2. Zero-Leakage QR Code Key Exchange
How does the mobile device obtain the decryption key without exposing it to the signaling server or internet?
- The key is exported as a URL-safe Base64 (`base64url`) string.
- It is embedded solely in the URL **hash fragment** of the pairing link:
  ```
  https://bishoku.github.io/han-notes-app/#sync=<ROOM_ID>&key=<BASE64_KEY>&role=peer
  ```
- **Why Hash Fragments?** In accordance with the HTTP/1.1 specification (RFC 3986), characters following the `#` symbol in a URL are **strictly client-side**. Browsers never send hash fragments in HTTP requests to web servers or proxies.
- The QR code displayed on your desktop screen encodes this URL. When your mobile device scans the QR code with its camera, the key is ingested directly into browser memory.

---

## 🚀 Step-by-Step Usage Guide

### Step 1: Start Sync on Host (e.g., Desktop / Laptop)
1. In H.A.N., click the **P2P Sync** icon in the bottom status bar (or navigate to **Settings** -> **P2P Sync**).
2. The sync modal will open in **Host Mode**:
   - A unique pairing QR code is generated on screen.
   - The status badge changes to **Waiting for peer...**.
3. (Optional) If scanning a QR code is not convenient, click **Copy Link** to share the pairing link via a secure local clipboard or messenger.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔄 P2P Encrypted Synchronization                               [Close ✕]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  📱 Scan with Mobile Device                                                 │
│                                                                             │
│         ┌─────────────────────────┐                                         │
│         │  █████████   █████████  │                                         │
│         │  █ ▄▄▄ █ █ █ █ ▄▄▄ █ █  │    Status: Waiting for Peer...          │
│         │  █ ███ █ █ █ █ ███ █ █  │    Room ID: 7f8a-92b1-4cd2              │
│         │  █▄▄▄█ █ █ █ █▄▄▄█ █ █  │    Encryption: AES-GCM 256 (E2EE)       │
│         │  █████████   █████████  │                                         │
│         └─────────────────────────┘                                         │
│                                                                             │
│  [ 📋 Copy Pairing Link ]               [ Switch to Scanner / Join Mode ]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Step 2: Connect from Peer (e.g., Mobile Phone / Tablet)
1. Open the H.A.N. Web App on your mobile device (Safari on iOS, Chrome on Android).
2. Tap the **Sync** icon or open **Settings** -> **P2P Sync**.
3. Tap **Scan QR Code / Join**:
   - Grant temporary camera permission if prompted.
   - Point your mobile camera at the QR code displayed on the desktop screen.
   - The scanner reticle will instantly detect the pairing QR code, read the session ID and decryption key from the hash, and begin the handshake.
4. *Alternative*: If you opened the pairing link directly in your mobile browser, H.A.N. automatically detects the `#sync=...` hash on launch and begins pairing immediately with zero taps!

---

### Step 3: Automated Bi-Directional Synchronization
Once connected, the synchronization protocol executes automatically in seconds:
1. **Manifest Exchange**: Both devices exchange an encrypted summary (`id`, `updatedAt`, `hash`, `deletedAt`) of their notes.
2. **State Diffing**: Each device determines exactly which notes are missing, updated, or deleted on the other side.
3. **Encrypted Transfer**: Modified notes are streamed across the WebRTC DataChannel with a live progress indicator.
4. **Completion Summary**: A detailed report appears showing the count of notes sent, received, deleted, and conflicts detected.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔄 Synchronizing Notes...                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Transferring: Work/Architecture.md (Note 14 of 42)                         │
│                                                                             │
│  [████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░] 52%                   │
│                                                                             │
│  ⬆️ Sending: 18 notes   |   ⬇️ Receiving: 24 notes                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Packet Chunking & Flow Control (Backpressure)

WebRTC DataChannels operate over SCTP, which enforces a strict maximum message size (typically **64 KiB** or **262 KiB** depending on the browser). Attempting to send a large note, embedded diagram, or vault manifest exceeding this limit causes browsers to throw:
`Failed to execute 'send' on 'RTCDataChannel': Trying to send message larger than max-message-size`.

H.A.N. completely eliminates this restriction with a specialized **Packet Chunking & Backpressure Engine** (`src/services/sync/chunking.ts`):

1. **16 KiB Chunk Slicing**: Every encrypted payload is automatically sliced into safe **16 KiB (16,384 bytes)** chunks.
2. **8-Byte Binary Framing Header**:
   ```
   0                   1                   2                   3
   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |                       Message ID (uint32)                     |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |       Chunk Index (uint16)    |      Total Chunks (uint16)    |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |                      Chunk Data (0..16 KiB)                   |
   |                               ...                             |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   ```
3. **Backpressure Flow Control**:
   - To prevent memory exhaustion and buffer bloat during bulk transfers, H.A.N. tracks `channel.bufferedAmount`.
   - If the sending buffer exceeds **128 KiB**, transmission pauses until the browser flushes data to the network and fires `bufferedamountlow` (threshold: **64 KiB**).
4. **Reassembly & Deinterleaving**:
   - The receiving device reassembles packets in real time. Even if packets arrive out-of-order or are interleaved from concurrent tasks, the message reassembler reconstructs the full buffer before AES-GCM decryption.

---

## ⚖️ Conflict Handling & Tombstone System

H.A.N. guarantees note consistency across asynchronous, offline edits without data loss.

### 1. Last-Write-Wins (LWW)
Every note carries an epoch millisecond modification timestamp (`updatedAt`). When comparing notes:
- If a note exists on Device A with timestamp `T2` and on Device B with timestamp `T1` (`T2 > T1`), Device A's version is accepted.
- Notes with identical SHA-256 content hashes are skipped, saving bandwidth and battery.

### 2. Soft-Delete Tombstones (No Note Resurrection)
A common flaw in naive P2P sync systems is **note resurrection**: User deletes Note X on Device A. Later, Device A syncs with Device B (which still has Note X). Device B treats Note X as a "new note" and sends it back to Device A!

H.A.N. prevents this using a persistent metadata store (`.han_sync_metadata.json`):
- When a note is deleted, a **tombstone record** is created with `deleted: true` and `deletedAt: <timestamp>`.
- During sync, Device A informs Device B that Note X was deleted.
- If Note X on Device B was last edited **before** the deletion timestamp, Device B deletes its local copy.
- If Note X on Device B was edited **after** the deletion timestamp, the newer edit takes precedence and is retained.

### 3. Divergent Concurrent Conflicts
If both devices edited the same note offline at the exact same timestamp or with diverging contents:
- The remote note is saved with a conflict suffix:
  `Notes/Meeting-Notes (Conflict 2026-09-04-143022).md`
- Both versions are preserved so you never lose notes or ideas.

---

## 📱 Storage Asymmetry & Mobile PWA

H.A.N. adapts transparently to whatever storage capabilities the host operating system allows:

| Platform | Primary Storage Engine | Characteristics |
| :--- | :--- | :--- |
| **Desktop (Tauri)** | `TauriStorage` | Direct native disk I/O, `.git` repository, full file paths. |
| **Desktop (Chrome/Edge)** | `BrowserStorage` | File System Access API (`showDirectoryPicker`), writes directly to local disk folder. |
| **Mobile (iOS Safari, Android)** | `IndexedDBStorage` | High-capacity browser IndexedDB (`han_notes_db`), works 100% offline, zero permission dialogs. |

### Installing H.A.N. as a Mobile PWA
You can install H.A.N. as an offline app on your smartphone or tablet:
- **iOS (Safari)**: Tap the **Share** button -> **Add to Home Screen**.
- **Android (Chrome)**: Tap the three-dot menu -> **Install app** / **Add to Home screen**.
- Once added, H.A.N. launches in standalone fullscreen mode without browser URL bars and operates entirely offline using cached service workers and IndexedDB storage.

---

## 🌐 Self-Hosting the Signaling Server

H.A.N. includes an open-source, production-ready signaling server designed for **Cloudflare Workers** with **Durable Objects**. It can be deployed in under two minutes on Cloudflare's free tier.

The signaling server contains zero persistent database storage, logs no IP addresses, and holds no note contents or keys.

### Deployment Instructions

1. Navigate to the `signaling-server` folder:
   ```bash
   cd signaling-server
   npm install
   ```

2. Authenticate with Cloudflare:
   ```bash
   npx wrangler login
   ```

3. Deploy to Cloudflare:
   ```bash
   npm run deploy
   ```
   Wrangler will output your live worker URL:
   `https://han-notes-signaling.<your-subdomain>.workers.dev`

4. Connect H.A.N. to your custom server:
   - Open H.A.N. **Settings** -> **P2P Sync**.
   - Under **Signaling Server URL**, enter your Cloudflare Worker URL:
     `wss://han-notes-signaling.<your-subdomain>.workers.dev`
   - Click **Save**.

---

## ❓ Frequently Asked Questions & Troubleshooting

### Why not use a cloud database like Firebase, Supabase, or CouchDB?
Third-party databases require user accounts, monthly subscriptions, vendor lock-in, and trusting cloud administrators with your private notes. H.A.N.'s P2P WebRTC architecture requires **zero accounts**, costs **\$0**, and gives you complete sovereignty over your data.

### Does sync work across different local Wi-Fi networks or over mobile 4G/5G?
**Yes!** H.A.N. uses standard Google STUN servers (`stun:stun.l.google.com:19302`) to discover reflexive public IP addresses and establish direct P2P connections across standard home routers, mobile data connections (4G/5G), and public Wi-Fi networks.

### What if my connection fails with "ICE Connection Failed"?
If you are behind strict corporate firewalls, university networks, or symmetric NATs, WebRTC peer discovery may be blocked. To resolve:
1. Ensure both devices are connected to the same Wi-Fi network or personal hotspot.
2. In enterprise environments, configure a TURN relay server in WebRTC configuration settings.

### What is the maximum note or vault size supported?
Thanks to the 16 KiB packet chunking and backpressure engine, there is no technical size limit on individual notes or attachments. Vaults with thousands of notes and large embedded diagrams transfer smoothly with flow control.
