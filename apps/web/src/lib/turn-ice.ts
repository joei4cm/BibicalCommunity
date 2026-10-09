/**
 * Build RTCConfiguration iceServers from /v1/calls/turn-credentials.
 * Never attach TURN username/credential to pure STUN URLs (breaks some browsers).
 */

export type TurnCredentialsResponse = {
  username?: string;
  credential?: string;
  uris: string[];
  ttl?: number;
  iceServers?: RTCIceServer[];
  hasRelay?: boolean;
  note?: string;
};

function isTurnUri(uri: string): boolean {
  const u = uri.trim().toLowerCase();
  return u.startsWith("turn:") || u.startsWith("turns:");
}

function isStunUri(uri: string): boolean {
  const u = uri.trim().toLowerCase();
  return u.startsWith("stun:") || u.startsWith("stuns:");
}

/** Prefer server-built iceServers when present; otherwise split STUN vs TURN. */
export function buildIceServersFromTurnResponse(
  turn: TurnCredentialsResponse,
  fallback: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }],
): RTCIceServer[] {
  if (Array.isArray(turn.iceServers) && turn.iceServers.length > 0) {
    return [...fallback.filter((s) => !overlapUrls(s, turn.iceServers!)), ...turn.iceServers];
  }

  const uris = Array.isArray(turn.uris) ? turn.uris.filter(Boolean) : [];
  const stun = uris.filter(isStunUri);
  const relay = uris.filter(isTurnUri);
  const out: RTCIceServer[] = [...fallback];

  if (stun.length > 0) {
    out.push({ urls: stun });
  }
  if (relay.length > 0 && turn.username && turn.credential) {
    out.push({ urls: relay, username: turn.username, credential: turn.credential });
  } else if (relay.length > 0) {
    out.push({ urls: relay });
  }

  return out;
}

function overlapUrls(a: RTCIceServer, list: RTCIceServer[]): boolean {
  const aUrls = new Set(
    (Array.isArray(a.urls) ? a.urls : [a.urls]).map((u) => String(u).toLowerCase()),
  );
  for (const s of list) {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    if (urls.some((u) => aUrls.has(String(u).toLowerCase()))) return true;
  }
  return false;
}

export function turnResponseHasRelay(turn: TurnCredentialsResponse): boolean {
  if (typeof turn.hasRelay === "boolean") return turn.hasRelay;
  return (turn.uris ?? []).some(isTurnUri);
}
