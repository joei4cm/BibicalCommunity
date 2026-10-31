/**
 * Encrypted cloud sync for reader place + recent history.
 * Ciphertext is AES-GCM with the same local note key as bookmarks/notes.
 * Server stores opaque blobs only (`/v1/me/vault/:kind`).
 */

import type { VaultKind } from "@logoshome/shared";
import { api, getToken } from "./api";
import { decryptJson, encryptJson } from "./note-crypto";
import { loadReaderPlace, parseReaderPlace, saveReaderPlace, type ReaderPlace } from "./reader-place";
import {
  loadReaderHistory,
  parseReaderHistory,
  persistReaderHistory,
  recordReaderVisitLocal,
  type ReaderHistoryEntry,
} from "./reader-history";

export type { ReaderHistoryEntry } from "./reader-history";
export { loadReaderHistory } from "./reader-history";

const AAD_PLACE = "vault:reader_place";
const AAD_HISTORY = "vault:reader_history";

type VaultGetResponse = {
  kind: VaultKind;
  blob: { ciphertext: string; iv: string; updatedAt: number } | null;
};

/** Record a visit locally (and queue cloud push when logged in). */
export function recordReaderVisit(place: ReaderPlace): ReaderHistoryEntry[] {
  const next = recordReaderVisitLocal(place);
  void pushReaderVault().catch(() => {
    /* offline / unauthorized — local wins */
  });
  return next;
}

async function putVault(kind: VaultKind, value: unknown, aad: string): Promise<void> {
  if (!getToken()) return;
  const { ciphertext, iv } = await encryptJson(value, aad);
  await api(`/v1/me/vault/${kind}`, {
    method: "PUT",
    body: JSON.stringify({ ciphertext, iv }),
  });
}

async function getVault<T>(
  kind: VaultKind,
  aad: string,
): Promise<{ value: T; updatedAt: number } | null> {
  if (!getToken()) return null;
  const res = await api<VaultGetResponse>(`/v1/me/vault/${kind}`);
  if (!res.blob) return null;
  const value = await decryptJson<T>(res.blob.ciphertext, res.blob.iv, aad);
  return { value, updatedAt: res.blob.updatedAt };
}

/** Push local place + history ciphertext to the account vault. */
export async function pushReaderVault(): Promise<void> {
  if (!getToken()) return;
  const place = loadReaderPlace();
  if (place) {
    await putVault("reader_place", { ...place, updatedAt: Date.now() }, AAD_PLACE);
  }
  await putVault("reader_history", { entries: loadReaderHistory() }, AAD_HISTORY);
}

/**
 * Pull encrypted vault blobs, merge into localStorage.
 * Call after login / app boot when a session token exists.
 */
export async function pullReaderVault(): Promise<{
  place: ReaderPlace | null;
  history: ReaderHistoryEntry[];
}> {
  if (!getToken()) {
    return { place: loadReaderPlace(), history: loadReaderHistory() };
  }

  let place = loadReaderPlace();
  try {
    const remotePlace = await getVault<ReaderPlace & { updatedAt?: number }>(
      "reader_place",
      AAD_PLACE,
    );
    if (remotePlace?.value) {
      const parsed = parseReaderPlace(JSON.stringify(remotePlace.value));
      if (parsed && !place) {
        saveReaderPlace(parsed);
        place = parsed;
      }
    }
  } catch {
    /* decrypt/network — keep local */
  }

  let history = loadReaderHistory();
  try {
    const remoteHistory = await getVault<{ entries?: ReaderHistoryEntry[] }>(
      "reader_history",
      AAD_HISTORY,
    );
    const remoteEntries = parseReaderHistory(
      JSON.stringify(remoteHistory?.value?.entries ?? []),
    );
    history = persistReaderHistory([...history, ...remoteEntries]);
  } catch {
    /* keep local */
  }

  void pushReaderVault().catch(() => undefined);
  return { place, history };
}
