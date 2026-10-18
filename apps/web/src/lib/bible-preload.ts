import { bookIdFromSlug } from "@logoshome/bible";
import { api, getToken } from "./api";
import {
  cacheNetworkChapter,
  ensureBootCorpusSeeded,
  installDownloadedPack,
  readLocalChapter,
} from "./bible-local-db";
import { loadReaderPlace } from "./reader-place";

type CorpusPage = {
  chapters: { book: string; chapter: number; verses: { verse: number; text: string }[] }[];
  source?: string;
  done?: boolean;
  nextAfter?: string | null;
};

const WARM_KEY = "lh.bible.cuvsWarm.v3";
const PRELOAD_TIDS = ["cuvs", "web", "kjv", "asv"] as const;

/** Paged whole-Bible download — avoids one giant payload that stalls first paint. */
export async function fetchCorpusPackPaged(tid: string): Promise<CorpusPage | null> {
  let after: string | null = null;
  const chapters: CorpusPage["chapters"] = [];
  let source: string | undefined;
  for (let page = 0; page < 32; page += 1) {
    const qs = new URLSearchParams({ scope: "full", limit: "100" });
    if (after) qs.set("after", after);
    const pack = await api<CorpusPage>(
      `/v1/bible/corpus-download/${encodeURIComponent(tid)}?${qs.toString()}`,
    );
    if (pack.source) source = pack.source;
    if (pack.chapters?.length) chapters.push(...pack.chapters);
    if (pack.done !== false || !pack.nextAfter) {
      return chapters.length ? { chapters, source } : null;
    }
    after = pack.nextAfter;
  }
  return chapters.length ? { chapters, source } : null;
}

async function warmPdBooksInParallel(translationId: string, concurrency = 6): Promise<void> {
  const bookNrs = Array.from({ length: 66 }, (_, i) => i + 1);
  let cursor = 0;
  async function worker() {
    while (cursor < bookNrs.length) {
      const bookNr = bookNrs[cursor];
      cursor += 1;
      try {
        await api(`/v1/bible/corpus-warm/${encodeURIComponent(translationId)}?bookNr=${bookNr}`, {
          method: "POST",
        });
      } catch {
        /* continue other books */
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

/** One chapter for the last reading place, so the Bible tab can paint offline. */
async function prefetchReaderPlace(): Promise<void> {
  const place = loadReaderPlace();
  if (!place) return;
  const bookId = bookIdFromSlug(place.bookSlug);
  if (!bookId) return;
  const local = await readLocalChapter(place.tid, bookId, place.chapter);
  if (local) return;
  try {
    const data = await api<{
      verses?: { verse: number; text: string }[];
      source?: string;
    }>(
      `/v1/bible/chapter?translation=${encodeURIComponent(place.tid)}&ref=${encodeURIComponent(`${bookId}.${place.chapter}`)}`,
    );
    if (data.verses?.length) {
      await cacheNetworkChapter(place.tid, bookId, place.chapter, data.verses, data.source);
    }
  } catch {
    /* the open reader still fetches this chapter */
  }
}

async function warmInstalledCorpus(): Promise<void> {
  if (!getToken()) return;
  if (typeof localStorage !== "undefined" && localStorage.getItem(WARM_KEY) === "1") return;
  await warmPdBooksInParallel("cuvs", 6);
  for (const tid of PRELOAD_TIDS) {
    try {
      const pack = await fetchCorpusPackPaged(tid);
      if (pack?.chapters?.length && pack.source !== "demo") {
        await installDownloadedPack(tid, pack.chapters);
        try {
          await api("/v1/bible/entitlements", {
            method: "POST",
            body: JSON.stringify({ translationId: tid }),
          });
        } catch {
          /* public-domain or already granted */
        }
      }
    } catch {
      /* keep reading via per-chapter API */
    }
  }
  if (typeof localStorage !== "undefined") localStorage.setItem(WARM_KEY, "1");
}

async function runBiblePreload(): Promise<void> {
  await ensureBootCorpusSeeded((tid) => fetchCorpusPackPaged(tid));
  await prefetchReaderPlace();
  await warmInstalledCorpus();
}

let task: Promise<void> | null = null;

/**
 * Start corpus seeding off the first paint. Safe to call from the app shell
 * and the reader; both share one in-flight job.
 */
export function scheduleBiblePreload(): Promise<void> {
  if (task) return task;
  if (typeof window === "undefined") {
    task = Promise.resolve();
    return task;
  }
  task = new Promise((resolve) => {
    const start = () => {
      void runBiblePreload().finally(resolve);
    };
    const idle = window.requestIdleCallback;
    if (typeof idle === "function") idle(start, { timeout: 1500 });
    else window.setTimeout(start, 300);
  });
  return task;
}
