const STORAGE_KEY = "lh.reader.place";
const DEFAULT_PATH = "/app/bible/cuvs/john/1";

export type ReaderPlace = {
  tid: string;
  bookSlug: string;
  chapter: number;
};

export function parseReaderPlace(raw: string | null | undefined): ReaderPlace | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ReaderPlace>;
    if (
      typeof parsed.tid !== "string" ||
      !/^[a-z0-9-]{1,32}$/.test(parsed.tid) ||
      typeof parsed.bookSlug !== "string" ||
      !/^[a-z0-9-]{1,40}$/.test(parsed.bookSlug) ||
      typeof parsed.chapter !== "number" ||
      !Number.isInteger(parsed.chapter) ||
      parsed.chapter < 1 ||
      parsed.chapter > 200
    ) {
      return null;
    }
    return { tid: parsed.tid, bookSlug: parsed.bookSlug, chapter: parsed.chapter };
  } catch {
    return null;
  }
}

export function readerPlacePath(place: ReaderPlace | null | undefined): string {
  if (!place) return DEFAULT_PATH;
  return `/app/bible/${place.tid}/${place.bookSlug}/${place.chapter}`;
}

export function loadReaderPlace(): ReaderPlace | null {
  if (typeof localStorage === "undefined") return null;
  return parseReaderPlace(localStorage.getItem(STORAGE_KEY));
}

export function saveReaderPlace(place: ReaderPlace): void {
  const parsed = parseReaderPlace(JSON.stringify(place));
  if (!parsed || typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
}

/** Last opened passage, or John 1 when nothing valid is stored. */
export function readerHomePath(): string {
  return readerPlacePath(loadReaderPlace());
}
