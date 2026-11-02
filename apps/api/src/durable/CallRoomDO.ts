/**
 * WebRTC signaling Durable Object — SDP/ICE fan-out only. No media.
 *
 * Also buffers the latest ring/offer **and trickle ICE** so a late-joining
 * callee still receives the call after the caller already signaled
 * (listen socket → accept handoff). Without ICE replay, early host/srflx
 * candidates sent while the callee was only listening are lost and many
 * calls never leave `checking`.
 */
import { isCallSignalType } from "@logoshome/shared";

type SessionMeta = { userId: string };

type BufferedInvite = {
  ring?: string;
  offer?: string;
  ice: string[];
  from: string;
  at: number;
};

const BUFFER_TTL_MS = 60_000;
const MAX_BUFFERED_ICE = 64;
const DEFAULT_MAX_PEERS = 16;

export class CallRoomDO implements DurableObject {
  private sessions = new Map<WebSocket, SessionMeta>();
  private buffered: BufferedInvite | null = null;

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

  private ensureBuffer(fromUserId: string): BufferedInvite {
    if (!this.buffered || this.buffered.from !== fromUserId) {
      this.buffered = { ice: [], from: fromUserId, at: Date.now() };
    } else {
      this.buffered.at = Date.now();
    }
    return this.buffered;
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

    const from = fromUserId ?? "anonymous";
    const stamped = JSON.stringify({ ...payload, from: fromUserId });

    if (type === "ring" || type === "offer") {
      const buf = this.ensureBuffer(from);
      if (type === "ring") buf.ring = stamped;
      if (type === "offer") {
        buf.offer = stamped;
        // Fresh SDP → prior trickle ICE no longer applies.
        buf.ice = [];
      }
    } else if (type === "ice") {
      const buf = this.ensureBuffer(from);
      if (buf.ice.length < MAX_BUFFERED_ICE) buf.ice.push(stamped);
    } else if (type === "hangup" || type === "answer") {
      // Answer / hangup ends the pending inbound invite.
      this.clearBuffer();
    }

    for (const peer of this.openPeers()) {
      if (peer !== fromWs) peer.send(stamped);
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

      // Replay buffered invite to the late joiner (accept after listen teardown).
      if (this.buffered && this.buffered.from !== userId) {
        if (this.buffered.ring) server.send(this.buffered.ring);
        if (this.buffered.offer) server.send(this.buffered.offer);
        for (const ice of this.buffered.ice) server.send(ice);
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    return Response.json({
      ok: true,
      room: url.pathname,
      peers: this.sessions.size,
      conversationId: url.searchParams.get("conversationId"),
      hasBufferedInvite: Boolean(this.buffered),
      bufferedIce: this.buffered?.ice.length ?? 0,
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
