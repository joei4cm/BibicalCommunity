/**
 * Mobile call session — mirrors apps/web/src/lib/call-session.ts using RN WebRTC.
 */
import {
  attachLocalMedia,
  createOffer,
  createPeerConnection,
  handleRemoteAnswer,
  handleRemoteIce,
  handleRemoteOffer,
  openSignalingChannel,
  type IceServerConfig,
  type PeerCallbacks,
  type RnMediaStream,
  type SignalingChannel,
  type SignalingMessage,
  MediaStream,
} from "./webrtc";

export type CallSession = {
  pc: ReturnType<typeof createPeerConnection>;
  localStream: RnMediaStream;
  remoteStream: RnMediaStream | null;
  channel: SignalingChannel;
  close: () => void;
};

function parseSignal(data: unknown): {
  type?: string;
  sdp?: string;
  candidate?: Record<string, unknown> | null;
} {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as {
        type?: string;
        sdp?: string;
        candidate?: Record<string, unknown> | null;
      };
    } catch {
      return {};
    }
  }
  if (data && typeof data === "object") {
    return data as { type?: string; sdp?: string; candidate?: Record<string, unknown> | null };
  }
  return {};
}

function iceToJson(cand: { toJSON?: () => Record<string, unknown> } | null): Record<string, unknown> | null {
  if (!cand) return null;
  if (typeof cand.toJSON === "function") return cand.toJSON();
  return cand as unknown as Record<string, unknown>;
}

/** Start a call: open signaling WS, attach media, create offer, handle inbound SDP/ICE. */
export async function startCallSession(opts: {
  wsUrl: string | null;
  iceServers: IceServerConfig[];
  onRemoteStream?: (stream: RnMediaStream) => void;
  onNote?: (msg: string) => void;
}): Promise<CallSession> {
  const channel = openSignalingChannel(opts.wsUrl);
  const sendSignal = (msg: SignalingMessage | object) => channel.send(msg);

  const session: CallSession = {
    pc: null as unknown as ReturnType<typeof createPeerConnection>,
    localStream: null as unknown as RnMediaStream,
    remoteStream: null,
    channel,
    close: () => undefined,
  };

  const callbacks: PeerCallbacks = {
    onLocalDescription: (desc) => {
      if (desc.type === "offer") {
        sendSignal({ type: "offer", sdp: desc.sdp ?? "" });
      } else if (desc.type === "answer") {
        sendSignal({ type: "answer", sdp: desc.sdp ?? "" });
      }
    },
    onIceCandidate: (cand) =>
      sendSignal({
        type: "ice",
        candidate: iceToJson(cand as { toJSON?: () => Record<string, unknown> } | null),
      }),
    onTrack: (ev) => {
      const stream =
        ev.streams[0] ??
        (new MediaStream(ev.track ? [ev.track as never] : []) as unknown as RnMediaStream);
      session.remoteStream = stream;
      opts.onRemoteStream?.(stream);
    },
    onConnectionStateChange: (state) => opts.onNote?.(`pc:${state}`),
  };

  const pc = createPeerConnection(callbacks, { iceServers: opts.iceServers });
  const localStream = await attachLocalMedia(pc, { audio: true, video: true });
  session.pc = pc;
  session.localStream = localStream;

  const onMessage = async (ev: { data?: unknown; detail?: unknown }) => {
    const raw = ev.data ?? ev.detail;
    const msg = parseSignal(raw);
    if (!msg.type) return;
    if (msg.type === "offer" && msg.sdp) {
      await handleRemoteOffer(pc, { type: "offer", sdp: msg.sdp }, callbacks);
      opts.onNote?.("answered-remote-offer");
    } else if (msg.type === "screen-offer" && msg.sdp) {
      await handleRemoteOffer(pc, { type: "offer", sdp: msg.sdp }, callbacks);
      opts.onNote?.("answered-screen-offer");
    } else if ((msg.type === "answer" || msg.type === "screen-answer") && msg.sdp) {
      await handleRemoteAnswer(pc, { type: "answer", sdp: msg.sdp });
      opts.onNote?.(msg.type === "screen-answer" ? "got-screen-answer" : "got-remote-answer");
    } else if (msg.type === "ice") {
      await handleRemoteIce(pc, msg.candidate ?? null);
    } else if (msg.type === "hangup") {
      opts.onNote?.("peer-hangup");
    }
  };

  channel.addEventListener("message", (ev) => void onMessage(ev));

  await createOffer(pc, callbacks);
  opts.onNote?.(channel.kind === "ws" ? "signaling=ws" : "signaling=mock");

  session.close = () => {
    sendSignal({ type: "hangup" });
    for (const t of localStream.getTracks()) t.stop();
    pc.close();
    channel.close();
  };

  return session;
}
