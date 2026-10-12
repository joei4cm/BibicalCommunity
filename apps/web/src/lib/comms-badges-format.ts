export type CommsBadges = {
  chatUnread: number;
  inboxUnread: number;
  calendarPending: number;
  friendRequestsPending: number;
  total: number;
};

export const EMPTY_COMMS_BADGES: CommsBadges = {
  chatUnread: 0,
  inboxUnread: 0,
  calendarPending: 0,
  friendRequestsPending: 0,
  total: 0,
};

/** Display helper: 99+ cap for compact chips. */
export function formatBadgeCount(n: number): string {
  if (n <= 0) return "";
  if (n > 99) return "99+";
  return String(n);
}
