import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { CallOverlay, type CallPhase } from "../components/CallOverlay";
import { api, apiWsUrl, getToken } from "../lib/api";
import { startCallSession, type CallSession } from "../lib/call-session";
import type { CallEvent } from "../lib/chat-payload";
import { showAppNotification } from "../lib/notify";
import { postControlMessage } from "../lib/post-control-message";
import { canStartScreenShare, probeDisplayMedia } from "../lib/screen-share";
import { buildIceServersFromTurnResponse, turnResponseHasRelay } from "../lib/turn-ice";
import { startScreenShare, stopScreenShare } from "../lib/webrtc";
import { NotifyHost } from "./NotifyHost";

type ConvoRow = {
  id: string;
  kind: "dm" | "group" | "seminar";
  title: string | null;
  peerUserIds?: string[];
  membership: { archived: boolean };
};

type CallMeta = {
  conversationId: string | null;
  callId: string | null;
  role: "caller" | "callee" | null;
  phase: CallPhase;
  connectedAt: number | null;
  ringingAt: number | null;
  video: boolean;
};

type CallContextValue = {
  /** True while a full WebRTC session owns the room (listen sockets closed). */
  callSessionActive: boolean;
  /** Start an outbound call for a conversation (ChatPanel call button). */
  startOutboundCall: (conversationId: string, opts?: { video?: boolean; peerLabel?: string }) => void;
  shareScreen: (conversationId?: string | null) => Promise<void>;
  endScreen: () => Promise<void>;
  screenShareReady: boolean;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}

function labelFor(c: ConvoRow | undefined, peerLabels: Record<string, string>): string {
  if (!c) return "…";
  if (c.title) return c.title;
  const peer = c.peerUserIds?.[0];
  if (peer && peerLabels[peer]) return peerLabels[peer];
  if (peer) return peer.slice(0, 10);
  return "…";
}

const EMPTY_META: CallMeta = {
  conversationId: null,
  callId: null,
  role: null,
  phase: "idle",
  connectedAt: null,
  ringingAt: null,
  video: false,
};

