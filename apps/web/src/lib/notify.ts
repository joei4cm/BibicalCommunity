/**
 * Generic OS notifications for installed PWA / web (no message plaintext — SECURITY.md).
 */

export type NotifyKind = "message" | "call";

const PREF_KEY = "lh.notify.prefs";

export type NotifyPrefs = {
  notifyMessages: boolean;
  notifyCalls: boolean;
};

const DEFAULT_PREFS: NotifyPrefs = {
  notifyMessages: true,
  notifyCalls: true,
};

export function loadNotifyPrefs(): NotifyPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotifyPrefs>;
    return {
      notifyMessages: parsed.notifyMessages ?? true,
      notifyCalls: parsed.notifyCalls ?? true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveNotifyPrefs(prefs: Partial<NotifyPrefs>): NotifyPrefs {
  const next = { ...loadNotifyPrefs(), ...prefs };
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Must be called from a user gesture on iOS PWA. */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function shouldAlertWhenHidden(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "visible" || !document.hasFocus();
}

/**
 * Show a generic notification. Skips when permission missing, prefs off, or
 * (for messages) the app is focused — unless `force`.
 */
export function showAppNotification(opts: {
  kind: NotifyKind;
  title: string;
  body?: string;
  tag?: string;
  force?: boolean;
  onClickUrl?: string;
}): boolean {
  const prefs = loadNotifyPrefs();
  if (opts.kind === "message" && !prefs.notifyMessages) return false;
  if (opts.kind === "call" && !prefs.notifyCalls) return false;
  if (notificationPermission() !== "granted") return false;
  if (!opts.force && opts.kind === "message" && !shouldAlertWhenHidden()) return false;

  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag ?? `lh-${opts.kind}`,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      silent: false,
    });
    if (opts.onClickUrl) {
      n.onclick = () => {
        try {
          window.focus();
          if (opts.onClickUrl) window.location.assign(opts.onClickUrl);
        } catch {
          /* ignore */
        }
        n.close();
      };
    }
    return true;
  } catch {
    return false;
  }
}
