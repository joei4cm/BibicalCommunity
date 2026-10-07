/**
 * WebRTC signaling Durable Object — SDP/ICE fan-out only. No media.
 */
export class CallRoomDO implements DurableObject {
  private sessions = new Map<WebSocket, { userId: string }>();

  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      const userId = url.searchParams.get("userId") ?? "anonymous";
      this.state.acceptWebSocket(server);
      this.sessions.set(server, { userId });
      server.send(JSON.stringify({ type: "joined", userId, peers: this.sessions.size }));
      return new Response(null, { status: 101, webSocket: client });
    }

    return Response.json({
      ok: true,
      room: url.pathname,
      peers: this.sessions.size,
      conversationId: url.searchParams.get("conversationId"),
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    let payload: { type?: string };
    try {
      payload = JSON.parse(text);
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "invalid_json" }));
      return;
    }
    // Allow only signaling message types (incl. screen-share SDP)
    const allowed = ["offer", "answer", "ice", "hangup", "screen", "screen-offer", "screen-answer"];
    if (!payload.type || !allowed.includes(payload.type)) {
      ws.send(JSON.stringify({ type: "error", error: "invalid_type" }));
      return;
    }
    const from = this.sessions.get(ws)?.userId;
    for (const [peer] of this.sessions) {
      if (peer !== ws && peer.readyState === WebSocket.OPEN) {
        peer.send(JSON.stringify({ ...payload, from }));
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.sessions.delete(ws);
  }
}