/**
 * App-shell call host for installed PWA / web: keeps DM ring listen alive on every
 * tab (Bible, Plans, Me, …), not only while ChatPanel is mounted.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<ConvoRow[]>([]);
  const [peerLabels, setPeerLabels] = useState<Record<string, string>>({});
  const [callOpen, setCallOpen] = useState(false);
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [callVideo, setCallVideo] = useState(false);
  const [callNote, setCallNote] = useState<string | null>(null);
  const [peerLabel, setPeerLabel] = useState("…");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [callSessionActive, setCallSessionActive] = useState(false);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);

  const callRef = useRef<CallSession | null>(null);
  const pendingOfferRef = useRef<string | null>(null);
  const incomingConvoRef = useRef<string | null>(null);
  const answeringRef = useRef(false);
  const conversationsRef = useRef<ConvoRow[]>([]);
  const peerLabelsRef = useRef<Record<string, string>>({});
  const metaRef = useRef<CallMeta>({ ...EMPTY_META });
  const selfUserIdRef = useRef<string | null>(null);
  const postedCallIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    peerLabelsRef.current = peerLabels;
  }, [peerLabels]);
  useEffect(() => {
    selfUserIdRef.current = selfUserId;
  }, [selfUserId]);

  useEffect(() => {
    if (!getToken()) return;
    void api<{ id?: string; userId?: string }>("/v1/me")
      .then((me) => setSelfUserId(me.id ?? me.userId ?? null))
      .catch(() => setSelfUserId(null));
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!getToken()) {
      setConversations([]);
      return;
    }
    try {
      const res = await api<{ conversations: ConvoRow[] }>("/v1/chat/conversations");
      setConversations(res.conversations);
    } catch {
      /* keep last list */
    }
    try {
      const fr = await api<{
        friends: { user: { id: string; uid: string | null; nickname: string | null } }[];
      }>("/v1/friends");
      const next: Record<string, string> = {};
      for (const f of fr.friends) {
        next[f.user.id] = f.user.nickname || f.user.uid || f.user.id.slice(0, 10);
      }
      setPeerLabels((prev) => ({ ...prev, ...next }));
    } catch {
      /* labels optional */
    }
  }, []);

  useEffect(() => {
    void refreshConversations();
    const timer = window.setInterval(() => void refreshConversations(), 45_000);
    const onFocus = () => void refreshConversations();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshConversations]);

  const setPhase = useCallback((phase: CallPhase) => {
    setCallPhase(phase);
    metaRef.current.phase = phase;
    if (phase === "connected" && !metaRef.current.connectedAt) {
      metaRef.current.connectedAt = Date.now();
    }
    if (phase === "incoming" && !metaRef.current.ringingAt) {
      metaRef.current.ringingAt = Date.now();
    }
  }, []);

  const postCallRecord = useCallback(
    async (event: CallEvent, meta: CallMeta) => {
      if (!meta.conversationId) return;
      const dedupeKey = meta.callId ?? `${meta.conversationId}:${event}:${meta.ringingAt ?? 0}`;
      if (postedCallIdsRef.current.has(dedupeKey)) return;
      postedCallIdsRef.current.add(dedupeKey);
      const convo = conversationsRef.current.find((c) => c.id === meta.conversationId);
      const durationSec =
        event === "ended" && meta.connectedAt
          ? Math.max(0, Math.round((Date.now() - meta.connectedAt) / 1000))
          : undefined;
      try {
        await postControlMessage({
          conversationId: meta.conversationId,
          peerUserIds: convo?.peerUserIds ?? [],
          selfUserId: selfUserIdRef.current,
          kind: convo?.kind ?? "dm",
          payload: {
            v: 1,
            kind: "call",
            event,
            callId: meta.callId ?? undefined,
            durationSec,
            video: meta.video,
            direction: meta.role === "callee" ? "in" : "out",
          },
        });
      } catch {
        postedCallIdsRef.current.delete(dedupeKey);
      }
    },
    [],
  );

  const clearCallUi = useCallback(() => {
    callRef.current?.close();
    callRef.current = null;
    pendingOfferRef.current = null;
    incomingConvoRef.current = null;
    answeringRef.current = false;
    setCallSessionActive(false);
    setRemoteStream(null);
    setLocalStream((prev) => {
      if (prev) for (const track of prev.getTracks()) track.stop();
      return null;
    });
    setCallOpen(false);
    setPhase("idle");
    setCallNote(null);
    metaRef.current = { ...EMPTY_META, video: metaRef.current.video };
  }, [setPhase]);

  const endCall = useCallback(
    (reason: "local-hangup" | "peer-hangup") => {
      const meta = { ...metaRef.current };
      let event: CallEvent;
      if (meta.connectedAt || meta.phase === "connected") {
        event = "ended";
      } else if (meta.role === "caller" || meta.phase === "outgoing") {
        event = reason === "local-hangup" ? "canceled" : "missed";
      } else {
        event = reason === "local-hangup" ? "declined" : "missed";
      }
      clearCallUi();
      void postCallRecord(event, meta);
    },
    [clearCallUi, postCallRecord],
  );

  const hangup = useCallback(() => {
    endCall("local-hangup");
  }, [endCall]);

  const prepareIce = useCallback(async (): Promise<RTCIceServer[]> => {
    let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    try {
      const turn = await api<{
        username?: string;
        credential?: string;
        uris: string[];
        ttl: number;
        iceServers?: RTCIceServer[];
        hasRelay?: boolean;
        note?: string;
      }>("/v1/calls/turn-credentials", { method: "POST", body: "{}" });
      iceServers = buildIceServersFromTurnResponse(turn, iceServers);
      setCallNote(
        turnResponseHasRelay(turn) ? t("chat.callRelayOn") : t("chat.turnRelayMissing"),
      );
    } catch {
      setCallNote(t("chat.turnRelayMissing"));
    }
    return iceServers;
  }, [t]);

  const runCall = useCallback(
    async (
      conversationId: string,
      asAnswerer: boolean,
      opts?: { video?: boolean; peerLabel?: string; existingLocalStream?: MediaStream },
    ) => {
      const video = opts?.video ?? callVideo;
      setCallVideo(video);
      if (opts?.peerLabel) setPeerLabel(opts.peerLabel);
      else {
        const c = conversationsRef.current.find((x) => x.id === conversationId);
        setPeerLabel(labelFor(c, peerLabelsRef.current));
      }
      setCallNote(null);
      setCallOpen(true);
      // Leave "incoming" immediately so a late re-ring cannot flash Accept again.
      setPhase("outgoing");
      metaRef.current = {
        ...metaRef.current,
        conversationId,
        role: asAnswerer ? "callee" : "caller",
        video,
        phase: "outgoing",
      };
      const initialOfferSdp = asAnswerer ? pendingOfferRef.current : null;
      try {
        callRef.current?.close();
        callRef.current = null;
        setCallSessionActive(true);
        const res = await api<{
          callId: string;
          signalingPath: string;
          note?: string;
        }>("/v1/chat/calls", {
          method: "POST",
          body: JSON.stringify({ conversationId }),
        });
        metaRef.current.callId = res.callId;
        const iceServers = await prepareIce();
        const token = getToken();
        const wsUrl = token
          ? apiWsUrl(
              `${res.signalingPath}?token=${encodeURIComponent(token)}&conversationId=${encodeURIComponent(conversationId)}`,
            )
          : null;
        const session = await startCallSession({
          wsUrl,
          iceServers,
          role: asAnswerer ? "callee" : "caller",
          video,
          initialOfferSdp,
          existingLocalStream: opts?.existingLocalStream ?? null,
          onRemoteStream: (stream) => {
            setRemoteStream(stream);
            setPhase("connected");
          },
          onNote: (m) => {
            if (m === "answered-remote-offer" || m === "got-remote-answer") {
              setPhase("connected");
            }
            // Ignore peer-ring on the session socket — re-offer must not reopen Accept UI.
            if (m === "peer-ring") return;
            if (m === "peer-hangup") {
              endCall("peer-hangup");
              return;
            }
            setCallNote((prev) => `${prev ?? ""} · ${m}`);
          },
        });
        callRef.current = session;
        pendingOfferRef.current = null;
        incomingConvoRef.current = null;
        setLocalStream(session.localStream);
        if (!asAnswerer) setPhase("outgoing");
      } catch (e) {
        setCallNote(e instanceof Error ? e.message : "error");
        setPhase("idle");
        setCallOpen(false);
        setCallSessionActive(false);
        pendingOfferRef.current = null;
        incomingConvoRef.current = null;
        if (opts?.existingLocalStream) {
          for (const track of opts.existingLocalStream.getTracks()) track.stop();
        }
      } finally {
        answeringRef.current = false;
      }
    },
    [callVideo, endCall, prepareIce, setPhase],
  );

  const acceptIncoming = useCallback(() => {
    const conversationId = incomingConvoRef.current;
    if (!conversationId || answeringRef.current || callRef.current) return;
    answeringRef.current = true;
    // Capture mic/camera in the same user-gesture turn (critical for iOS PWA).
    const video = callVideo;
    void (async () => {
      let early: MediaStream | undefined;
      try {
        early = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video,
        });
        setLocalStream(early);
        setPhase("outgoing");
      } catch {
        /* startCallSession will retry getUserMedia */
      }
      await runCall(conversationId, true, {
        video,
        existingLocalStream: early,
      });
    })();
  }, [callVideo, runCall, setPhase]);

  const startOutboundCall = useCallback(
    (conversationId: string, opts?: { video?: boolean; peerLabel?: string }) => {
      if (answeringRef.current || callRef.current) return;
      answeringRef.current = true;
      const video = opts?.video ?? callVideo;
      void (async () => {
        let early: MediaStream | undefined;
        try {
          early = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video,
          });
          setLocalStream(early);
        } catch {
          /* session will request media */
        }
        await runCall(conversationId, false, {
          video,
          peerLabel: opts?.peerLabel,
          existingLocalStream: early,
        });
      })();
    },
    [callVideo, runCall],
  );

  const shareScreen = useCallback(
    async (conversationId?: string | null) => {
      const gate = probeDisplayMedia();
      if (!gate.available) {
        setCallNote(
          (prev) => `${prev ?? ""} · ${t("chat.screenShareUnavailable")} (${gate.reason})`,
        );
        return;
      }
      if (!callRef.current) {
        if (!conversationId) return;
        startOutboundCall(conversationId);
        // Wait briefly for the session to attach.
        for (let i = 0; i < 40 && !callRef.current; i++) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      if (!callRef.current) return;
      try {
        await startScreenShare(callRef.current.pc);
        await callRef.current.sendScreenOffer();
        setCallNote((prev) => `${prev ?? ""} · screen-share-on · screen-offer`);
      } catch (e) {
        setCallNote(e instanceof Error ? e.message : "screen_share_failed");
      }
    },
    [startOutboundCall, t],
  );

  const endScreen = useCallback(async () => {
    if (!callRef.current) return;
    await stopScreenShare(callRef.current.pc, callRef.current.localStream);
    callRef.current.sendScreenStop();
    setCallNote((prev) => `${prev ?? ""} · screen-share-off`);
  }, []);

  const screenShareReady = canStartScreenShare();

  const callListenKey = useMemo(
    () =>
      conversations
        .filter((c) => c.kind === "dm" && !c.membership.archived)
        .map((c) => c.id)
        .sort()
        .join("|"),
    [conversations],
  );

  const alertIncoming = useCallback(
    (conversationId: string, label: string) => {
      showAppNotification({
        kind: "call",
        title: t("notify.incomingCall"),
        body: label,
        tag: `lh-call-${conversationId}`,
        force: true,
        onClickUrl: `/app/chat?conversation=${encodeURIComponent(conversationId)}`,
      });
    },
    [t],
  );

  // Global DM ring listen — survives tab switches away from /app/chat.
  useEffect(() => {
    if (!getToken() || callSessionActive) return;
    const dmIds = callListenKey ? callListenKey.split("|") : [];
    if (dmIds.length === 0) return;

    let closed = false;
    const socks: WebSocket[] = [];

    void (async () => {
      for (const conversationId of dmIds) {
        if (closed) return;
        try {
          const res = await api<{ signalingPath: string; callId?: string }>("/v1/chat/calls", {
            method: "POST",
            body: JSON.stringify({ conversationId }),
          });
          if (closed) return;
          const url = apiWsUrl(
            `${res.signalingPath}?token=${encodeURIComponent(getToken()!)}&conversationId=${encodeURIComponent(conversationId)}`,
          );
          const sock = new WebSocket(url);
          sock.onmessage = (ev) => {
            if (callRef.current || answeringRef.current) return;
            try {
              const msg = JSON.parse(String(ev.data)) as { type?: string; sdp?: string };
              if (msg.type === "offer" && msg.sdp) {
                pendingOfferRef.current = msg.sdp;
                incomingConvoRef.current = conversationId;
                const c = conversationsRef.current.find((x) => x.id === conversationId);
                const label = labelFor(c, peerLabelsRef.current);
                setPeerLabel(label);
                metaRef.current = {
                  conversationId,
                  callId: res.callId ?? metaRef.current.callId,
                  role: "callee",
                  phase: "incoming",
                  connectedAt: null,
                  ringingAt: Date.now(),
                  video: callVideo,
                };
                setCallOpen(true);
                setPhase("incoming");
                alertIncoming(conversationId, label);
              } else if (msg.type === "ring") {
                if (answeringRef.current || callRef.current) return;
                if (
                  metaRef.current.phase === "outgoing" ||
                  metaRef.current.phase === "connected"
                ) {
                  return;
                }
                incomingConvoRef.current = conversationId;
                const c = conversationsRef.current.find((x) => x.id === conversationId);
                const label = labelFor(c, peerLabelsRef.current);
                setPeerLabel(label);
                const firstRing = metaRef.current.phase !== "incoming";
                metaRef.current = {
                  conversationId,
                  callId: res.callId ?? metaRef.current.callId,
                  role: "callee",
                  phase: "incoming",
                  connectedAt: null,
                  ringingAt: metaRef.current.ringingAt ?? Date.now(),
                  video: callVideo,
                };
                setCallOpen(true);
                setPhase("incoming");
                if (firstRing) alertIncoming(conversationId, label);
              } else if (msg.type === "hangup") {
                if (!callRef.current && incomingConvoRef.current === conversationId) {
                  const meta = { ...metaRef.current };
                  pendingOfferRef.current = null;
                  incomingConvoRef.current = null;
                  setCallOpen(false);
                  setPhase("idle");
                  if (meta.phase === "incoming" && !meta.connectedAt) {
                    void postCallRecord("missed", {
                      ...meta,
                      conversationId,
                      role: "callee",
                    });
                  }
                  metaRef.current = { ...EMPTY_META };
                }
              }
            } catch {
              /* ignore */
            }
          };
          socks.push(sock);
        } catch {
          /* listen optional per convo */
        }
      }
    })();

    return () => {
      closed = true;
      for (const s of socks) s.close();
    };
  }, [alertIncoming, callSessionActive, callListenKey, callVideo, postCallRecord, setPhase]);

  const value = useMemo(
    () => ({
      callSessionActive,
      startOutboundCall,
      shareScreen,
      endScreen,
      screenShareReady,
    }),
    [callSessionActive, startOutboundCall, shareScreen, endScreen, screenShareReady],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      <NotifyHost />
      <CallOverlay
        open={callOpen}
        phase={callPhase}
        peerLabel={peerLabel}
        note={callNote}
        localStream={localStream}
        remoteStream={remoteStream}
        video={callVideo}
        onAccept={acceptIncoming}
        onHangup={hangup}
        onToggleVideo={() => setCallVideo((v) => !v)}
      />
    </CallContext.Provider>
  );
}
