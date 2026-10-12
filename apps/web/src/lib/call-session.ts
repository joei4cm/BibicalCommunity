import {
  attachLocalMedia,
  createOffer,
  createPeerConnection,
  handleRemoteAnswer,
  handleRemoteIce,
  handleRemoteOffer,
  openSignalingChannel,
  type PeerCallbacks,
  type SignalingMessage,
} from "./webrtc";

export type CallSession = {
  pc: RTCPeerConnection;
  localStream: MediaStream;
  channel: WebSocket | ReturnType<typeof openSignalingChannel>;
  /** Renegotiate after screen capture and send `screen-offer` on the signaling channel. */
  sendScreenOffer: () => Promise<void>;
  /** Notify peer that screen share ended (no SDP). */
  sendScreenStop: () => void;
  close: () => void;
};

function sendOnChannel(
  channel: WebSocket | ReturnType<typeof openSignalingChannel>,
  msg: object,
) {
  const raw = JSON.stringify(msg);
  if (channel instanceof WebSocket) {
    if (channel.readyState === WebSocket.OPEN) channel.send(raw);
    else channel.addEventListener("open", () => channel.send(raw), { once: true });
  } else {
    channel.send(msg as never);
  }
}

function parseSignal(data: unknown): {
  type?: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit | null;
  peers?: number;
} {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as {
        type?: string;
        sdp?: string;
        candidate?: RTCIceCandidateInit | null;
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
      candidate?: RTCIceCandidateInit | null;
      peers?: number;
    };
  }
  return {};
}

/** Start a call: open signaling WS, attach media, create offer, handle inbound SDP/ICE. */
export async function startCallSession(opts: {
  wsUrl: string | null;
  iceServers: RTCIceServer[];
  /** caller sends offer; callee waits for remote offer then answers. */
  role?: "caller" | "callee";
  video?: boolean;
  /** Offer SDP already received on a listen socket (applied after media attach). */
  initialOfferSdp?: string | null;
  onRemoteStream?: (stream: MediaStream) => void;
  onNote?: (msg: string) => void;
}): Promise<CallSession> {
  const channel = openSignalingChannel(opts.wsUrl);
  const sendSignal = (msg: SignalingMessage | object) => sendOnChannel(channel, msg);
  const role = opts.role ?? "caller";

  /** When answering a screen-offer, reply with screen-answer (not plain answer). */
  let answerAsScreen = false;
  let gotRemoteAnswer = false;
  let reofferInFlight = false;

  const callbacks: PeerCallbacks = {
    onLocalDescription: (desc) => {
      if (desc.type === "offer") {
        sendSignal({ type: "offer", sdp: desc.sdp ?? "" });
      } else if (desc.type === "answer") {
        if (answerAsScreen) {
          sendSignal({ type: "screen-answer", sdp: desc.sdp ?? "" });
          answerAsScreen = false;
        } else {
          sendSignal({ type: "answer", sdp: desc.sdp ?? "" });
        }
      }
    },
    onIceCandidate: (cand) => sendSignal({ type: "ice", candidate: cand?.toJSON() ?? null }),
    onTrack: (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      opts.onRemoteStream?.(stream);
    },
    onConnectionStateChange: (state) => opts.onNote?.(`pc:${state}`),
  };

  const pc = createPeerConnection(callbacks, { iceServers: opts.iceServers });
  const localStream = await attachLocalMedia(pc, {
    audio: true,
    video: opts.video ?? false,
  });

  async function applyRemoteOffer(sdp: string, asScreen = false) {
    // Ignore buffered/replayed initial offers once we already have a remote description.
    if (!asScreen && pc.remoteDescription) return;
    answerAsScreen = asScreen;
    await handleRemoteOffer(pc, { type: "offer", sdp }, callbacks);
    opts.onNote?.(asScreen ? "answered-screen-offer" : "answered-remote-offer");
  }

  /** Caller: if peer joins after our first offer was missed, resend ring + local SDP. */
  async function maybeReoffer(reason: string) {
    if (role !== "caller" || gotRemoteAnswer || reofferInFlight) return;
    if (pc.remoteDescription) return;
    reofferInFlight = true;
    try {
      sendSignal({ type: "ring" });
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

  const onMessage = async (ev: MessageEvent | CustomEvent) => {
    const raw = "data" in ev ? ev.data : (ev as CustomEvent).detail;
    const msg = parseSignal(raw);
    if (!msg.type) return;
    if (msg.type === "offer" && msg.sdp) {
      if (role === "caller" && pc.localDescription) {
        // Glare / echo — ignore own fan-out style offers while calling out.
        return;
      }
      await applyRemoteOffer(msg.sdp, false);
    } else if (msg.type === "screen-offer" && msg.sdp) {
      await applyRemoteOffer(msg.sdp, true);
    } else if ((msg.type === "answer" || msg.type === "screen-answer") && msg.sdp) {
      gotRemoteAnswer = true;
      await handleRemoteAnswer(pc, { type: "answer", sdp: msg.sdp });
      opts.onNote?.(msg.type === "screen-answer" ? "got-screen-answer" : "got-remote-answer");
    } else if (msg.type === "ice") {
      await handleRemoteIce(pc, msg.candidate ?? null);
    } else if (msg.type === "screen") {
      opts.onNote?.("peer-screen");
    } else if (msg.type === "hangup") {
      opts.onNote?.("peer-hangup");
    } else if (msg.type === "ring") {
      opts.onNote?.("peer-ring");
    } else if (msg.type === "peer-joined") {
      opts.onNote?.("peer-joined");
      await maybeReoffer("peer-joined");
    } else if (msg.type === "joined" && typeof msg.peers === "number" && msg.peers >= 2) {
      // Late join into a room that already has the peer (listen already up).
      await maybeReoffer("joined-multi");
    }
  };

  if (channel instanceof WebSocket) {
    channel.addEventListener("message", (ev) => void onMessage(ev));
  } else {
    channel.addEventListener("message", (ev) => void onMessage(ev as CustomEvent));
  }

  if (role === "caller") {
    sendSignal({ type: "ring" });
    await createOffer(pc, callbacks);
  } else if (opts.initialOfferSdp) {
    await applyRemoteOffer(opts.initialOfferSdp, false);
  }

  return {
    pc,
    localStream,
    channel,
    sendScreenOffer: async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdp = pc.localDescription?.sdp ?? offer.sdp ?? "";
      sendSignal({ type: "screen-offer", sdp });
      opts.onNote?.("sent-screen-offer");
    },
    sendScreenStop: () => {
      sendSignal({ type: "screen" });
      opts.onNote?.("sent-screen-stop");
    },
    close: () => {
      sendSignal({ type: "hangup" });
      for (const t of localStream.getTracks()) t.stop();
      pc.close();
      if (channel instanceof WebSocket) channel.close();
      else channel.close();
    },
  };
}
