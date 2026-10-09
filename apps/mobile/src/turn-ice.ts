/** Build ICE servers from /v1/calls/turn-credentials (STUN without creds). */

export type TurnCredentialsResponse = {
  username?: string;
  credential?: string;
  uris: string[];
  ttl?: number;
  iceServers?: { urls: string | string[]; username?: string; credential?: string }[];
  hasRelay?: boolean;
  note?: string;
};

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

function isTurnUri(uri: string): boolean {
  const u = uri.trim().toLowerCase();
  return u.startsWith("turn:") || u.startsWith("turns:");
}

function isStunUri(uri: string): boolean {
  const u = uri.trim().toLowerCase();
  return u.startsWith("stun:") || u.startsWith("stuns:");
}

function overlapUrls(a: IceServer, list: IceServer[]): boolean {
  const aUrls = new Set(
    (Array.isArray(a.urls) ? a.urls : [a.urls]).map((u) => String(u).toLowerCase()),
  );
  for (const s of list) {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    if (urls.some((u) => aUrls.has(String(u).toLowerCase()))) return true;
  }
  return false;
}

export function buildIceServersFromTurnResponse(
  turn: TurnCredentialsResponse,
  fallback: IceServer[] = [{ urls: "stun:stun.l.google.com:19302" }],
): IceServer[] {
  if (Array.isArray(turn.iceServers) && turn.iceServers.length > 0) {
    return [...fallback.filter((s) => !overlapUrls(s, turn.iceServers!)), ...turn.iceServers];
  }
  const uris = Array.isArray(turn.uris) ? turn.uris.filter(Boolean) : [];
  const stun = uris.filter(isStunUri);
  const relay = uris.filter(isTurnUri);
  const out: IceServer[] = [...fallback];
  if (stun.length > 0) out.push({ urls: stun });
  if (relay.length > 0 && turn.username && turn.credential) {
    out.push({ urls: relay, username: turn.username, credential: turn.credential });
  } else if (relay.length > 0) {
    out.push({ urls: relay });
  }
  return out;
}

export function turnResponseHasRelay(turn: TurnCredentialsResponse): boolean {
  if (typeof turn.hasRelay === "boolean") return turn.hasRelay;
  return (turn.uris ?? []).some(isTurnUri);
}
