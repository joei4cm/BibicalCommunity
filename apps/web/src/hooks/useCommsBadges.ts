import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_COMMS_BADGES,
  fetchCommsBadges,
  peekCommsBadges,
  subscribeCommsBadges,
  type CommsBadges,
} from "../lib/comms-badges";
import { getToken } from "../lib/api";

/** Shared badge state — one network poll for TabBar + ChatPage + NotifyHost. */
export function useCommsBadges() {
  const [badges, setBadges] = useState<CommsBadges>(() => peekCommsBadges());

  const refresh = useCallback(async (force = false) => {
    if (!getToken()) {
      setBadges(EMPTY_COMMS_BADGES);
      return;
    }
    try {
      setBadges(await fetchCommsBadges({ force }));
    } catch {
      /* keep last good counts */
    }
  }, []);

  useEffect(() => {
    // Defer first badge fetch so Bible/chapter traffic wins the first seconds.
    const boot = window.setTimeout(() => void refresh(false), 2_500);
    const unsub = subscribeCommsBadges(() => {
      setBadges(peekCommsBadges());
      void refresh(false);
    });
    const onFocus = () => {
      void refresh(true);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(boot);
      unsub();
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { badges, refresh: () => refresh(true) };
}
