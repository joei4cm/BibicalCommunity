/**
 * Product Signal backend preference (browser).
 * Default matches Workers/browser factory → OpenE2EE; X25519 remains selectable.
 * Does not flip LIBSIGNAL_WORKERS_OK (official Signal WASM still OPEN).
 */
import type { SignalBackend } from "@logoshome/crypto";

export const PRODUCT_SIGNAL_PREFER_KEY = "lh.signalBackend";

export type ProductSignalPrefer = Extract<SignalBackend, "x25519" | "opene2ee">;

export function loadProductSignalPrefer(): ProductSignalPrefer {
  try {
    const raw = localStorage.getItem(PRODUCT_SIGNAL_PREFER_KEY);
    if (raw === "x25519") return "x25519";
    if (raw === "opene2ee") return "opene2ee";
  } catch {
    /* private mode */
  }
  return "opene2ee";
}

export function saveProductSignalPrefer(prefer: ProductSignalPrefer): void {
  try {
    localStorage.setItem(PRODUCT_SIGNAL_PREFER_KEY, prefer);
  } catch {
    /* ignore */
  }
}
