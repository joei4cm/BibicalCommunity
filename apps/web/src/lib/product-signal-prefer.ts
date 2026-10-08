/**
 * Opt-in product Signal backend preference (browser).
 * Default remains x25519; OpenE2EE is selectable for Workers-portable PQ path.
 * Does not flip LIBSIGNAL_WORKERS_OK (official Signal WASM still OPEN).
 */
import type { SignalBackend } from "@logoshome/crypto";

export const PRODUCT_SIGNAL_PREFER_KEY = "lh.signalBackend";

export type ProductSignalPrefer = Extract<SignalBackend, "x25519" | "opene2ee">;

export function loadProductSignalPrefer(): ProductSignalPrefer {
  try {
    const raw = localStorage.getItem(PRODUCT_SIGNAL_PREFER_KEY);
    if (raw === "opene2ee") return "opene2ee";
  } catch {
    /* private mode */
  }
  return "x25519";
}

export function saveProductSignalPrefer(prefer: ProductSignalPrefer): void {
  try {
    localStorage.setItem(PRODUCT_SIGNAL_PREFER_KEY, prefer);
  } catch {
    /* ignore */
  }
}
