/**
 * Keep installed PWAs from sticking on stale precaches after a Pages deploy.
 * - Poll SW update on focus / visibility
 * - Reload once when a new controller takes over
 */
import { registerSW } from "virtual:pwa-register";

let reloading = false;

function reloadOnce() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    reloadOnce();
  });
}

registerSW({
  immediate: true,
  onRegisteredSW(_url: string, registration: ServiceWorkerRegistration | undefined) {
    if (!registration) return;
    const ping = () => {
      void registration.update();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") ping();
    });
    window.addEventListener("focus", ping);
    window.setInterval(ping, 5 * 60 * 1000);
  },
  onNeedRefresh() {
    reloadOnce();
  },
});
