import { decryptSessionPayload, deriveSessionKey } from "@logoshome/crypto";
import { decryptGroupFanout, isGroupFanoutHeader } from "./group-fanout";
import { decryptChatMessage } from "./secure-chat";
import { readPlainSync, writePlainSync } from "./chat-local";

/** Decrypt one stored message, reusing the local plaintext cache when it exists. */
export async function decodeStoredChatMessage(opts: {
  conversationId: string;
  messageId: string;
  ratchetHeader: string;
  ciphertext: string;
  peerUserId: string | null;
  selfUserId: string | null;
}): Promise<string> {
  const cached = readPlainSync(opts.messageId);
  if (cached) return cached;
  const remember = (text: string) => {
    if (text && text !== "[ciphertext]") writePlainSync(opts.messageId, text);
    return text;
  };
  try {
    if (isGroupFanoutHeader(opts.ratchetHeader) && opts.selfUserId) {
      return remember(
        await decryptGroupFanout({
          conversationId: opts.conversationId,
          ratchetHeader: opts.ratchetHeader,
          ciphertext: opts.ciphertext,
          selfUserId: opts.selfUserId,
        }),
      );
    }
    return remember(
      await decryptChatMessage(
        opts.conversationId,
        opts.ratchetHeader,
        opts.ciphertext,
        opts.peerUserId,
        opts.selfUserId,
      ),
    );
  } catch {
    try {
      const key = await deriveSessionKey(`lh-convo:${opts.conversationId}`);
      return remember(
        await decryptSessionPayload(key, opts.ratchetHeader, opts.ciphertext),
      );
    } catch {
      return "[ciphertext]";
    }
  }
}
