import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  IconPhoneAccept,
  IconPhoneHangup,
  IconVideo,
  IconVideoOff,
} from "./icons";

export type CallPhase = "idle" | "outgoing" | "incoming" | "connected";

export function CallOverlay({
  open,
  phase,
  peerLabel,
  note,
  localStream,
  remoteStream,
  video,
  onAccept,
  onHangup,
  onToggleVideo,
}: {
  open: boolean;
  phase: CallPhase;
  peerLabel: string;
  note?: string | null;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  video: boolean;
  onAccept: () => void;
  onHangup: () => void;
  onToggleVideo: () => void;
}) {
  const { t } = useTranslation();
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream ?? null;
  }, [remoteStream]);
  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream ?? null;
  }, [localStream]);

  if (!open) return null;

  const status =
    phase === "incoming"
      ? t("chat.callIncoming")
      : phase === "connected"
        ? t("chat.callConnected")
        : t("chat.callCalling");

  return (
    <div className="call-overlay" data-testid="call-overlay" role="dialog" aria-modal="true">
      <div className="call-overlay-bg" aria-hidden />
      <div className="call-overlay-body">
        <div className="call-peer-avatar" aria-hidden>
          {(peerLabel || "?").slice(0, 1)}
        </div>
        <h2 className="call-peer-name">{peerLabel}</h2>
        <p className="call-status">{status}</p>
        {note ? <p className="call-note muted">{note}</p> : null}

        <div className={`call-videos${video ? " is-video" : ""}`}>
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
            >
              <IconPhoneAccept className="call-btn-icon" />
              <span>{t("chat.callAccept")}</span>
            </button>
          )}
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
          <button
            type="button"
            className="call-btn hangup"
            onClick={onHangup}
            aria-label={t("chat.hangup")}
          >
            <IconPhoneHangup className="call-btn-icon" />
            <span>{t("chat.hangup")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
