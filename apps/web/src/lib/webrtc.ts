/**
 * Thin browser WebRTC helper for LogosHome calls.
 *
 * Signaling flow (not handled here):
 * 1. POST `/v1/chat/calls` with `{ conversationId }` → `{ callId, signalingPath }`
 * 2. Open a WebSocket to the Durable Object at `signalingPath` (auth already done)
 * 3. Exchange SDP offer/answer and ICE candidates as `{ type, sdp|candidate, ... }`
 *
 * In local/dev when no WS URL is available, use {@link createMockSignalingChannel}
 * (EventTarget) to exercise offer/answer/ICE callbacks without a live DO.
 */

export type SignalingMessage =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: RTCIceCandidateInit | null }
  | { type: "hangup" }
  | { type: "screen" }
  | { type: "screen-offer"; sdp: string }
  | { type: "screen-answer"; sdp: string };
export type PeerCallbacks = {
  onLocalDescription?: (desc: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (candidate: RTCIceCandidate | null) => void;
  onTrack?: (event: RTCTrackEvent) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
};

const DEFAULT_ICE: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function createPeerConnection(
  callbacks: PeerCallbacks = {},
  config: RTCConfiguration = DEFAULT_ICE,
): RTCPeerConnection {
  const pc = new RTCPeerConnection(config);

  pc.onicecandidate = (ev) => {
    callbacks.onIceCandidate?.(ev.candidate);
  };
  pc.ontrack = (ev) => {
    callbacks.onTrack?.(ev);
  };
  pc.onconnectionstatechange = () => {
    callbacks.onConnectionStateChange?.(pc.connectionState);
  };

  return pc;
}

/** Attach mic/camera (or a provided stream) to the peer connection. */
export async function attachLocalMedia(
  pc: RTCPeerConnection,
  constraints: MediaStreamConstraints = { audio: true, video: true },
  existing?: MediaStream,
): Promise<MediaStream> {
  const stream = existing ?? (await navigator.mediaDevices.getUserMedia(constraints));
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }
  return stream;
}

export async function createOffer(
  pc: RTCPeerConnection,
  callbacks?: PeerCallbacks,
): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const desc = pc.localDescription ?? offer;
  callbacks?.onLocalDescription?.(desc);
  return desc;
}

export async function handleRemoteOffer(
  pc: RTCPeerConnection,
  offer: RTCSessionDescriptionInit,
  callbacks?: PeerCallbacks,
): Promise<RTCSessionDescriptionInit> {
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  const desc = pc.localDescription ?? answer;
  callbacks?.onLocalDescription?.(desc);
  return desc;
}

export async function handleRemoteAnswer(
  pc: RTCPeerConnection,
  answer: RTCSessionDescriptionInit,
): Promise<void> {
  await pc.setRemoteDescription(answer);
}

export async function handleRemoteIce(
  pc: RTCPeerConnection,
  candidate: RTCIceCandidateInit | null,
): Promise<void> {
  if (candidate) await pc.addIceCandidate(candidate);
}

/**
 * Dev stand-in for the Durable Object WebSocket when `signalingPath` / WS URL
 * is unavailable. Dispatch `message` CustomEvents with `{ detail: SignalingMessage }`.
 */
export function createMockSignalingChannel(): EventTarget & {
  send: (msg: SignalingMessage) => void;
  close: () => void;
} {
  const target = new EventTarget() as EventTarget & {
    send: (msg: SignalingMessage) => void;
    close: () => void;
  };
  target.send = (msg) => {
    target.dispatchEvent(new CustomEvent("message", { detail: msg }));
  };
  target.close = () => {
    target.dispatchEvent(new Event("close"));
  };
  return target;
}

/** Prefer live WS when a URL is known; otherwise fall back to the mock channel. */
export function openSignalingChannel(
  wsUrl: string | null | undefined,
): WebSocket | ReturnType<typeof createMockSignalingChannel> {
  if (wsUrl) {
    try {
      return new WebSocket(wsUrl);
    } catch {
      return createMockSignalingChannel();
    }
  }
  return createMockSignalingChannel();
}

/** Capture display surface and replace/add video sender for screen share. */
export async function startScreenShare(pc: RTCPeerConnection): Promise<MediaStream> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });
  const track = display.getVideoTracks()[0];
  if (!track) throw new Error("no_display_track");

  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (sender) {
    await sender.replaceTrack(track);
  } else {
    pc.addTrack(track, display);
  }

  track.addEventListener("ended", () => {
    /* caller may re-attach camera */
  });
  return display;
}

export async function stopScreenShare(
  pc: RTCPeerConnection,
  cameraStream?: MediaStream | null,
): Promise<void> {
  const cameraTrack = cameraStream?.getVideoTracks()[0] ?? null;
  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (sender) await sender.replaceTrack(cameraTrack);
}
