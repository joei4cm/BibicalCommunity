import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatCallDuration } from "../lib/call-duration";
import {
  IconPhoneAccept,
  IconPhoneHangup,
  IconVideo,
  IconVideoOff,
} from "./icons";

export type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "connected";

export function CallOverlay({
  open,
  phase,
  peerLabel,
  note,
  connectedAt,
  localStream,
  remoteStream,
  video,
  micMuted = false,
  onAccept,
  onHangup,
  onToggleMic,
  onToggleVideo,
}: {
  open: boolean;
  phase: CallPhase;
  peerLabel: string;
  note?: string | null;
  /** Epoch ms when media path became connected — drives the duration timer. */
  connectedAt?: number | null;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  video: boolean;
  micMuted?: boolean;
  onAccept: () => void;
  onHangup: () => void;
  onToggleMic?: () => void;
  /** Omitted mid-call — video track renegotiation is not wired yet. */
  onToggleVideo?: () => void;
}) {
  const { t } = useTranslation();
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);

  // Remote media: use a dedicated <audio> in audio-only mode. Mobile browsers
  // often mute <video> when CSS sets display:none (previous audio-call path).
  useEffect(() => {
    const videoEl = remoteRef.current;
    const audioEl = remoteAudioRef.current;
    setNeedsAudioUnlock(false);
    if (videoEl) {
      videoEl.srcObject = remoteStream ?? null;
      // In audio mode the visible surface is the audio element; keep video muted.
      videoEl.muted = !video;
      if (remoteStream && video) {
        void videoEl.play().catch(() => setNeedsAudioUnlock(true));
      }
    }
    if (audioEl) {
      if (!video && remoteStream) {
        audioEl.srcObject = remoteStream;
        void audioEl.play().catch(() => setNeedsAudioUnlock(true));
      } else {
        audioEl.srcObject = null;
      }
    }
  }, [remoteStream, video]);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream ?? null;
  }, [localStream]);

  useEffect(() => {
    if (phase !== "connected" || !connectedAt) {
      setElapsedSec(0);
      return;
    }
    const tick = () => setElapsedSec(Math.floor((Date.now() - connectedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase, connectedAt]);

  if (!open) return null;

  const status =
    phase === "incoming"
      ? t("chat.callIncoming")
      : phase === "connecting"
        ? t("chat.callConnecting")
        : phase === "connected"
          ? t("chat.callConnected")
          : t("chat.callCalling");

  const unlockAudio = () => {
    const audioEl = remoteAudioRef.current;
    const videoEl = remoteRef.current;
    void (async () => {
      try {
        if (!video && audioEl) await audioEl.play();
        if (video && videoEl) await videoEl.play();
        setNeedsAudioUnlock(false);
      } catch {
        setNeedsAudioUnlock(true);
      }
    })();
  };

  return (
    <div className="call-overlay" data-testid="call-overlay" role="dialog" aria-modal="true">
      <div className="call-overlay-bg" aria-hidden />
      <div className="call-overlay-body">
        <div className="call-peer-avatar" aria-hidden>
          {(peerLabel || "?").slice(0, 1)}
        </div>
        <h2 className="call-peer-name">{peerLabel}</h2>
        <p className="call-status" data-testid="call-status">
          {status}
        </p>
        {phase === "connected" ? (
          <p className="call-timer" data-testid="call-timer" aria-live="polite">
            {formatCallDuration(elapsedSec)}
          </p>
        ) : null}
        {note ? <p className="call-note muted">{note}</p> : null}
        {needsAudioUnlock ? (
          <button
            type="button"
            className="btn call-audio-unlock"
            data-testid="call-audio-unlock"
            onClick={unlockAudio}
          >
            {t("chat.callTapToHear")}
          </button>
        ) : null}

        <div className={`call-videos${video ? " is-video" : ""}`}>
          {/* Always mounted — carries remote audio when video UI is hidden. */}
          <audio ref={remoteAudioRef} className="call-remote-audio" autoPlay playsInline />
          <video ref={remoteRef} className="call-remote" autoPlay playsInline />
          <video ref={localRef} className="call-local" autoPlay playsInline muted />
        </div>

        <div className="call-actions">
          {phase === "incoming" && (
            <button
              type="button"
              className="call-btn accept"
              onClick={onAccept}
              aria-label={t("chat.callAccept")}
              data-testid="call-accept"
            >
              <IconPhoneAccept className="call-btn-icon" />
              <span>{t("chat.callAccept")}</span>
            </button>
          )}
          {onToggleMic && phase !== "incoming" && phase !== "idle" ? (
            <button
              type="button"
              className={`call-btn ghost${micMuted ? " is-muted" : ""}`}
              onClick={onToggleMic}
              aria-pressed={micMuted}
              aria-label={micMuted ? t("chat.callUnmute") : t("chat.callMute")}
              data-testid="call-mute"
            >
              <svg
                className="call-btn-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                {micMuted ? (
                  <>
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                    <path d="M15 9.34V5a3 3 0 0 0-5.94-.6" />
                    <path d="M17 12a5 5 0 0 1-.3 1.7" />
                    <path d="M12 19v3" />
                    <path d="M8 22h8" />
                    <path d="M2 2l20 20" />
                  </>
                ) : (
                  <>
                    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
                    <path d="M19 11a7 7 0 0 1-14 0" />
                    <path d="M12 19v3" />
                    <path d="M8 22h8" />
                  </>
                )}
              </svg>
              <span>{micMuted ? t("chat.callUnmute") : t("chat.callMute")}</span>
            </button>
          ) : null}
          {onToggleVideo ? (
            <button
              type="button"
              className="call-btn ghost"
              onClick={onToggleVideo}
              aria-label={video ? t("chat.callAudio") : t("chat.callVideo")}
            >
              {video ? (
                <IconVideoOff className="call-btn-icon" />
              ) : (
                <IconVideo className="call-btn-icon" />
              )}
              <span>{video ? t("chat.callAudio") : t("chat.callVideo")}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="call-btn hangup"
            onClick={onHangup}
            aria-label={t("chat.hangup")}
            data-testid="call-hangup"
          >
            <IconPhoneHangup className="call-btn-icon" />
            <span>{t("chat.hangup")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
