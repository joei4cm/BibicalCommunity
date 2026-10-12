/** WhatsApp / Telegram style: single tick = sent, double = peer has read. */
export function messageReceiptState(
  createdAt: number,
  peerLastReadAt: number | null | undefined,
): "sent" | "read" {
  if (peerLastReadAt != null && peerLastReadAt >= createdAt) return "read";
  return "sent";
}
