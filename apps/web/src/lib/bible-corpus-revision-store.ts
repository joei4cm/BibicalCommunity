const REV_KEY = (tid: string) => `lh.bible.corpusRevision.${tid}`;
const CHECKED_KEY = (tid: string) => `lh.bible.corpusRevisionCheckedAt.${tid}`;

/** Public-domain text almost never changes — check at most weekly. */
export const CORPUS_REVISION_CHECK_MS = 7 * 24 * 60 * 60 * 1000;

export function loadStoredCorpusRevision(tid: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(REV_KEY(tid));
}

export function saveStoredCorpusRevision(
  tid: string,
  revision: string,
  checkedAt = Date.now(),
): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(REV_KEY(tid), revision);
  localStorage.setItem(CHECKED_KEY(tid), String(checkedAt));
}

export function corpusRevisionCheckDue(tid: string, now = Date.now()): boolean {
  if (typeof localStorage === "undefined") return false;
  const raw = localStorage.getItem(CHECKED_KEY(tid));
  if (!raw) return true;
  const at = Number(raw);
  if (!Number.isFinite(at)) return true;
  return now - at >= CORPUS_REVISION_CHECK_MS;
}

export function parseCorpusRevision(
  raw: { revision?: string } | null | undefined,
): string | null {
  const rev = raw?.revision;
  return typeof rev === "string" && rev.trim() ? rev.trim() : null;
}
