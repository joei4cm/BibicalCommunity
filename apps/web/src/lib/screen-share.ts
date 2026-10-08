/**
 * Display-media capability gate for screen share.
 * The live OS picker still requires a user gesture in a secure context —
 * this module only reports whether the browser can invoke it.
 */

export type DisplayMediaGate = {
  available: boolean;
  secureContext: boolean;
  hasGetDisplayMedia: boolean;
  reason?: "insecure_context" | "unsupported" | "ok";
};

export function probeDisplayMedia(): DisplayMediaGate {
  const secureContext = typeof window !== "undefined" ? window.isSecureContext : false;
  const hasGetDisplayMedia =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function";
  if (!secureContext) {
    return { available: false, secureContext, hasGetDisplayMedia, reason: "insecure_context" };
  }
  if (!hasGetDisplayMedia) {
    return { available: false, secureContext, hasGetDisplayMedia, reason: "unsupported" };
  }
  return { available: true, secureContext, hasGetDisplayMedia, reason: "ok" };
}

export function canStartScreenShare(): boolean {
  return probeDisplayMedia().available;
}
