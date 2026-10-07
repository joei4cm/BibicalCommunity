/** Allowed WebRTC signaling message types for CallRoom DO fan-out (no media). */
export const CALL_SIGNAL_TYPES = [
  "offer",
  "answer",
  "ice",
  "hangup",
  "screen",
  "screen-offer",
  "screen-answer",
] as const;

export type CallSignalType = (typeof CALL_SIGNAL_TYPES)[number];

export function isCallSignalType(type: unknown): type is CallSignalType {
  return typeof type === "string" && (CALL_SIGNAL_TYPES as readonly string[]).includes(type);
}
