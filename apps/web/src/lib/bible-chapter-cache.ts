import { adjacentChapter } from "@logoshome/bible";
import { api } from "./api";
import { cacheNetworkChapter, readLocalChapter } from "./bible-local-db";

type ChapterApi = {
  verses?: { verse: number; text: string }[];
  source?: string;
  revision?: string;
};

/**
 * After a successful chapter paint, warm prev/next into IndexedDB so the next
 * swipe/tap is local-first without waiting on the Worker.
 */
export async function prefetchAdjacentChapters(
  translationId: string,
  bookId: string,
  chapter: number,
): Promise<void> {
  const neighbors = [
    adjacentChapter(bookId, chapter, -1),
    adjacentChapter(bookId, chapter, 1),
  ].filter((c): c is NonNullable<typeof c> => Boolean(c));

  await Promise.all(
    neighbors.map(async (cursor) => {
      const hit = await readLocalChapter(translationId, cursor.bookId, cursor.chapter);
      if (hit) return;
      try {
        const data = await api<ChapterApi>(
          `/v1/bible/chapter?translation=${encodeURIComponent(translationId)}&ref=${encodeURIComponent(`${cursor.bookId}.${cursor.chapter}`)}`,
        );
        if (data.verses?.length) {
          await cacheNetworkChapter(
            translationId,
            cursor.bookId,
            cursor.chapter,
            data.verses,
            data.source,
            data.revision,
          );
        }
      } catch {
        /* ignore prefetch failures */
      }
    }),
  );
}

export function scheduleAdjacentPrefetch(
  translationId: string,
  bookId: string,
  chapter: number,
): void {
  if (typeof window === "undefined") return;
  const run = () => {
    void prefetchAdjacentChapters(translationId, bookId, chapter);
  };
  const idle = window.requestIdleCallback;
  if (typeof idle === "function") idle(run, { timeout: 2500 });
  else window.setTimeout(run, 400);
}
