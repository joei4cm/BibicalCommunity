import { api, getToken } from "./api";
import {
  EMPTY_COMMS_BADGES,
  type CommsBadges,
} from "./comms-badges-format";

export type { CommsBadges };
export { EMPTY_COMMS_BADGES, formatBadgeCount } from "./comms-badges-format";

type Listener = () => void;
const listeners = new Set<Listener>();

let cached: CommsBadges = { ...EMPTY_COMMS_BADGES };
let cachedAt = 0;
let inflight: Promise<CommsBadges> | null = null;
let pollTimer: number | null = null;

const CACHE_MS = 8_000;
const POLL_MS = 30_000;

/** Notify TabBar / ChatPage to refetch badge counts after read/accept actions. */
export function notifyCommsBadgesChanged() {
  for (const fn of listeners) fn();
}

function ensureSharedPoll() {
  if (typeof window === "undefined" || pollTimer != null) return;
  pollTimer = window.setInterval(() => {
    if (!getToken() || listeners.size === 0) return;
    void fetchCommsBadges({ force: true }).then(() => notifyCommsBadgesChanged());
  }, POLL_MS);
}

export function subscribeCommsBadges(fn: Listener): () => void {
  listeners.add(fn);
  ensureSharedPoll();
  return () => {
    listeners.delete(fn);
  };
}

export function peekCommsBadges(): CommsBadges {
  return cached;
}

export async function fetchCommsBadges(opts?: { force?: boolean }): Promise<CommsBadges> {
  if (!getToken()) {
    cached = { ...EMPTY_COMMS_BADGES };
    cachedAt = Date.now();
    return cached;
  }
  if (!opts?.force && cachedAt && Date.now() - cachedAt < CACHE_MS) {
    return cached;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await api<CommsBadges>("/v1/comms/badges");
      cached = {
        chatUnread: Number(res.chatUnread ?? 0),
        inboxUnread: Number(res.inboxUnread ?? 0),
        calendarPending: Number(res.calendarPending ?? 0),
        friendRequestsPending: Number(res.friendRequestsPending ?? 0),
        total: Number(res.total ?? 0),
      };
      cachedAt = Date.now();
      return cached;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
