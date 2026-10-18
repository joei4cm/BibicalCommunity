import { payloadPreview } from "./chat-payload";
import { decodeStoredChatMessage } from "./chat-decode";
import { listThreads, readPlainSync, writeChatPreview } from "./chat-local";

let started = false;

/** Decrypt ciphertext that is already on this device. Does not fetch or mark threads read. */
export function scheduleChatLocalDecrypt(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const run = () => {
    void decryptCachedThreads().catch(() => {});
  };
  const idle = window.requestIdleCallback;
  if (typeof idle === "function") idle(run, { timeout: 2000 });
  else window.setTimeout(run, 600);
}

async function decryptCachedThreads(): Promise<void> {
  const threads = await listThreads();
  const selfUserId =
    typeof localStorage !== "undefined" ? localStorage.getItem("lh.userId") : null;
  let budget = 30;
  let changed = false;
  const ordered = [...threads].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  for (const thread of ordered) {
    let preview = "";
    let previewAt = 0;
    for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
      const message = thread.messages[i]!;
      let text = readPlainSync(message.id);
      if (!text && budget > 0) {
        budget -= 1;
        text = await decodeStoredChatMessage({
          conversationId: thread.conversationId,
          messageId: message.id,
          ratchetHeader: message.ratchetHeader,
          ciphertext: message.ciphertext,
          peerUserId: thread.peerUserId,
          selfUserId,
        });
      }
      if (text && text !== "[ciphertext]" && !preview) {
        preview = payloadPreview(text, text);
        previewAt = message.createdAt;
      }
      if (preview && budget <= 0) break;
    }
    if (preview) {
      writeChatPreview(thread.conversationId, preview, previewAt);
      changed = true;
    }
  }
  if (changed) window.dispatchEvent(new Event("lh:chat-previews"));
}
