/**
 * WebRTC P2P DataChannel Synchronization Service.
 * 
 * Establishes a direct peer-to-peer data channel between two devices (e.g. Desktop & Mobile).
 * Zero application server data routing.
 * Zero-knowledge encryption: all payloads encrypted via AES-GCM before transmission.
 * Ephemeral signaling: WebSocket is terminated the moment DataChannel is open.
 */
import { useNoteStore } from '@/store/noteStore';
import { encryptPayload, decryptPayload } from './crypto';
import { SignalingClient, DEFAULT_SIGNALING_URL } from './signalingClient';
import { syncStorageAdapter } from './syncStorageAdapter';
import type {
  CanonicalNote,
  P2PMessage,
  SignalingMessage,
  SyncManifest,
  SyncProgress,
  SyncReport,
  SyncRole,
  SyncState,
} from './types';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRtcSyncService {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signaling: SignalingClient | null = null;
  private isCancelled = false;
  private roomId: string;
  private cryptoKey: CryptoKey;
  private role: SyncRole;
  private signalingUrl: string;
  private onStateChange?: (state: SyncState, error?: string) => void;
  private onProgress?: (progress: SyncProgress) => void;

  constructor(
    roomId: string,
    cryptoKey: CryptoKey,
    role: SyncRole,
    signalingUrl: string = DEFAULT_SIGNALING_URL,
    onStateChange?: (state: SyncState, error?: string) => void,
    onProgress?: (progress: SyncProgress) => void
  ) {
    this.roomId = roomId;
    this.cryptoKey = cryptoKey;
    this.role = role;
    this.signalingUrl = signalingUrl;
    this.onStateChange = onStateChange;
    this.onProgress = onProgress;
  }

  /**
   * Starts the P2P connection and performs the full bi-directional sync workflow.
   */
  async start(): Promise<SyncReport> {
    this.isCancelled = false;
    this.setState('connecting_signaling');

    try {
      // 1. Initialize Signaling Client
      this.signaling = new SignalingClient(this.signalingUrl, this.roomId, this.role);
      await this.signaling.connect();

      // 2. Initialize WebRTC Peer Connection
      this.pc = new RTCPeerConnection(RTC_CONFIG);

      // Listen for ICE candidates and forward to signaling
      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.signaling) {
          this.signaling.send({
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE Connection State:', this.pc?.iceConnectionState);
        if (this.pc?.iceConnectionState === 'failed') {
          this.setState('error', 'P2P Connection failed to establish via ICE.');
        }
      };

      // 3. Setup DataChannel depending on role
      const dataChannelPromise = new Promise<RTCDataChannel>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebRTC DataChannel connection timed out after 30s.'));
        }, 30000);

        if (this.role === 'host') {
          // Host creates DataChannel
          const channel = this.pc!.createDataChannel('han-sync-channel', {
            ordered: true,
          });
          channel.binaryType = 'arraybuffer';

          channel.onopen = () => {
            clearTimeout(timeout);
            console.log('[WebRTC] DataChannel OPEN on host!');
            resolve(channel);
          };
          channel.onerror = (e) => reject(e);
          this.dataChannel = channel;
        } else {
          // Peer awaits DataChannel from host
          this.pc!.ondatachannel = (event) => {
            const channel = event.channel;
            channel.binaryType = 'arraybuffer';

            channel.onopen = () => {
              clearTimeout(timeout);
              console.log('[WebRTC] DataChannel OPEN on peer!');
              resolve(channel);
            };
            channel.onerror = (e) => reject(e);
            this.dataChannel = channel;
          };
        }
      });

      // 4. Handle Signaling Handshake (Offer / Answer / ICE)
      this.setupSignalingHandlers();

      if (this.role === 'host') {
        this.setState('waiting_peer');
      } else {
        this.setState('connecting_peer');
      }

      // 5. Await DataChannel Opening
      const channel = await dataChannelPromise;

      // 6. IMMEDIATELY close WebSocket signaling connection to drop server resources to 0!
      console.log('[Sync] DataChannel connected — terminating signaling WebSocket.');
      if (this.signaling) {
        this.signaling.disconnect();
        this.signaling = null;
      }

      this.setState('syncing');

      // 7. Perform bi-directional state diffing and note transfer
      const report = await this.performSyncProtocol(channel);

      this.setState('completed');

      // 8. Refresh noteStore vault and file tree
      try {
        await useNoteStore.getState().loadVault();
      } catch (err) {
        console.warn('[Sync] Vault reload error:', err);
      }

      return report;
    } catch (err: any) {
      if (!this.isCancelled) {
        this.setState('error', err?.message || 'Sync failed');
      }
      throw err;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Sets up signaling message handlers for SDP and ICE candidates.
   */
  private setupSignalingHandlers() {
    if (!this.signaling || !this.pc) return;

    this.signaling.onMessage(async (msg: SignalingMessage) => {
      if (this.isCancelled || !this.pc) return;

      try {
        if (msg.type === 'ready' && this.role === 'host') {
          // Peer connected to room — create and send SDP offer
          this.setState('connecting_peer');
          const offer = await this.pc.createOffer();
          await this.pc.setLocalDescription(offer);
          this.signaling?.send({
            type: 'offer',
            sdp: offer.sdp || '',
          });
        } else if (msg.type === 'offer' && this.role === 'peer') {
          // Peer received SDP offer — set remote description and send answer
          await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.signaling?.send({
            type: 'answer',
            sdp: answer.sdp || '',
          });
        } else if (msg.type === 'answer' && this.role === 'host') {
          // Host received answer
          await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
        } else if (msg.type === 'candidate') {
          // Received ICE candidate
          await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }
      } catch (e) {
        console.error('[WebRTC] Signaling message processing error:', e);
      }
    });
  }

  /**
   * Core P2P synchronization protocol over encrypted DataChannel.
   */
  private async performSyncProtocol(channel: RTCDataChannel): Promise<SyncReport> {
    const report: SyncReport = {
      syncedAt: Date.now(),
      sentNotesCount: 0,
      receivedNotesCount: 0,
      deletedNotesCount: 0,
      conflictsCount: 0,
      details: [],
    };

    // 1. Send encrypted local manifest to peer
    this.onProgress?.({
      stage: 'manifest',
      totalNotes: 0,
      transferredNotes: 0,
      direction: 'bidirectional',
    });

    const localManifest = await syncStorageAdapter.getSyncManifest();
    await this.sendEncryptedMessage(channel, {
      type: 'MANIFEST',
      manifest: localManifest,
    });

    // 2. Wait for peer's encrypted manifest
    const remoteManifestMsg = await this.waitForMessage(channel, 'MANIFEST');
    const remoteManifest: SyncManifest = remoteManifestMsg.manifest;

    // 3. State Diffing: determine notes to send and notes to receive
    const localAllNotes = await syncStorageAdapter.getAllCanonicalNotes();
    const localNotesMap = new Map<string, CanonicalNote>(localAllNotes.map((n) => [n.id, n]));

    const notesToSend: CanonicalNote[] = [];

    // Check all local notes against remote manifest
    for (const localNote of localAllNotes) {
      const remoteSummary = remoteManifest.notes[localNote.id];

      if (!remoteSummary) {
        // Remote doesn't have this note or tombstone
        notesToSend.push(localNote);
      } else {
        // Both have a record for this note ID
        if (localNote.deleted && !remoteSummary.deleted) {
          // Local is deleted (tombstone) — send if deleted AFTER remote edit
          if ((localNote.deletedAt || localNote.updatedAt) > remoteSummary.updatedAt) {
            notesToSend.push(localNote);
          }
        } else if (!localNote.deleted && remoteSummary.deleted) {
          // Local is active, remote is tombstoned — send if local edit is NEWER than remote deletion
          if (localNote.updatedAt > (remoteSummary.deletedAt || remoteSummary.updatedAt)) {
            notesToSend.push(localNote);
          }
        } else if (!localNote.deleted && !remoteSummary.deleted) {
          // Both active — send if local is strictly newer and different hash
          if (localNote.updatedAt > remoteSummary.updatedAt && localNote.hash !== remoteSummary.hash) {
            notesToSend.push(localNote);
          }
        }
      }
    }

    // Calculate how many notes we expect remote peer to send us
    let expectedIncomingCount = 0;
    for (const [remoteId, remoteSummary] of Object.entries(remoteManifest.notes)) {
      const localNote = localNotesMap.get(remoteId);
      if (!localNote) {
        expectedIncomingCount++;
      } else if (remoteSummary.deleted && !localNote.deleted) {
        if ((remoteSummary.deletedAt || remoteSummary.updatedAt) > localNote.updatedAt) {
          expectedIncomingCount++;
        }
      } else if (!remoteSummary.deleted && localNote.deleted) {
        if (remoteSummary.updatedAt > (localNote.deletedAt || localNote.updatedAt)) {
          expectedIncomingCount++;
        }
      } else if (!remoteSummary.deleted && !localNote.deleted) {
        if (remoteSummary.updatedAt > localNote.updatedAt && remoteSummary.hash !== localNote.hash) {
          expectedIncomingCount++;
        }
      }
    }

    const totalTransferNotes = notesToSend.length + expectedIncomingCount;
    let transferredCount = 0;

    this.onProgress?.({
      stage: 'transferring',
      totalNotes: totalTransferNotes,
      transferredNotes: 0,
      direction: 'sending',
    });

    // 4. Send our notes to peer
    for (let i = 0; i < notesToSend.length; i++) {
      if (this.isCancelled) throw new Error('Sync cancelled by user');

      const note = notesToSend[i];
      await this.sendEncryptedMessage(channel, {
        type: 'NOTE_PAYLOAD',
        note,
        index: i + 1,
        total: notesToSend.length,
      });

      transferredCount++;
      report.sentNotesCount++;
      report.details.push(`Sent: ${note.id} ${note.deleted ? '(Tombstone)' : ''}`);

      this.onProgress?.({
        stage: 'transferring',
        totalNotes: totalTransferNotes,
        transferredNotes: transferredCount,
        currentNoteTitle: note.id,
        direction: 'sending',
      });

      // Brief yield to avoid blocking JS event loop
      await new Promise((r) => setTimeout(r, 8));
    }

    // Announce we finished sending notes
    await this.sendEncryptedMessage(channel, {
      type: 'SYNC_DONE',
      sentCount: notesToSend.length,
    });

    // 5. Receive and apply notes from peer until peer sends SYNC_DONE
    let peerSyncDone = false;

    while (!peerSyncDone) {
      if (this.isCancelled) throw new Error('Sync cancelled by user');

      const msg = await this.waitForAnyMessage(channel);
      if (msg.type === 'NOTE_PAYLOAD') {
        const incoming = msg.note;
        const result = await syncStorageAdapter.applyCanonicalNote(incoming);

        transferredCount++;
        report.receivedNotesCount++;

        if (result.status === 'deleted') {
          report.deletedNotesCount++;
          report.details.push(`Deleted (Tombstone): ${incoming.id}`);
        } else if (result.status === 'conflict') {
          report.conflictsCount++;
          report.details.push(`Conflict created: ${result.conflictId}`);
        } else if (result.status === 'created' || result.status === 'updated') {
          report.details.push(`Applied: ${incoming.id}`);
        }

        this.onProgress?.({
          stage: 'transferring',
          totalNotes: totalTransferNotes,
          transferredNotes: transferredCount,
          currentNoteTitle: incoming.id,
          direction: 'receiving',
        });
      } else if (msg.type === 'SYNC_DONE') {
        peerSyncDone = true;
      }
    }

    this.onProgress?.({
      stage: 'finalizing',
      totalNotes: totalTransferNotes,
      transferredNotes: totalTransferNotes,
      direction: 'bidirectional',
    });

    return report;
  }

  /**
   * Helper to encrypt and send a P2P message over DataChannel.
   */
  private async sendEncryptedMessage(channel: RTCDataChannel, msg: P2PMessage): Promise<void> {
    const encryptedBuffer = await encryptPayload(this.cryptoKey, msg);
    channel.send(encryptedBuffer);
  }

  /**
   * Helper to wait for a specific message type over DataChannel.
   */
  private waitForMessage(channel: RTCDataChannel, expectedType: P2PMessage['type']): Promise<any> {
    return new Promise((resolve, reject) => {
      const handleMessage = async (event: MessageEvent) => {
        try {
          const rawBuffer = event.data as ArrayBuffer;
          const decrypted = await decryptPayload<P2PMessage>(this.cryptoKey, rawBuffer);
          if (decrypted.type === expectedType) {
            channel.removeEventListener('message', handleMessage);
            resolve(decrypted);
          }
        } catch (err) {
          channel.removeEventListener('message', handleMessage);
          reject(err);
        }
      };

      channel.addEventListener('message', handleMessage);
    });
  }

  /**
   * Helper to wait for any P2P message over DataChannel.
   */
  private waitForAnyMessage(channel: RTCDataChannel): Promise<P2PMessage> {
    return new Promise((resolve, reject) => {
      const handleMessage = async (event: MessageEvent) => {
        try {
          const rawBuffer = event.data as ArrayBuffer;
          const decrypted = await decryptPayload<P2PMessage>(this.cryptoKey, rawBuffer);
          channel.removeEventListener('message', handleMessage);
          resolve(decrypted);
        } catch (err) {
          channel.removeEventListener('message', handleMessage);
          reject(err);
        }
      };

      channel.addEventListener('message', handleMessage);
    });
  }

  cancel(): void {
    this.isCancelled = true;
    this.cleanup();
  }

  private setState(state: SyncState, error?: string) {
    this.onStateChange?.(state, error);
  }

  private cleanup(): void {
    if (this.signaling) {
      this.signaling.disconnect();
      this.signaling = null;
    }
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }
  }
}
