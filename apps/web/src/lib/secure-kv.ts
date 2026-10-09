/**
 * IndexedDB key-value store for E2EE chat secrets (ratchet state, device priv).
 * Prefer this over localStorage so remote wipe can deleteDatabase("lh-secure").
 */

const DB_NAME = "lh-secure";
const STORE = "kv";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb_open_failed"));
  });
}

export async function secureGet(key: string): Promise<string | null> {
  if (typeof indexedDB === "undefined") {
    return localStorage.getItem(key);
  }
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result;
        resolve(typeof v === "string" ? v : v == null ? null : String(v));
      };
      req.onerror = () => reject(req.error ?? new Error("idb_get_failed"));
    });
  } finally {
    db.close();
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (typeof indexedDB === "undefined") {
    localStorage.setItem(key, value);
    return;
  }
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb_set_failed"));
    });
  } finally {
    db.close();
  }
}

export async function secureRemove(key: string): Promise<void> {
  if (typeof indexedDB === "undefined") {
    localStorage.removeItem(key);
    return;
  }
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb_del_failed"));
    });
  } finally {
    db.close();
  }
}

/** One-time migrate known localStorage E2EE keys into IndexedDB. */
export async function migrateSecureFromLocalStorage(keys: string[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    await secureSet(key, raw);
    localStorage.removeItem(key);
  }
}
