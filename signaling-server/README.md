# H.A.N. Notes Ephemeral Signaling Server

This directory contains a standalone, lightweight WebSocket signaling relay built on **Cloudflare Workers** and **Durable Objects**.

## Purpose & Privacy Architecture

- **Role:** Facilitates initial WebRTC discovery (SDP Offer/Answer exchange and ICE candidate negotiation) between two devices (e.g. Desktop & Mobile).
- **Zero-Knowledge:** The server **never touches, parses, or stores note content or encryption keys**. Keys are generated on the host device and transmitted solely via the URL hash fragment of the pairing QR code.
- **Resource Dropping:** The moment the peer-to-peer WebRTC DataChannel reaches the `open` state, both clients immediately terminate their WebSocket connection, dropping all cloud server resources to zero.

---

## Local Development & Testing

1. Navigate to this directory:
   ```bash
   cd signaling-server
   ```

2. Start the local Wrangler development server:
   ```bash
   npx wrangler dev
   ```
   The local signaling server will run at `ws://localhost:8787`.

3. Point your local H.A.N. Notes application to the local signaling server by adding this to `.env.development` or `.env.local`:
   ```env
   VITE_SIGNALING_SERVER_URL=ws://localhost:8787
   ```
   Or enter `ws://localhost:8787` in **Settings -> P2P Sync** in the app.

---

## Production Deployment

Deploy effortlessly to your Cloudflare account using Wrangler:

```bash
cd signaling-server
npx wrangler deploy
```

Once deployed, set the worker URL (e.g., `wss://han-signaling.<your-subdomain>.workers.dev`) in your app environment:
```env
VITE_SIGNALING_SERVER_URL=wss://han-signaling.<your-subdomain>.workers.dev
```
