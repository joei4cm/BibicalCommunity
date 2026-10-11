/** Structured chat plaintext (still E2E-encrypted as a string blob). */
export type ChatPayload =
  | { v: 1; kind: "text"; text: string }
  | {
      v: 1;
      kind: "media";
      mediaKey: string;
      mime: string;
      name: string;
      text?: string;
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
  return p.text || fallback;
}
