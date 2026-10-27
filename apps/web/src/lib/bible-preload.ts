import { bookIdFromSlug } from "@logoshome/bible";
import { api, getToken } from "./api";
import {
  cacheNetworkChapter,
  ensureBootCorpusSeeded,
  installDownloadedPack,
  readLocalChapter,
} from "./bible-local-db";
import { scheduleCorpusRevisionCheck } from "./bible-corpus-revision";
import { loadReaderPlace } from "./reader-place";

type CorpusPage = {
  chapters: { book: string; chapter: number; verses: { verse: number; text: string }[] }[];
  source?: string;
  done?: boolean;
  nextAfter?: string | null;
  totalChapterKeys?: number;
};

const WARM_KEY = "lh.bible.cuvsWarm.v4";
/** Only fill gaps when R2 looks empty — never storm a healthy corpus. */
const WARM_MIN_KEYS_HINT = 50;
/** Peer tids are opt-in / settings — boot only needs 和合本. */
const BOOT_PRELOAD_TID = "cuvs";

/** Paged whole-Bible download — larger pages now that the Worker fans out R2 gets. */
export async function fetchCorpusPackPaged(tid: string): Promise<CorpusPage | null> {
  let after: string | null = null;
  const chapters: CorpusPage["chapters"] = [];
  let source: string | undefined;
  for (let page = 0; page < 32; page += 1) {
    const qs = new URLSearchParams({ scope: "full", limit: "200" });
    if (after) qs.set("after", after);
    const pack = await api<CorpusPage>(
      `/v1/bible/corpus-download/${encodeURIComponent(tid)}?${qs.toString()}`,
    );
    if (pack.source) source = pack.source;
    if (pack.chapters?.length) chapters.push(...pack.chapters);
    if (pack.done !== false || !pack.nextAfter) {
      return chapters.length ? { chapters, source, totalChapterKeys: pack.totalChapterKeys } : null;
    }
    after = pack.nextAfter;
  }
  return chapters.length ? { chapters, source } : null;
}

async function warmPdBooksInParallel(translationId: string, concurrency = 2): Promise<void> {
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

/**
 * Probe whether R2 already has a usable corpus. If yes, skip getbible warm.
 * Only warm + re-download boot tid when the first page looks empty/demo.
 */
async function maybeWarmBootCorpus(): Promise<void> {
  if (!getToken()) return;
  if (typeof localStorage !== "undefined" && localStorage.getItem(WARM_KEY) === "1") return;

  let needsWarm = false;
  try {
    const probe = await api<CorpusPage>(
      `/v1/bible/corpus-download/${BOOT_PRELOAD_TID}?scope=full&limit=20`,
    );
    const n = probe.chapters?.length ?? 0;
    needsWarm = probe.source === "demo" || n < WARM_MIN_KEYS_HINT;
  } catch {
    needsWarm = true;
  }

  if (needsWarm) {
    await warmPdBooksInParallel(BOOT_PRELOAD_TID, 2);
    try {
      const pack = await fetchCorpusPackPaged(BOOT_PRELOAD_TID);
      if (pack?.chapters?.length && pack.source !== "demo") {
        await installDownloadedPack(BOOT_PRELOAD_TID, pack.chapters);
      }
    } catch {
      /* per-chapter API still works */
    }
  }

  if (typeof localStorage !== "undefined") localStorage.setItem(WARM_KEY, "1");
}

async function runBiblePreload(): Promise<{ refreshed: boolean }> {
  // Critical path: boot seed + current place. Do not compete with reading.
  const seed = await ensureBootCorpusSeeded((tid) => fetchCorpusPackPaged(tid));
  await prefetchReaderPlace();
  return { refreshed: Boolean(seed.seeded) };
}

async function refreshPackForRevision(tid: string): Promise<void> {
  const pack = await fetchCorpusPackPaged(tid);
  if (pack?.chapters?.length && pack.source !== "demo") {
    await installDownloadedPack(tid, pack.chapters);
  }
}

/** Heavy warm only after the reader has had time to settle. */
function scheduleDeferredWarm(): void {
  if (typeof window === "undefined") return;
  const start = () => {
    void maybeWarmBootCorpus();
  };
  const idle = window.requestIdleCallback;
  if (typeof idle === "function") {
    window.setTimeout(() => idle(start, { timeout: 30_000 }), 45_000);
  } else {
    window.setTimeout(start, 60_000);
  }
  // Weekly: only re-download 和合本 when server revision actually changes.
  void scheduleCorpusRevisionCheck(BOOT_PRELOAD_TID, refreshPackForRevision);
}

/**
 * Start corpus seeding off the first paint. Safe to call from the app shell
 * and the reader; both share one in-flight job.
 */
let task: Promise<{ refreshed: boolean }> | null = null;

export function scheduleBiblePreload(): Promise<{ refreshed: boolean }> {
  if (task) return task;
  if (typeof window === "undefined") {
    task = Promise.resolve({ refreshed: false });
    return task;
  }
  task = new Promise((resolve) => {
    const start = () => {
      void runBiblePreload()
        .catch(() => ({ refreshed: false }))
        .then((result) => {
          scheduleDeferredWarm();
          resolve(result ?? { refreshed: false });
        });
    };
    const idle = window.requestIdleCallback;
    if (typeof idle === "function") idle(start, { timeout: 1500 });
    else window.setTimeout(start, 300);
  });
  return task;
}
