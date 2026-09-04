/**
 * H.A.N. Notes — Standalone Ephemeral Signaling Service
 * 
 * Implemented using Cloudflare Workers and Durable Objects.
 * Strictly acts as a temporary discovery conduit for WebRTC SDP Offer/Answer and ICE candidates.
 * 
 * PRIVACY GUARANTEES:
 * - NEVER parses, inspects, or stores note data.
 * - NEVER touches, receives, or stores encryption keys.
 * - Both clients immediately disconnect once WebRTC DataChannel is opened,
 *   dropping all worker resources to zero.
 */

export interface Env {
  SIGNALING_ROOM: DurableObjectNamespace;
}

// ─── Durable Object: SignalingRoom ──────────────────────────────────────────

export class SignalingRoom implements DurableObject {
  private sessions = new Set<WebSocket>();

  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    // Verify WebSocket upgrade request
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Limit room to max 2 participants (Host and Peer)
    if (this.sessions.size >= 2) {
      return new Response('Signaling room is full (maximum 2 devices allowed)', { status: 403 });
    }

    const pair = new WebSocketPair();
    const clientWs = pair[0];
    const serverWs = pair[1];

    serverWs.accept();
    this.sessions.add(serverWs);

    serverWs.addEventListener('message', (event) => {
      // Direct relay to other peer in the room
      for (const session of this.sessions) {
        if (session !== serverWs && session.readyState === WebSocket.OPEN) {
          try {
            session.send(event.data);
          } catch (err) {
            console.error('[SignalingRoom] Failed to forward message:', err);
          }
        }
      }
    });

    const cleanup = () => {
      this.sessions.delete(serverWs);
      try {
        serverWs.close(1000, 'Session closed');
      } catch {}
    };

    serverWs.addEventListener('close', cleanup);
    serverWs.addEventListener('error', cleanup);

    return new Response(null, {
      status: 101,
      webSocket: clientWs,
    });
  }
}

// ─── Main Worker Router ─────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check & CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'han-signaling-server',
          ephemeral: true,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // WebSocket route: /ws/:roomId
    const match = url.pathname.match(/^\/ws\/([a-zA-Z0-9_\-.]+)/);
    if (match) {
      const roomId = match[1];
      const id = env.SIGNALING_ROOM.idFromName(roomId);
      const room = env.SIGNALING_ROOM.get(id);
      return room.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
