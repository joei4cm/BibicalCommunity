/**
 * Device-local chat cache. Ciphertext threads live in IndexedDB (`lh-messages`,
 * already wiped with the rest of the client). Plaintext stays in `lh.msg.*`
 * so a reopened thread can paint before the network decrypts again.
 */

const PREVIEW_KEY = "lh.chat.previews";
const PLAIN_PREFIX = "lh.msg.";
const DB_NAME = "lh-messages";
const DB_VERSION = 1;
const STORE = "threads";
const MAX_MESSAGES = 80;
const MAX_PREVIEW = 80;
const MAX_THREADS = 40;

export type StoredChatMessage = {
  id: string;
  senderDeviceId: string;
  senderUserId?: string | null;
  ratchetHeader: string;
  ciphertext: string;
  contentType: string;
  createdAt: number;
  expiresAt: number | null;
};

export type StoredThread = {
  conversationId: string;
  peerUserId: string | null;
  messages: StoredChatMessage[];
  updatedAt: number;
};

export type ChatPreview = { text: string; at: number };

export function trimThread(
  messages: StoredChatMessage[],
  now = Date.now(),
): StoredChatMessage[] {
  return messages
    .filter((m) => m.id && (m.expiresAt == null || m.expiresAt > now))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-MAX_MESSAGES);
}

export function clipPreview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_PREVIEW);
}

export function upsertPreview(
  map: Record<string, ChatPreview>,
  conversationId: string,
  text: string,
  at: number,
): Record<string, ChatPreview> {
  const clipped = clipPreview(text);
  if (!clipped || clipped === "[ciphertext]") return map;
  const next = { ...map, [conversationId]: { text: clipped, at } };
  return Object.fromEntries(
    Object.entries(next)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX_THREADS),
  );
}

export function readPlainSync(messageId: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(PLAIN_PREFIX + messageId);
    if (!value || value === "[ciphertext]") return null;
    return value;
  } catch {
    return null;
  }
}

export function writePlainSync(messageId: string, text: string): void {
  if (typeof localStorage === "undefined") return;
  if (!messageId || !text || text === "[ciphertext]") return;
  try {
    localStorage.setItem(PLAIN_PREFIX + messageId, text.slice(0, 4000));
  } catch {
    /* quota — keep the thread usable */
  }
}

export function readChatPreviews(): Record<string, ChatPreview> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(PREVIEW_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ChatPreview>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export function writeChatPreview(conversationId: string, text: string, at: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    const next = upsertPreview(readChatPreviews(), conversationId, text, at);
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "conversationId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("chat_idb_open_failed"));
  });
}

export async function readThread(conversationId: string): Promise<StoredThread | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(conversationId);
      req.onsuccess = () => resolve((req.result as StoredThread | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("chat_idb_get_failed"));
    });
  } finally {
    db.close();
  }
}

export async function writeThread(
  conversationId: string,
  peerUserId: string | null,
  messages: StoredChatMessage[],
): Promise<void> {
  if (typeof indexedDB === "undefined" || !conversationId) return;
  const row: StoredThread = {
    conversationId,
    peerUserId,
    messages: trimThread(messages),
    updatedAt: Date.now(),
  };
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("chat_idb_put_failed"));
    });
  } finally {
    db.close();
  }
}

export async function listThreads(): Promise<StoredThread[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as StoredThread[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error("chat_idb_list_failed"));
    });
  } finally {
    db.close();
  }
}
