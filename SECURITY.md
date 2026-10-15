# Security Policy

H.A.N. (Hierarchical Adaptive Notebook) is a privacy-focused, local-first application. Security of user vaults, E2EE WebRTC synchronization, and desktop IPC boundaries is a top priority.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Architecture Highlights

- **Local-First Storage**: Notes remain on your local disk or browser IndexedDB. No note data is uploaded to any central server.
- **Zero-Knowledge P2P Sync**: WebRTC synchronization encrypts all chunks client-side using **AES-256-GCM** (`Web Crypto API`). The epistemic pairing key is exchanged exclusively via the URL `#hash` fragment (which is never transmitted over HTTP or to the WebSocket signaling relay).
- **Encrypted API Keys**: Optional AI provider API keys are encrypted at rest via a non-extractable `CryptoKey` stored in IndexedDB (`han_crypto_vault`).
- **Tauri Vault Sandbox**: All native desktop file operations validate canonical paths against the active vault root directory (`resolve_safe_vault_path`) to prevent path traversal.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report vulnerabilities privately using [**GitHub Private Vulnerability Reporting**](https://github.com/bishoku/han-notes-app/security/advisories/new) on this repository.

When reporting a vulnerability, please include:
1. A clear description of the issue and affected component (`Web/PWA`, `Tauri Desktop`, `WebRTC Sync`, `Editor/XSS`, etc.).
2. Step-by-step reproduction instructions or proof-of-concept.
3. Potential impact assessment.

We aim to acknowledge vulnerability reports within **72 hours** and provide a remediation timeline or patch release as quickly as possible.
