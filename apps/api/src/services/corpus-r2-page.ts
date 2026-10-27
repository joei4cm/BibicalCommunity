/**
 * Efficient R2 corpus page reads for /v1/bible/corpus-download.
 * Avoids listing every chapter key on each page, and fans out media.get.
 */
import {
  parseR2ChapterJson,
  parseR2ChapterObjectKey,
  type R2ChapterJson,
} from "@logoshome/bible";

export const CORPUS_GET_CONCURRENCY = 24;

/** Run async work over items with a fixed concurrency pool. */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return out;
}

type R2ListLike = {
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
    startAfter?: string;
  }): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
};

/**
 * List only the next page of chapter object keys under a prefix.
 * Uses R2 startAfter so we never re-scan earlier keys.
 */
export async function listR2ChapterKeyPage(
  media: R2ListLike,
  prefix: string,
  opts: { afterKey?: string; limit: number },
): Promise<{ keys: string[]; done: boolean; nextAfter: string | null }> {
  const want = Math.max(1, Math.min(200, opts.limit));
  const keys: string[] = [];
  let startAfter = opts.afterKey || undefined;
  let cursor: string | undefined;
  let exhausted = false;

  // Pull a little extra when non-chapter keys (future pack markers) appear.
  while (keys.length < want && !exhausted) {
    const batchLimit = Math.min(1000, Math.max(want - keys.length + 8, 16));
    const listed = await media.list({
      prefix,
      limit: batchLimit,
      ...(cursor ? { cursor } : startAfter ? { startAfter } : {}),
    });
    if (!listed.objects.length) {
      exhausted = true;
      break;
    }
    for (const obj of listed.objects) {
      if (!parseR2ChapterObjectKey(obj.key)) continue;
      keys.push(obj.key);
      if (keys.length >= want) break;
    }
    // Filled a full page — caller continues with nextAfter (more may remain).
    if (keys.length >= want) break;
    if (!listed.truncated) {
      exhausted = true;
      break;
    }
    cursor = listed.cursor;
    startAfter = listed.objects[listed.objects.length - 1]?.key;
  }

  // Short page ⇒ listing exhausted. Full page ⇒ more keys may follow.
  const done = keys.length < want || exhausted;
  return {
    keys,
    done,
    nextAfter: done || !keys.length ? null : keys[keys.length - 1]!,
  };
}

/** Fetch and parse chapter JSON for a page of R2 keys (parallel). */
export async function fetchR2ChaptersByKeys(
  media: R2ListLike,
  keys: readonly string[],
  concurrency = CORPUS_GET_CONCURRENCY,
): Promise<R2ChapterJson[]> {
  const parsed = await mapPool(keys, concurrency, async (key) => {
    const body = await media.get(key);
    if (!body) return null;
    try {
      return parseR2ChapterJson(await body.text());
    } catch {
      return null;
    }
  });
  return parsed.filter((ch): ch is R2ChapterJson => ch != null);
}
