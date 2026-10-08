/**
 * Product Signal backend preference (Expo).
 * Default matches Workers/browser factory → OpenE2EE; X25519 remains selectable.
 */
import type { SignalBackend } from "@logoshome/crypto";
import { kvGet, kvSet } from "./secure-kv";

export const PRODUCT_SIGNAL_PREFER_KEY = "lh.signalBackend";

export type ProductSignalPrefer = Extract<SignalBackend, "x25519" | "opene2ee">;

export async function loadProductSignalPrefer(): Promise<ProductSignalPrefer> {
  const { value } = await kvGet(PRODUCT_SIGNAL_PREFER_KEY);
  if (value === "x25519") return "x25519";
  if (value === "opene2ee") return "opene2ee";
  return "opene2ee";
}

export async function saveProductSignalPrefer(prefer: ProductSignalPrefer): Promise<void> {
  await kvSet(PRODUCT_SIGNAL_PREFER_KEY, prefer);
}
