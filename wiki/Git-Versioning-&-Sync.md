# Git Versioning & Time Machine

H.A.N. includes a **built-in Git version control engine** that operates directly on your vault. You don't need to leave the app to run terminal commands to backup notes, review historical edits, or synchronize with remote repositories.

---

## 🏗️ Dual-Engine Git Architecture

H.A.N. implements an isomorphic Git architecture tailored for both desktop and web:

```
┌──────────────────────────────────────────────────────────┐
│                      Git UI Layer                        │
│   Status Bar · Note History Drawer · Visual Diff Viewer   │
├─────────────────────────────┬────────────────────────────┤
│       Tauri Desktop         │      Browser Web App       │
│  (Native Git / Tauri IPC)   │  (Isomorphic-Git + FSA-FS) │
├─────────────────────────────┴────────────────────────────┤
│             Local Vault Repository (.git)                │
└──────────────────────────────────────────────────────────┘
```

- **Desktop (Tauri)**: Utilizes native Rust system calls and Git bindings for maximum speed and compatibility.
- **Web (Chromium)**: Utilizes `isomorphic-git` running entirely in JavaScript and WASM over the File System Access API.

---

## ⏳ Note History Drawer & Time Machine

Accidentally deleted a critical paragraph or need to see what changed three days ago? Open the **Note History Drawer** (<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd> or click the History icon in the editor footer).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⏳ Note History: Architecture/Backend.md                        [Close ✕]   │
├──────────────────────┬──────────────────────────────────────────────────────┤
│ 📜 Commits           │ 🔍 Diff: commit 8f2a1b vs Previous                   │
│                      │                                                      │
│ ● 2026-08-20 14:32   │ @@ -12,4 +12,6 @@                                    │
│   "Update Redis cache│  ### Caching Strategy                                │
│   configuration"     │ -Use in-memory LRU cache                             │
│                      │ +Use distributed Redis cluster with replication      │
│ ○ 2026-08-18 09:15   │ +TTL: 3600 seconds for session tokens                │
│   "Add auth notes"   │                                                      │
│                      ├──────────────────────────────────────────────────────┤
│ ○ 2026-08-10 11:00   │ [ ⏪ Revert This Note to Selected Version ]          │
│   "Initial draft"    │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

### Time Machine Features
- **Commit History List**: Lists every commit that modified the current note with timestamp and commit message.
- **Visual Diff Viewer**: Color-coded line-by-line diff (`+` additions in green, `-` deletions in red).
- **One-Click Revert**: Click **Revert Note** to restore the note's exact contents from that historical commit. Your current uncommitted changes are safely snapshotted before the rollback.

---

## 📸 Automated Snapshots

H.A.N. automatically creates non-intrusive Git commit snapshots so you never lose work:
- **Save Trigger**: Pressing <kbd>Cmd</kbd> + <kbd>S</kbd> saves the active note and creates an atomic Git snapshot.
- **Note Switch Trigger**: Switching to a different note in the sidebar creates a snapshot of the modified document.
- **Configurable Auto-Commit**: Enable background auto-commits at specified intervals (e.g. every 3, 5, or 10 minutes) in Settings.

---

## ☁️ Remote Sync (GitHub / GitLab / Self-Hosted)

Keep your notes synchronized across multiple devices without third-party subscription fees:

### Configuring Remote Sync
1. Open **Settings** -> **Git Sync**.
2. Toggle **Enable Git Sync** to ON.
3. Configure your **Remote Repository URL** (e.g., `https://github.com/your-username/my-notes-vault.git`).
4. Set the default **Branch** (usually `main`).
5. Provide your **Git Author Name** and **Email**.
6. For remote operations, provide a Personal Access Token (PAT) with repository read/write permissions.
7. Set **Auto-Sync Interval** (e.g., sync every 5 minutes) or click **Sync Now** in the status bar at any time.

---

## ⚖️ Git Sync vs. P2P Encrypted Sync

H.A.N. provides two complementary synchronization mechanisms designed for different workflows:

| Feature | Remote Git Sync | [[P2P Encrypted Sync|P2P-Sync-&-Mobile]] |
| :--- | :--- | :--- |
| **Primary Use Case** | Cloud backup, full commit history, team collaboration | Instant mobile companion pairing, phone-to-computer sync |
| **Transport Protocol** | HTTPS over GitHub / GitLab / Self-hosted Git server | Direct WebRTC DataChannel (device-to-device) |
| **Intermediary Storage** | Remote Git host stores vault repository | **None** (zero server data storage, ephemeral signaling only) |
| **Encryption** | TLS in transit, repository contents unencrypted on host | **Zero-Knowledge End-to-End Encryption (AES-GCM 256)** |
| **Authentication** | Git account + Personal Access Token (PAT) | **Zero accounts / credentials** (scan QR code with camera) |
| **Mobile Web Support** | Requires Git client or desktop environment | Native offline support via **IndexedDB Mobile PWA** |

For complete details on device-to-device mobile synchronization, see the [[P2P Encrypted Sync & Mobile Guide|P2P-Sync-&-Mobile]].
