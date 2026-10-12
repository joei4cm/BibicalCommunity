import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_COMMS_BADGES,
  fetchCommsBadges,
  subscribeCommsBadges,
  type CommsBadges,
} from "../lib/comms-badges";
import { getToken } from "../lib/api";

const POLL_MS = 30_000;

export function useCommsBadges() {
  const [badges, setBadges] = useState<CommsBadges>(EMPTY_COMMS_BADGES);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setBadges(EMPTY_COMMS_BADGES);
      return;
    }
    try {
      setBadges(await fetchCommsBadges());
    } catch {
      /* keep last good counts */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsub = subscribeCommsBadges(() => {
      void refresh();
    });
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      unsub();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { badges, refresh };
}
