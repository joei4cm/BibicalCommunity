/**
 * Mobile group fan-out — mirrors apps/web/src/lib/group-fanout.ts.
 */
import { decryptMobileMessage, degradedChatAllowed, encryptMobileMessage } from "./session-crypto";

export const GROUP_FANOUT_HEADER = "group-fanout:v1";

export type GroupEnvelope = {
  ratchetHeader: string;
  ciphertext: string;
};

export type GroupFanoutBlob = {
  v: 1;
  from: string;
  envelopes: Record<string, GroupEnvelope>;
};

export function isGroupFanoutHeader(ratchetHeader: string): boolean {
  return ratchetHeader === GROUP_FANOUT_HEADER;
}

export async function encryptGroupFanout(opts: {
  conversationId: string;
  plaintext: string;
  fromUserId: string;
  peerUserIds: string[];
}): Promise<{
  ratchetHeader: string;
  ciphertext: string;
  mode: "group-fanout";
  degradedPeers: string[];
}> {
  const peers = Array.from(new Set(opts.peerUserIds.filter(Boolean)));
  if (peers.length === 0) throw new Error("group_peers_required");

  const envelopes: Record<string, GroupEnvelope> = {};
  const degradedPeers: string[] = [];

  for (const peerId of peers) {
    const enc = await encryptMobileMessage(opts.conversationId, opts.plaintext, peerId);
    envelopes[peerId] = {
      ratchetHeader: enc.ratchetHeader,
      ciphertext: enc.ciphertext,
    };
    if (enc.mode === "degraded") degradedPeers.push(peerId);
  }

  if (degradedPeers.length > 0 && !degradedChatAllowed()) {
    throw new Error("chat_keys_required");
  }

  const blob: GroupFanoutBlob = {
    v: 1,
    from: opts.fromUserId,
    envelopes,
  };

  return {
    ratchetHeader: GROUP_FANOUT_HEADER,
    ciphertext: JSON.stringify(blob),
    mode: "group-fanout",
    degradedPeers,
  };
}

export async function decryptGroupFanout(opts: {
  conversationId: string;
  ratchetHeader: string;
  ciphertext: string;
  selfUserId: string;
}): Promise<string> {
  if (!isGroupFanoutHeader(opts.ratchetHeader)) {
    throw new Error("not_group_fanout");
  }
  let blob: GroupFanoutBlob;
  try {
    blob = JSON.parse(opts.ciphertext) as GroupFanoutBlob;
  } catch {
    throw new Error("group_fanout_invalid");
  }
  if (blob?.v !== 1 || !blob.envelopes || typeof blob.envelopes !== "object") {
    throw new Error("group_fanout_invalid");
  }
  const mine = blob.envelopes[opts.selfUserId];
  if (!mine?.ratchetHeader || !mine.ciphertext) {
    throw new Error("group_fanout_no_envelope");
  }
  const plain = await decryptMobileMessage(
    opts.conversationId,
    mine.ratchetHeader,
    mine.ciphertext,
    blob.from || null,
  );
  if (plain == null) throw new Error("group_fanout_decrypt_failed");
  return plain;
}
