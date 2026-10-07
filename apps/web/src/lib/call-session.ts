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
} {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as {
        type?: string;
        sdp?: string;
        candidate?: RTCIceCandidateInit | null;
      };
    } catch {
      return {};
    }
  }
  if (data && typeof data === "object") {
    return data as { type?: string; sdp?: string; candidate?: RTCIceCandidateInit | null };
  }
  return {};
}

/** Start a call: open signaling WS, attach media, create offer, handle inbound SDP/ICE. */
export async function startCallSession(opts: {
  wsUrl: string | null;
  iceServers: RTCIceServer[];
  onRemoteStream?: (stream: MediaStream) => void;
  onNote?: (msg: string) => void;
}): Promise<CallSession> {
  const channel = openSignalingChannel(opts.wsUrl);
  const sendSignal = (msg: SignalingMessage | object) => sendOnChannel(channel, msg);

  /** When answering a screen-offer, reply with screen-answer (not plain answer). */
  let answerAsScreen = false;

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
  const localStream = await attachLocalMedia(pc, { audio: true, video: true });

  const onMessage = async (ev: MessageEvent | CustomEvent) => {
    const raw = "data" in ev ? ev.data : (ev as CustomEvent).detail;
    const msg = parseSignal(raw);
    if (!msg.type) return;
    if (msg.type === "offer" && msg.sdp) {
      answerAsScreen = false;
      await handleRemoteOffer(pc, { type: "offer", sdp: msg.sdp }, callbacks);
      opts.onNote?.("answered-remote-offer");
    } else if (msg.type === "screen-offer" && msg.sdp) {
      answerAsScreen = true;
      await handleRemoteOffer(pc, { type: "offer", sdp: msg.sdp }, callbacks);
      opts.onNote?.("answered-screen-offer");
    } else if ((msg.type === "answer" || msg.type === "screen-answer") && msg.sdp) {
      await handleRemoteAnswer(pc, { type: "answer", sdp: msg.sdp });
      opts.onNote?.(msg.type === "screen-answer" ? "got-screen-answer" : "got-remote-answer");
    } else if (msg.type === "ice") {
      await handleRemoteIce(pc, msg.candidate ?? null);
    } else if (msg.type === "screen") {
      opts.onNote?.("peer-screen");
    } else if (msg.type === "hangup") {
      opts.onNote?.("peer-hangup");
    }
  };

  if (channel instanceof WebSocket) {
    channel.addEventListener("message", (ev) => void onMessage(ev));
  } else {
    channel.addEventListener("message", (ev) => void onMessage(ev as CustomEvent));
  }

  await createOffer(pc, callbacks);

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
