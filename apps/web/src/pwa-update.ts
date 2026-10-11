/**
 * Keep installed PWAs from sticking on stale precaches after a Pages deploy.
 * Uses native Service Worker APIs (no workbox-window) — VitePWA already
 * injects registerSW.js; we only poll updates and reload on controllerchange.
 */

let reloading = false;

function reloadOnce() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

async function pingUpdates() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    reloadOnce();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void pingUpdates();
  });
  window.addEventListener("focus", () => {
    void pingUpdates();
  });
  window.setInterval(() => {
    void pingUpdates();
  }, 5 * 60 * 1000);

  // First paint: ask for an update check once SW is ready.
  void navigator.serviceWorker.ready.then(() => pingUpdates()).catch(() => undefined);
}
