/** Cached display labels so chat/Me never flash opaque user ids on boot. */

const STORAGE_KEY = "lh.peerLabels";
const NICK_KEY = "lh.nickname";

export type PeerLabel = { uid?: string | null; nickname?: string | null };

export function loadPeerLabelCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePeerLabelCache(map: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function mergePeerLabels(
  current: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> {
  const next = { ...current, ...incoming };
  savePeerLabelCache(next);
  return next;
}

export function labelFromPeer(peer: PeerLabel | undefined | null, userId?: string | null): string {
  if (peer?.nickname) return peer.nickname;
  if (peer?.uid) return peer.uid;
  if (userId) return userId.slice(0, 10);
  return "…";
}

export function persistSelfNickname(nickname: string | null | undefined) {
  if (!nickname) return;
  try {
    localStorage.setItem(NICK_KEY, nickname);
  } catch {
    /* ignore */
  }
}

export function cachedSelfNickname(): string | null {
  try {
    return localStorage.getItem(NICK_KEY);
  } catch {
    return null;
  }
}

export function clearSelfNickname() {
  try {
    localStorage.removeItem(NICK_KEY);
  } catch {
    /* ignore */
  }
}
