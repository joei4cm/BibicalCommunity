import { performLocalWipe, type WipeLocalResult } from "@logoshome/crypto";

/**
 * Clear all `lh.*` localStorage keys (token, theme, device priv, etc.).
 * IndexedDB / Cache Storage hooks are best-effort for PWA scaffolding.
 */
export async function wipeLocalClientState(): Promise<WipeLocalResult> {
  return performLocalWipe({
    clearKeys: async () => {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("lh."));
      for (const k of keys) localStorage.removeItem(k);
    },
    clearMessageDb: async () => {
      if (typeof indexedDB === "undefined") return;
      // Best-effort: delete known LogosHome DBs if present.
      const known = ["lh-messages", "lh-notes", "logoshome"];
      await Promise.all(
        known.map(
          (name) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            }),
        ),
      );
    },
    clearCaches: async () => {
      if (typeof caches === "undefined") return;
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    },
  });
}
