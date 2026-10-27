import { api } from "./api";
import {
  CORPUS_REVISION_CHECK_MS,
  corpusRevisionCheckDue,
  loadStoredCorpusRevision,
  parseCorpusRevision,
  saveStoredCorpusRevision,
} from "./bible-corpus-revision-store";

export {
  CORPUS_REVISION_CHECK_MS,
  corpusRevisionCheckDue,
  loadStoredCorpusRevision,
  parseCorpusRevision,
  saveStoredCorpusRevision,
};

export type CorpusRevisionPayload = {
  translationId: string;
  revision: string;
  source?: string;
};

export type CorpusRefreshFn = (tid: string) => Promise<void>;

/**
 * Fetch server corpus revision. Returns null when offline / request fails.
 */
export async function fetchCorpusRevision(tid: string): Promise<string | null> {
  try {
    const res = await api<CorpusRevisionPayload>(
      `/v1/bible/corpus-revision/${encodeURIComponent(tid)}`,
    );
    return parseCorpusRevision(res);
  } catch {
    return null;
  }
}

/**
 * If the server revision moved, refresh the local pack via `refreshPack`.
 * Unchanged revisions only bump the checked-at timestamp (no download).
 */
export async function revalidateCorpusIfChanged(
  tid: string,
  refreshPack?: CorpusRefreshFn,
): Promise<{ checked: boolean; changed: boolean }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { checked: false, changed: false };
  }
  if (!corpusRevisionCheckDue(tid)) {
    return { checked: false, changed: false };
  }
  const remote = await fetchCorpusRevision(tid);
  if (!remote) return { checked: false, changed: false };
  const local = loadStoredCorpusRevision(tid);
  if (local === remote) {
    saveStoredCorpusRevision(tid, remote);
    return { checked: true, changed: false };
  }
  // First observation — remember it; only re-pull when a prior revision flips.
  if (local == null) {
    saveStoredCorpusRevision(tid, remote);
    return { checked: true, changed: false };
  }
  if (refreshPack) {
    try {
      await refreshPack(tid);
    } catch {
      /* keep serving prior local chapters */
    }
  }
  saveStoredCorpusRevision(tid, remote);
  return { checked: true, changed: true };
}

let revisionTask: Promise<void> | null = null;

/** Idle / delayed weekly revision check (default 和合本). */
export function scheduleCorpusRevisionCheck(
  tid: string,
  refreshPack?: CorpusRefreshFn,
): Promise<void> {
  if (revisionTask) return revisionTask;
  if (typeof window === "undefined") {
    revisionTask = Promise.resolve();
    return revisionTask;
  }
  revisionTask = new Promise((resolve) => {
    const start = () => {
      void revalidateCorpusIfChanged(tid, refreshPack)
        .catch(() => undefined)
        .finally(resolve);
    };
    window.setTimeout(() => {
      const idle = window.requestIdleCallback;
      if (typeof idle === "function") idle(start, { timeout: 60_000 });
      else start();
    }, 120_000);
  });
  return revisionTask;
}
