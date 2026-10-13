import { api, getToken } from "./api";
import { encodeChatPayload, type ChatPayload } from "./chat-payload";
import { encryptChatMessage } from "./secure-chat";
import { encryptGroupFanout } from "./group-fanout";

/** Broadcast so ChatPanel can reload the open thread after a control post. */
export function notifyChatMessagesChanged(conversationId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("lh:chat-messages", { detail: { conversationId } }),
  );
}

/**
 * Post an encrypted control payload (call records, etc.). Does not bump unread
 * (server only counts contentType=msg).
 */
export async function postControlMessage(opts: {
  conversationId: string;
  payload: ChatPayload;
  peerUserIds?: string[];
  selfUserId?: string | null;
  kind?: "dm" | "group" | "seminar";
}): Promise<string | null> {
  if (!getToken()) return null;
  const plaintext = encodeChatPayload(opts.payload);
  const peers = opts.peerUserIds ?? [];
  let ratchetHeader: string;
  let ciphertext: string;

  if (opts.kind === "group" && peers.length >= 1 && opts.selfUserId) {
    const fanout = await encryptGroupFanout({
      conversationId: opts.conversationId,
      plaintext,
      fromUserId: opts.selfUserId,
      peerUserIds: peers,
    });
    ratchetHeader = fanout.ratchetHeader;
    ciphertext = fanout.ciphertext;
  } else {
    const enc = await encryptChatMessage(
      opts.conversationId,
      plaintext,
      peers[0] ?? null,
      opts.selfUserId,
    );
    ratchetHeader = enc.ratchetHeader;
    ciphertext = enc.ciphertext;
  }

  const res = await api<{ id: string }>(
    `/v1/chat/conversations/${opts.conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        ratchetHeader,
        ciphertext,
        contentType: "control",
      }),
    },
  );
  try {
    localStorage.setItem(`lh.msg.${res.id}`, plaintext);
  } catch {
    /* ignore */
  }
  notifyChatMessagesChanged(opts.conversationId);
  return res.id;
}
