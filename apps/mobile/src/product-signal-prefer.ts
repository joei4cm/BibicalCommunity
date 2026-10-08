/**
 * Opt-in product Signal backend preference (Expo).
 * Default remains x25519; OpenE2EE selectable for Workers-portable PQ path.
 */
import type { SignalBackend } from "@logoshome/crypto";
import { kvGet, kvSet } from "./secure-kv";

export const PRODUCT_SIGNAL_PREFER_KEY = "lh.signalBackend";

export type ProductSignalPrefer = Extract<SignalBackend, "x25519" | "opene2ee">;

export async function loadProductSignalPrefer(): Promise<ProductSignalPrefer> {
  const { value } = await kvGet(PRODUCT_SIGNAL_PREFER_KEY);
  if (value === "opene2ee") return "opene2ee";
  return "x25519";
}

export async function saveProductSignalPrefer(prefer: ProductSignalPrefer): Promise<void> {
  await kvSet(PRODUCT_SIGNAL_PREFER_KEY, prefer);
}
