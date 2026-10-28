/**
 * WebRTC signaling Durable Object — SDP/ICE fan-out only. No media.
 *
 * Also buffers the latest ring/offer so a late-joining callee still receives
 * the call after the caller already signaled (listen socket → accept handoff).
 */
import { isCallSignalType } from "@logoshome/shared";

type SessionMeta = { userId: string };

type BufferedSignal = {
  type: "ring" | "offer";
  payload: string;
  from: string;
  at: number;
};

const BUFFER_TTL_MS = 60_000;
const DEFAULT_MAX_PEERS = 16;

export class CallRoomDO implements DurableObject {
  private sessions = new Map<WebSocket, SessionMeta>();
  private buffered: BufferedSignal | null = null;

  constructor(private state: DurableObjectState) {}

  private openPeers(): WebSocket[] {
    return [...this.sessions.keys()].filter((ws) => ws.readyState === WebSocket.OPEN);
  }

  private clearBuffer() {
    this.buffered = null;
  }

  private pruneBuffer() {
    if (this.buffered && Date.now() - this.buffered.at > BUFFER_TTL_MS) {
      this.buffered = null;
    }
  }

  private fanout(fromWs: WebSocket, text: string, fromUserId: string | undefined) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      fromWs.send(JSON.stringify({ type: "error", error: "invalid_json" }));
      return;
    }
    const type = payload.type;
    if (!isCallSignalType(type)) {
      fromWs.send(JSON.stringify({ type: "error", error: "invalid_type" }));
      return;
    }

    if (type === "ring" || type === "offer") {
      this.buffered = {
        type,
        payload: JSON.stringify({ ...payload, from: fromUserId }),
        from: fromUserId ?? "anonymous",
        at: Date.now(),
      };
    } else if (type === "hangup" || type === "answer") {
      // Answer / hangup ends the pending inbound invite.
      this.clearBuffer();
    }

    const out = JSON.stringify({ ...payload, from: fromUserId });
    for (const peer of this.openPeers()) {
      if (peer !== fromWs) peer.send(out);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      const userId = url.searchParams.get("userId") ?? "anonymous";
      const maxRaw = Number(url.searchParams.get("maxPeers") ?? DEFAULT_MAX_PEERS);
      const maxPeers =
        Number.isFinite(maxRaw) && maxRaw > 0 ? Math.min(Math.floor(maxRaw), 32) : DEFAULT_MAX_PEERS;
      if (this.sessions.size >= maxPeers) {
        return Response.json({ error: "room_full", maxPeers }, { status: 403 });
      }
      this.state.acceptWebSocket(server);
      this.sessions.set(server, { userId });
      this.pruneBuffer();

      const peers = this.sessions.size;
      server.send(JSON.stringify({ type: "joined", userId, peers, maxPeers }));

      // Notify existing peers so the caller can re-offer if the first offer was missed.
      const peerJoined = JSON.stringify({ type: "peer-joined", userId, peers });
      for (const peer of this.openPeers()) {
        if (peer !== server) peer.send(peerJoined);
      }

      // Replay buffered ring/offer to the late joiner (accept after listen teardown).
      if (this.buffered && this.buffered.from !== userId) {
        server.send(this.buffered.payload);
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    return Response.json({
      ok: true,
      room: url.pathname,
      peers: this.sessions.size,
      conversationId: url.searchParams.get("conversationId"),
      hasBufferedInvite: Boolean(this.buffered),
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    const from = this.sessions.get(ws)?.userId;
    this.fanout(ws, text, from);
  }

  async webSocketClose(ws: WebSocket) {
    this.sessions.delete(ws);
    if (this.sessions.size === 0) this.clearBuffer();
  }
}
