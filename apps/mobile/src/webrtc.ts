/**
 * Mobile WebRTC helpers via react-native-webrtc (APK / dev client).
 * Signaling is the same SDP/ICE JSON protocol as apps/web/src/lib/webrtc.ts.
 */
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from "react-native-webrtc";

export type RnMediaStream = InstanceType<typeof MediaStream>;

export type SignalingMessage =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: Record<string, unknown> | null }
  | { type: "hangup" }
  | { type: "screen" }
  | { type: "screen-offer"; sdp: string }
  | { type: "screen-answer"; sdp: string };

export type PeerCallbacks = {
  onLocalDescription?: (desc: { type: string; sdp?: string }) => void;
  onIceCandidate?: (candidate: InstanceType<typeof RTCIceCandidate> | null) => void;
  onTrack?: (event: { streams: RnMediaStream[]; track: unknown }) => void;
  onConnectionStateChange?: (state: string) => void;
};

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type SignalingChannel = {
  send: (msg: object) => void;
  close: () => void;
  addEventListener: (
    type: string,
    listener: (ev: { data?: unknown; detail?: unknown }) => void,
  ) => void;
  kind: "ws" | "mock";
};

const DEFAULT_ICE: { iceServers: IceServerConfig[] } = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export { MediaStream, RTCView, mediaDevices };

export function createPeerConnection(
  callbacks: PeerCallbacks = {},
  config: { iceServers?: IceServerConfig[] } = DEFAULT_ICE,
): InstanceType<typeof RTCPeerConnection> {
  const pc = new RTCPeerConnection({
    iceServers: config.iceServers ?? DEFAULT_ICE.iceServers,
  });

  // react-native-webrtc uses event emitter style
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pc as any).addEventListener("icecandidate", (ev: { candidate: InstanceType<typeof RTCIceCandidate> | null }) => {
    callbacks.onIceCandidate?.(ev.candidate);
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pc as any).addEventListener("track", (ev: { streams: RnMediaStream[]; track: unknown }) => {
    callbacks.onTrack?.(ev);
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pc as any).addEventListener("connectionstatechange", () => {
    callbacks.onConnectionStateChange?.((pc as { connectionState?: string }).connectionState ?? "unknown");
  });

  return pc;
}

export async function attachLocalMedia(
  pc: InstanceType<typeof RTCPeerConnection>,
  constraints: { audio?: boolean; video?: boolean } = { audio: true, video: true },
  existing?: RnMediaStream,
): Promise<RnMediaStream> {
  const stream =
    existing ??
    ((await mediaDevices.getUserMedia(constraints)) as unknown as RnMediaStream);
  for (const track of stream.getTracks()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pc as any).addTrack(track, stream);
  }
  return stream;
}

export async function createOffer(
  pc: InstanceType<typeof RTCPeerConnection>,
  callbacks?: PeerCallbacks,
): Promise<{ type: string; sdp?: string }> {
  const offer = await pc.createOffer({});
  await pc.setLocalDescription(offer);
  const desc = pc.localDescription ?? offer;
  callbacks?.onLocalDescription?.(desc as { type: string; sdp?: string });
  return desc as { type: string; sdp?: string };
}

export async function handleRemoteOffer(
  pc: InstanceType<typeof RTCPeerConnection>,
  offer: { type: string; sdp: string },
  callbacks?: PeerCallbacks,
): Promise<{ type: string; sdp?: string }> {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  const desc = pc.localDescription ?? answer;
  callbacks?.onLocalDescription?.(desc as { type: string; sdp?: string });
  return desc as { type: string; sdp?: string };
}

export async function handleRemoteAnswer(
  pc: InstanceType<typeof RTCPeerConnection>,
  answer: { type: string; sdp: string },
): Promise<void> {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function handleRemoteIce(
  pc: InstanceType<typeof RTCPeerConnection>,
  candidate: Record<string, unknown> | null,
): Promise<void> {
  if (candidate) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
}

export function createMockSignalingChannel(): SignalingChannel {
  const listeners = new Map<string, Set<(ev: { data?: unknown; detail?: unknown }) => void>>();
  return {
    kind: "mock",
    send(msg) {
      for (const fn of listeners.get("message") ?? []) {
        fn({ detail: msg });
      }
    },
    close() {
      for (const fn of listeners.get("close") ?? []) {
        fn({});
      }
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
  };
}

export function openSignalingChannel(wsUrl: string | null | undefined): SignalingChannel {
  if (!wsUrl) return createMockSignalingChannel();
  try {
    const ws = new WebSocket(wsUrl);
    return {
      kind: "ws",
      send(msg) {
        const raw = JSON.stringify(msg);
        if (ws.readyState === WebSocket.OPEN) ws.send(raw);
        else {
          const onOpen = () => {
            ws.removeEventListener("open", onOpen);
            ws.send(raw);
          };
          ws.addEventListener("open", onOpen);
        }
      },
      close() {
        ws.close();
      },
      addEventListener(type, listener) {
        if (type === "message") {
          ws.addEventListener("message", (ev) => {
            listener({ data: (ev as { data?: unknown }).data });
          });
        } else if (type === "close") {
          ws.addEventListener("close", () => listener({}));
        }
      },
    };
  } catch {
    return createMockSignalingChannel();
  }
}

/** Build wss/ws URL for call signaling DO from EXPO_PUBLIC_API_BASE. */
export function signalingWsUrl(
  apiBase: string,
  signalingPath: string,
  token: string,
  conversationId: string,
): string {
  const base = apiBase.replace(/\/$/, "");
  const proto = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "");
  const path = signalingPath.startsWith("/") ? signalingPath : `/${signalingPath}`;
  return `${proto}://${host}${path}?token=${encodeURIComponent(token)}&conversationId=${encodeURIComponent(conversationId)}`;
}
