import { api, getToken } from "./api";
import {
  EMPTY_COMMS_BADGES,
  type CommsBadges,
} from "./comms-badges-format";

export type { CommsBadges };
export { EMPTY_COMMS_BADGES, formatBadgeCount } from "./comms-badges-format";

type Listener = () => void;
const listeners = new Set<Listener>();

/** Notify TabBar / ChatPage to refetch badge counts after read/accept actions. */
export function notifyCommsBadgesChanged() {
  for (const fn of listeners) fn();
}

export function subscribeCommsBadges(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function fetchCommsBadges(): Promise<CommsBadges> {
  if (!getToken()) return { ...EMPTY_COMMS_BADGES };
  const res = await api<CommsBadges>("/v1/comms/badges");
  return {
    chatUnread: Number(res.chatUnread ?? 0),
    inboxUnread: Number(res.inboxUnread ?? 0),
    calendarPending: Number(res.calendarPending ?? 0),
    friendRequestsPending: Number(res.friendRequestsPending ?? 0),
    total: Number(res.total ?? 0),
  };
}
