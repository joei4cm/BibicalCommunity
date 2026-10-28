/** Structured chat plaintext (still E2E-encrypted as a string blob). */
export type CallEvent = "ended" | "missed" | "declined" | "canceled";

export type ChatPayload =
  | { v: 1; kind: "text"; text: string }
  | {
      v: 1;
      kind: "media";
      mediaKey: string;
      mime: string;
      name: string;
      text?: string;
      /** Client AES-GCM key for R2 ciphertext (absent on legacy plaintext uploads). */
      enc?: { v: 1; k: string; iv: string };
    }
  | {
      v: 1;
      kind: "call";
      event: CallEvent;
      callId?: string;
      durationSec?: number;
      video?: boolean;
      direction?: "out" | "in";
    };

export function encodeChatPayload(payload: ChatPayload): string {
  return JSON.stringify(payload);
}

export function parseChatPayload(raw: string | undefined | null): ChatPayload | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return { v: 1, kind: "text", text: raw };
  }
  try {
    const parsed = JSON.parse(trimmed) as ChatPayload;
    if (parsed?.v !== 1) return { v: 1, kind: "text", text: raw };
    if (parsed.kind === "text" && typeof parsed.text === "string") return parsed;
    if (
      parsed.kind === "media" &&
      typeof parsed.mediaKey === "string" &&
      typeof parsed.mime === "string" &&
      typeof parsed.name === "string"
    ) {
      if (
        parsed.enc &&
        (parsed.enc.v !== 1 ||
          typeof parsed.enc.k !== "string" ||
          typeof parsed.enc.iv !== "string")
      ) {
        return { v: 1, kind: "text", text: raw };
      }
      return parsed;
    }
    if (
      parsed.kind === "call" &&
      (parsed.event === "ended" ||
        parsed.event === "missed" ||
        parsed.event === "declined" ||
        parsed.event === "canceled")
    ) {
      return parsed;
    }
    return { v: 1, kind: "text", text: raw };
  } catch {
    return { v: 1, kind: "text", text: raw };
  }
}

export function payloadPreview(raw: string | undefined | null, fallback = ""): string {
  const p = parseChatPayload(raw);
  if (!p) return fallback;
  if (p.kind === "media") return p.text?.trim() || p.name || fallback;
  if (p.kind === "call") {
    if (p.event === "ended") return fallback || "📞";
    if (p.event === "missed") return fallback || "📞";
    return fallback || "📞";
  }
  return p.text || fallback;
}

export function formatCallDuration(sec: number | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
