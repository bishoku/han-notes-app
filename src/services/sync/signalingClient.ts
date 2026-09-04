/**
 * Ephemeral Signaling Client.
 * 
 * Manages WebSocket communication with the Cloudflare Worker signaling relay.
 * Acts solely as a discovery pipe for SDP Offer/Answer and ICE candidates.
 * 
 * NEVER sends note data or encryption keys over this connection.
 * Closed immediately the instant the WebRTC DataChannel reaches 'open'.
 */
import type { SignalingMessage, SyncRole } from './types';

export const DEFAULT_SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_SERVER_URL || 'wss://han-signaling.baris-workers.workers.dev';

export type SignalingMessageHandler = (msg: SignalingMessage) => void;
export type SignalingStatusHandler = (status: 'connected' | 'disconnected' | 'error', err?: any) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<SignalingMessageHandler> = new Set();
  private statusHandlers: Set<SignalingStatusHandler> = new Set();
  private isExplicitlyClosed = false;
  private serverUrl: string;
  private roomId: string;
  private role: SyncRole;

  constructor(
    serverUrl: string = DEFAULT_SIGNALING_URL,
    roomId: string,
    role: SyncRole
  ) {
    this.serverUrl = serverUrl;
    this.roomId = roomId;
    this.role = role;
  }

  /**
   * Connects to the signaling server for this room.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isExplicitlyClosed = false;

      // Construct clean WebSocket URL
      // If serverUrl is http(s), convert to ws(s)
      let url = this.serverUrl.replace(/^http/, 'ws');
      url = url.replace(/\/+$/, '');
      const wsUrl = `${url}/ws/${encodeURIComponent(this.roomId)}?role=${this.role}`;

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        reject(err);
        return;
      }

      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.ws.close();
          reject(new Error('Signaling connection timed out after 10s'));
        }
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        this.notifyStatus('connected');
        // Announce ready state to peer in room
        this.send({ type: 'ready', role: this.role });
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as SignalingMessage;
          for (const handler of this.messageHandlers) {
            handler(msg);
          }
        } catch (e) {
          console.warn('[SignalingClient] Failed to parse message:', event.data, e);
        }
      };

      this.ws.onerror = (event) => {
        clearTimeout(connectionTimeout);
        this.notifyStatus('error', event);
      };

      this.ws.onclose = () => {
        clearTimeout(connectionTimeout);
        if (!this.isExplicitlyClosed) {
          this.notifyStatus('disconnected');
        }
      };
    });
  }

  /**
   * Sends a signaling message to the paired peer in this room.
   */
  send(message: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[SignalingClient] Cannot send message, WebSocket not open');
    }
  }

  /**
   * Closes the signaling connection and drops all server resources to zero.
   */
  disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.ws) {
      try {
        this.send({ type: 'bye' });
        this.ws.close(1000, 'DataChannel established — dropping signaling');
      } catch {}
      this.ws = null;
    }
    this.messageHandlers.clear();
    this.statusHandlers.clear();
  }

  onMessage(handler: SignalingMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: SignalingStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private notifyStatus(status: 'connected' | 'disconnected' | 'error', err?: any) {
    for (const handler of this.statusHandlers) {
      handler(status, err);
    }
  }
}
