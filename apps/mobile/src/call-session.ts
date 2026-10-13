/**
 * Mobile call session — mirrors apps/web/src/lib/call-session.ts using RN WebRTC.
 * Caller sends ring + offer; callee answers an existing / buffered offer (no second offer).
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
  peers?: number;
} {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as {
        type?: string;
        sdp?: string;
        candidate?: Record<string, unknown> | null;
        peers?: number;
      };
    } catch {
      return {};
    }
  }
  if (data && typeof data === "object") {
    return data as {
      type?: string;
      sdp?: string;
      candidate?: Record<string, unknown> | null;
      peers?: number;
    };
  }
  return {};
}

function iceToJson(
  cand: { toJSON?: () => Record<string, unknown> } | null,
): Record<string, unknown> | null {
  if (!cand) return null;
  if (typeof cand.toJSON === "function") return cand.toJSON();
  return cand as unknown as Record<string, unknown>;
}

/** Start a call: open signaling WS, attach media, create offer or answer. */
export async function startCallSession(opts: {
  wsUrl: string | null;
  iceServers: IceServerConfig[];
  /** caller sends offer; callee waits for remote offer then answers. */
  role?: "caller" | "callee";
  video?: boolean;
  /** Offer SDP already received on a listen socket (applied after media attach). */
  initialOfferSdp?: string | null;
  onRemoteStream?: (stream: RnMediaStream) => void;
  onNote?: (msg: string) => void;
}): Promise<CallSession> {
  const channel = openSignalingChannel(opts.wsUrl);
  const sendSignal = (msg: SignalingMessage | object) => channel.send(msg);
  const role = opts.role ?? "caller";

  let gotRemoteAnswer = false;
  let reofferInFlight = false;

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
  // Audio-first: video permission failures on Android often blocked entire calls.
  const localStream = await attachLocalMedia(pc, {
    audio: true,
    video: opts.video ?? false,
  });
  session.pc = pc;
  session.localStream = localStream;

  async function applyRemoteOffer(sdp: string) {
    if (pc.remoteDescription) return;
    await handleRemoteOffer(pc, { type: "offer", sdp }, callbacks);
    opts.onNote?.("answered-remote-offer");
  }

  /**
   * Caller: if peer joins after our first offer was missed, resend local SDP only.
   * Do NOT send another `ring` — that reopens Accept UI on the callee mid-answer.
   */
  async function maybeReoffer(reason: string) {
    if (role !== "caller" || gotRemoteAnswer || reofferInFlight) return;
    if (pc.remoteDescription) return;
    reofferInFlight = true;
    try {
      const existing = pc.localDescription?.sdp;
      if (existing) {
        sendSignal({ type: "offer", sdp: existing });
        opts.onNote?.(`reoffer:${reason}`);
      } else {
        await createOffer(pc, callbacks);
        opts.onNote?.(`reoffer-new:${reason}`);
      }
    } catch (e) {
      opts.onNote?.(e instanceof Error ? `reoffer-failed:${e.message}` : "reoffer-failed");
    } finally {
      reofferInFlight = false;
    }
  }

  const onMessage = async (ev: { data?: unknown; detail?: unknown }) => {
    const raw = ev.data ?? ev.detail;
    const msg = parseSignal(raw);
    if (!msg.type) return;
    if (msg.type === "offer" && msg.sdp) {
      if (role === "caller" && pc.localDescription) {
        // Glare — ignore peer offers while we are the outbound caller.
        return;
      }
      await applyRemoteOffer(msg.sdp);
    } else if (msg.type === "screen-offer" && msg.sdp) {
      await applyRemoteOffer(msg.sdp);
    } else if ((msg.type === "answer" || msg.type === "screen-answer") && msg.sdp) {
      gotRemoteAnswer = true;
      await handleRemoteAnswer(pc, { type: "answer", sdp: msg.sdp });
      opts.onNote?.(msg.type === "screen-answer" ? "got-screen-answer" : "got-remote-answer");
    } else if (msg.type === "ice") {
      await handleRemoteIce(pc, msg.candidate ?? null);
    } else if (msg.type === "hangup") {
      opts.onNote?.("peer-hangup");
    } else if (msg.type === "ring") {
      opts.onNote?.("peer-ring");
    } else if (msg.type === "peer-joined") {
      opts.onNote?.("peer-joined");
      await maybeReoffer("peer-joined");
    } else if (msg.type === "joined" && typeof msg.peers === "number" && msg.peers >= 2) {
      await maybeReoffer("joined-multi");
    }
  };

  channel.addEventListener("message", (ev) => void onMessage(ev));

  if (role === "caller") {
    sendSignal({ type: "ring" });
    await createOffer(pc, callbacks);
  } else if (opts.initialOfferSdp) {
    await applyRemoteOffer(opts.initialOfferSdp);
  }

  opts.onNote?.(channel.kind === "ws" ? "signaling=ws" : "signaling=mock");

  session.close = () => {
    sendSignal({ type: "hangup" });
    for (const t of localStream.getTracks()) t.stop();
    pc.close();
    channel.close();
  };

  return session;
}
