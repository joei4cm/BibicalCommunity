import { api, getToken } from "./api";
import { readCachedConversations, writeCachedConversations } from "./chat-local";

type ConversationsResponse = { conversations: unknown[] };

let inflight: Promise<unknown[]> | null = null;
let fetchedAt = 0;
const FRESH_MS = 8_000;

/**
 * Shared conversations GET for CallProvider + ChatPanel.
 * Dedupes concurrent callers and skips a network round-trip when a fresh
 * snapshot was just written to the local cache.
 */
export async function fetchConversationsList(opts?: {
  force?: boolean;
}): Promise<unknown[]> {
  if (!getToken()) return [];
  if (!opts?.force && inflight) return inflight;
  if (!opts?.force && fetchedAt > 0 && Date.now() - fetchedAt < FRESH_MS) {
    return readCachedConversations<unknown>();
  }

  inflight = (async () => {
    try {
      const res = await api<ConversationsResponse>("/v1/chat/conversations");
      const list = Array.isArray(res.conversations) ? res.conversations : [];
      writeCachedConversations(list);
      fetchedAt = Date.now();
      return list;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
