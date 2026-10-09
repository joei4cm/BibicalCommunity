import { BOOK_LIST } from "./books.js";

/** Minimal fetch shape so this package stays free of DOM lib typings. */
export type StudyFetchInit = Record<string, unknown>;
export type StudyFetch = (
  input: string,
  init?: StudyFetchInit,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

function runtimeFetch(input: string, init?: StudyFetchInit) {
  const f = (globalThis as { fetch?: StudyFetch }).fetch;
  if (!f) throw new Error("fetch is not available in this runtime");
  return f(input, init);
}

/** getBible Commentaries CDN — public-domain chapter/verse entries. */
export const GETBIBLE_COMMENTARIES_BASE = "https://commentaries.getbible.net/v1";

export type StudyCommentaryId =
  | "mhcc-zh"
  | "mhcc"
  | "mhc"
  | "clarke"
  | "jfb"
  | "wesley"
  | "tsk";

export interface StudyCommentaryMeta {
  id: StudyCommentaryId;
  name: string;
  /** Localized display names when available. */
  nameI18n?: Partial<Record<"zh" | "en" | "ja", string>>;
  license: string;
  language: "en" | "zh";
  /** When true, treat entries primarily as cross-reference chains (串珠). */
  crossRefStyle?: boolean;
  /** getBible module id when different from StudyCommentaryId (e.g. mhcc-zh → mhcc). */
  remoteId?: string;
}

/** Local seed / cache root for Chinese Matthew Henry Concise chapters. */
export const MHCC_ZH_LOCAL_BASE = "/study/mhcc-zh";

/** Curated PD commentaries with verse-level positioning via getBible. */
export const STUDY_COMMENTARIES: StudyCommentaryMeta[] = [
  {
    id: "mhcc-zh",
    name: "马太·亨利简明（中文）",
    nameI18n: {
      zh: "马太·亨利简明（中文）",
      en: "Matthew Henry Concise (Chinese)",
      ja: "マシュー・ヘンリー簡約（中国語）",
    },
    license: "Public Domain EN · Chinese CC0 pack / on-demand MT",
    language: "zh",
    remoteId: "mhcc",
  },
  {
    id: "mhcc",
    name: "Matthew Henry Concise",
    nameI18n: { zh: "马太·亨利简明（英文）", en: "Matthew Henry Concise", ja: "マシュー・ヘンリー簡約" },
    license: "Public Domain",
    language: "en",
  },
  {
    id: "mhc",
    name: "Matthew Henry Complete",
    nameI18n: { zh: "马太·亨利全本（英文）", en: "Matthew Henry Complete", ja: "マシュー・ヘンリー全本" },
    license: "Public Domain",
    language: "en",
  },
  {
    id: "clarke",
    name: "Adam Clarke",
    license: "Public Domain",
    language: "en",
  },
  {
    id: "jfb",
    name: "Jamieson-Fausset-Brown",
    license: "Public Domain",
    language: "en",
  },
  {
    id: "wesley",
    name: "John Wesley Notes",
    license: "Public Domain",
    language: "en",
  },
];

export function defaultStudyCommentaryId(lang: "zh" | "en" | "ja" | string): StudyCommentaryId {
  return lang === "zh" || String(lang).startsWith("zh") ? "mhcc-zh" : "mhcc";
}

export function commentaryDisplayName(
  meta: StudyCommentaryMeta,
  lang: "zh" | "en" | "ja" | string,
): string {
  const key = lang.startsWith("zh") ? "zh" : lang.startsWith("ja") ? "ja" : "en";
  return meta.nameI18n?.[key] ?? meta.name;
}

/** TSK is the primary open 串珠 source (also hosted as a getBible commentary). */
export const STUDY_CROSSREF_SOURCE: StudyCommentaryMeta = {
  id: "tsk",
  name: "Treasury of Scripture Knowledge",
  license: "Public Domain",
  language: "en",
  crossRefStyle: true,
};

export interface CommentaryEntry {
  book: number;
  chapter: number;
  verse: number;
  osis?: string;
  text: string;
  references?: CommentaryReference[];
}

export interface CommentaryReference {
  text?: string;
  ref: string;
  osis?: string;
  book?: number;
  chapter?: number;
  verse?: number;
  verses?: number[];
}

export interface CommentaryChapter {
  commentary: string;
  language?: string;
  book: number;
  name?: string;
  chapter: number;
  entries: CommentaryEntry[];
}

export interface StrongsEntry {
  lemma: string;
  translit: string;
  gloss: string;
  kjv: string;
  lang: "greek" | "hebrew" | string;
}

export type StrongsDictionary = Record<string, StrongsEntry>;

/** Protestant canon order → getBible book number (1–66). */
export function bookNumberFromId(bookId: string): number | null {
  const idx = BOOK_LIST.findIndex(
    (b) => b.id === bookId || b.id.toLowerCase() === bookId.toLowerCase(),
  );
  return idx >= 0 ? idx + 1 : null;
}

export function bookIdFromNumber(n: number): string | undefined {
  return BOOK_LIST[n - 1]?.id;
}

function commentaryChapterUrl(commentaryId: string, bookNum: number, chapter: number): string {
  return `${GETBIBLE_COMMENTARIES_BASE}/${encodeURIComponent(commentaryId)}/${bookNum}/${chapter}.json`;
}

function mhccZhLocalUrl(bookNum: number, chapter: number): string {
  return `${MHCC_ZH_LOCAL_BASE}/${bookNum}/${chapter}.json`;
}

const chapterCache = new Map<string, Promise<CommentaryChapter>>();
const translateCache = new Map<string, string>();

/** Split long commentary prose into MyMemory-sized chunks (~420 chars). */
export function chunkForTranslation(text: string, maxLen = 420): string[] {
  const parts = text.split(/(?<=[.!?。！？])\s+|\n+/);
  const out: string[] = [];
  let buf = "";
  for (const part of parts) {
    const next = buf ? `${buf} ${part}` : part;
    if (next.length <= maxLen) {
      buf = next;
      continue;
    }
    if (buf) out.push(buf);
    if (part.length <= maxLen) {
      buf = part;
    } else {
      for (let i = 0; i < part.length; i += maxLen) out.push(part.slice(i, i + maxLen));
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out.filter(Boolean);
}

async function translateEnToZh(text: string, init?: StudyFetchInit): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const hit = translateCache.get(trimmed);
  if (hit) return hit;

  const chunks = chunkForTranslation(trimmed);
  const translated: string[] = [];
  for (const chunk of chunks) {
    const cached = translateCache.get(chunk);
    if (cached) {
      translated.push(cached);
      continue;
    }
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|zh-CN`;
    try {
      const res = await runtimeFetch(url, init);
      if (!res.ok) {
        translated.push(chunk);
        continue;
      }
      const data = (await res.json()) as {
        responseData?: { translatedText?: string };
      };
      let zh = data.responseData?.translatedText?.trim() || chunk;
      if (
        zh.startsWith("MYMEMORY WARNING") ||
        zh.includes("QUERY LENGTH LIMIT") ||
        zh.includes("PLEASE SELECT TWO DISTINCT LANGUAGES")
      ) {
        zh = chunk;
      }
      translateCache.set(chunk, zh);
      translated.push(zh);
    } catch {
      translated.push(chunk);
    }
  }
  const joined = translated.join("\n");
  translateCache.set(trimmed, joined);
  return joined;
}

async function loadLocalMhccZh(
  bookNum: number,
  chapter: number,
  init?: StudyFetchInit,
): Promise<CommentaryChapter | null> {
  try {
    const res = await runtimeFetch(mhccZhLocalUrl(bookNum, chapter), init);
    if (!res.ok) return null;
    const data = (await res.json()) as CommentaryChapter;
    if (!data || !Array.isArray(data.entries)) return null;
    return { ...data, commentary: "mhcc-zh", language: "zh" };
  } catch {
    return null;
  }
}

async function fetchMhccZhChapter(
  bookId: string,
  bookNum: number,
  chapter: number,
  init?: StudyFetchInit,
): Promise<CommentaryChapter> {
  const local = await loadLocalMhccZh(bookNum, chapter, init);
  if (local) return local;

  const en = await fetchRemoteCommentaryChapter("mhcc", bookId, bookNum, chapter, init);
  const entries: CommentaryEntry[] = [];
  for (const entry of en.entries) {
    entries.push({
      ...entry,
      text: await translateEnToZh(entry.text, init),
    });
  }
  return {
    commentary: "mhcc-zh",
    language: "zh",
    book: bookNum,
    name: en.name,
    chapter,
    entries,
  };
}

async function fetchRemoteCommentaryChapter(
  remoteId: string,
  bookId: string,
  bookNum: number,
  chapter: number,
  init?: StudyFetchInit,
): Promise<CommentaryChapter> {
  const res = await runtimeFetch(commentaryChapterUrl(remoteId, bookNum, chapter), init);
  if (!res.ok) {
    throw new Error(`Commentary ${remoteId} ${bookId} ${chapter}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as CommentaryChapter;
  if (!data || !Array.isArray(data.entries)) {
    throw new Error(`Invalid commentary payload for ${remoteId}`);
  }
  return data;
}

export async function fetchCommentaryChapter(
  commentaryId: string,
  bookId: string,
  chapter: number,
  init?: StudyFetchInit,
): Promise<CommentaryChapter> {
  const bookNum = bookNumberFromId(bookId);
  if (!bookNum) {
    throw new Error(`Unknown book: ${bookId}`);
  }
  const key = `${commentaryId}:${bookNum}:${chapter}`;
  const hit = chapterCache.get(key);
  if (hit) return hit;

  const promise = (async () => {
    if (commentaryId === "mhcc-zh") {
      return fetchMhccZhChapter(bookId, bookNum, chapter, init);
    }
    const meta = STUDY_COMMENTARIES.find((c) => c.id === commentaryId);
    const remoteId = meta?.remoteId ?? commentaryId;
    return fetchRemoteCommentaryChapter(remoteId, bookId, bookNum, chapter, init);
  })();

  chapterCache.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    chapterCache.delete(key);
    throw err;
  }
}

/** Entries for a verse: exact match, else nearest prior verse note, else chapter-level (verse 0). */
export function entriesForVerse(chapter: CommentaryChapter, verse: number): CommentaryEntry[] {
  const exact = chapter.entries.filter((e) => e.verse === verse);
  if (exact.length) return exact;
  const prior = chapter.entries
    .filter((e) => e.verse > 0 && e.verse <= verse)
    .sort((a, b) => b.verse - a.verse);
  if (prior[0]) return [prior[0]];
  return chapter.entries.filter((e) => e.verse === 0);
}

export interface CrossRefHit {
  label: string;
  osis?: string;
  bookId?: string;
  chapter?: number;
  verse?: number;
  theme?: string;
}

/** Flatten TSK-style commentary into clickable cross-reference hits for a verse. */
export function crossRefsForVerse(chapter: CommentaryChapter, verse: number): CrossRefHit[] {
  const entries = entriesForVerse(chapter, verse);
  const out: CrossRefHit[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const themeLine = entry.text.split("\n")[0]?.replace(/\.$/, "").trim();
    const theme =
      themeLine && themeLine.length < 80 && !/^\d+\s/.test(themeLine) ? themeLine : undefined;
    if (entry.references?.length) {
      let themeUsed = false;
      for (const r of entry.references) {
        const bookId = r.book ? bookIdFromNumber(r.book) : undefined;
        // Skip self-reference to the current verse.
        if (r.book === chapter.book && r.chapter === chapter.chapter && r.verse === verse) {
          continue;
        }
        const key = r.osis ?? r.ref;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({
          label: r.ref || r.osis || key,
          osis: r.osis,
          bookId,
          chapter: r.chapter,
          verse: r.verse,
          theme: !themeUsed ? theme : undefined,
        });
        themeUsed = true;
      }
    }
  }
  return out;
}

export async function fetchCrossRefs(
  bookId: string,
  chapter: number,
  verse: number,
  init?: StudyFetchInit,
): Promise<CrossRefHit[]> {
  const data = await fetchCommentaryChapter(STUDY_CROSSREF_SOURCE.id, bookId, chapter, init);
  return crossRefsForVerse(data, verse);
}

/** Normalize user input like "g26", "26", "H3068" → "G26" / "H3068". */
export function normalizeStrongsId(raw: string, fallbackLang?: "greek" | "hebrew"): string | null {
  const t = raw.trim().toUpperCase().replace(/^STRONG'?S?\s*/i, "");
  const m = t.match(/^([GH])?\s*0*(\d{1,5})$/);
  if (!m) return null;
  const num = Number(m[2]);
  if (!Number.isFinite(num) || num < 1) return null;
  let prefix = m[1];
  if (!prefix) {
    if (fallbackLang === "hebrew") prefix = "H";
    else if (fallbackLang === "greek") prefix = "G";
    else prefix = num <= 8674 && fallbackLang !== "greek" ? "G" : "G";
  }
  return `${prefix}${num}`;
}

let strongsCache: StrongsDictionary | null = null;
let strongsLoading: Promise<StrongsDictionary> | null = null;
let verseStrongsCache: Record<string, string[]> | null = null;
let verseStrongsLoading: Promise<Record<string, string[]>> | null = null;

/** Default public paths served by the web app (Open Scriptures Strong's + Macula NT). */
export const DEFAULT_STRONGS_URL = "/study/strongs.json";
export const DEFAULT_NT_VERSE_STRONGS_URL = "/study/nt-verse-strongs.json";

/** Offline seed — common lemmas when the full dictionary has not loaded yet. */
export const STRONGS_SEED: StrongsDictionary = {
  G25: {
    lemma: "ἀγαπάω",
    translit: "agapáō",
    gloss: "to love (in a social or moral sense)",
    kjv: "beloved, love",
    lang: "greek",
  },
  G26: {
    lemma: "ἀγάπη",
    translit: "agápē",
    gloss: "love, i.e. affection or benevolence; specially (plural) a love-feast",
    kjv: "(feast of) charity(-ably), dear, love",
    lang: "greek",
  },
  G225: {
    lemma: "ἀλήθεια",
    translit: "alḗtheia",
    gloss: "truth",
    kjv: "true, truly, truth, verity",
    lang: "greek",
  },
  G2316: {
    lemma: "θεός",
    translit: "theós",
    gloss: "a deity, especially the supreme Divinity",
    kjv: "God, god(-ly, -ward)",
    lang: "greek",
  },
  G2424: {
    lemma: "Ἰησοῦς",
    translit: "Iēsoûs",
    gloss: "Jesus (i.e. Jehoshua), the name of our Lord",
    kjv: "Jesus",
    lang: "greek",
  },
  G2962: {
    lemma: "κύριος",
    translit: "kýrios",
    gloss: "supreme in authority, i.e. controller; by implication, Master",
    kjv: "God, Lord, master, Sir",
    lang: "greek",
  },
  G3056: {
    lemma: "λόγος",
    translit: "lógos",
    gloss: "something said (including the thought); by implication, a topic, also reasoning",
    kjv: "account, cause, communication, word",
    lang: "greek",
  },
  G3598: {
    lemma: "ὁδός",
    translit: "hodós",
    gloss: "a road; by implication, a progress; figuratively, a mode or means",
    kjv: "journey, (high-)way",
    lang: "greek",
  },
  G3962: {
    lemma: "πατήρ",
    translit: "patḗr",
    gloss: "a father (literally or figuratively, near or more remote)",
    kjv: "father, parent",
    lang: "greek",
  },
  G4102: {
    lemma: "πίστις",
    translit: "pístis",
    gloss: "persuasion, i.e. credence; moral conviction",
    kjv: "assurance, belief, faith",
    lang: "greek",
  },
  G4151: {
    lemma: "πνεῦμα",
    translit: "pneûma",
    gloss: "a current of air, i.e. breath; figuratively, a spirit",
    kjv: "ghost, life, spirit(-ual, -ually), mind",
    lang: "greek",
  },
  G2222: {
    lemma: "ζωή",
    translit: "zōḗ",
    gloss: "life (literally or figuratively)",
    kjv: "life(-time)",
    lang: "greek",
  },
  G1515: {
    lemma: "εἰρήνη",
    translit: "eirḗnē",
    gloss: "peace; by implication, prosperity",
    kjv: "one, peace, quietness, rest, + set at one again",
    lang: "greek",
  },
  G3875: {
    lemma: "παράκλητος",
    translit: "paráklētos",
    gloss: "an intercessor, consoler",
    kjv: "advocate, comforter",
    lang: "greek",
  },
  H3068: {
    lemma: "יְהֹוָה",
    translit: "Yᵉhôvâh",
    gloss: "the self-Existent or Eternal; name of God",
    kjv: "Jehovah, the Lord",
    lang: "hebrew",
  },
  H430: {
    lemma: "אֱלֹהִים",
    translit: "ʼĕlôhîym",
    gloss: "gods in the ordinary sense; specifically of the supreme God",
    kjv: "angels, exceeding, God, gods, judges",
    lang: "hebrew",
  },
  H7307: {
    lemma: "רוּחַ",
    translit: "rûwach",
    gloss: "wind; by resemblance breath, i.e. a sensible (or even violent) exhalation",
    kjv: "air, anger, blast, breath, cool, courage, mind, spirit",
    lang: "hebrew",
  },
};

export async function loadStrongsDictionary(
  url: string = DEFAULT_STRONGS_URL,
): Promise<StrongsDictionary> {
  if (strongsCache) return strongsCache;
  if (strongsLoading) return strongsLoading;
  strongsLoading = (async () => {
    try {
      const res = await runtimeFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as StrongsDictionary;
      strongsCache = { ...STRONGS_SEED, ...data };
      return strongsCache;
    } catch {
      strongsCache = { ...STRONGS_SEED };
      return strongsCache;
    } finally {
      strongsLoading = null;
    }
  })();
  return strongsLoading;
}

export function lookupStrongs(
  id: string,
  dict: StrongsDictionary = strongsCache ?? STRONGS_SEED,
): { id: string; entry: StrongsEntry } | null {
  const normalized = normalizeStrongsId(id);
  if (!normalized) return null;
  const entry = dict[normalized];
  if (!entry) return null;
  return { id: normalized, entry };
}

export function searchStrongs(
  query: string,
  dict: StrongsDictionary = strongsCache ?? STRONGS_SEED,
  limit = 24,
): Array<{ id: string; entry: StrongsEntry }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const byId = lookupStrongs(q, dict);
  if (byId) return [byId];

  const out: Array<{ id: string; entry: StrongsEntry }> = [];
  for (const [id, entry] of Object.entries(dict)) {
    const hay = `${id} ${entry.lemma} ${entry.translit} ${entry.gloss} ${entry.kjv}`.toLowerCase();
    if (hay.includes(q)) {
      out.push({ id, entry });
      if (out.length >= limit) break;
    }
  }
  return out;
}

export async function loadNtVerseStrongs(
  url: string = DEFAULT_NT_VERSE_STRONGS_URL,
): Promise<Record<string, string[]>> {
  if (verseStrongsCache) return verseStrongsCache;
  if (verseStrongsLoading) return verseStrongsLoading;
  verseStrongsLoading = (async () => {
    try {
      const res = await runtimeFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      verseStrongsCache = (await res.json()) as Record<string, string[]>;
      return verseStrongsCache;
    } catch {
      verseStrongsCache = {};
      return verseStrongsCache;
    } finally {
      verseStrongsLoading = null;
    }
  })();
  return verseStrongsLoading;
}

export function verseStrongsKey(bookId: string, chapter: number, verse: number): string {
  return `${bookId}.${chapter}.${verse}`;
}

export function strongsForVerse(
  map: Record<string, string[]>,
  bookId: string,
  chapter: number,
  verse: number,
): string[] {
  return map[verseStrongsKey(bookId, chapter, verse)] ?? [];
}

/** Clear in-memory caches (tests). */
export function resetStudyToolCaches(): void {
  chapterCache.clear();
  translateCache.clear();
  strongsCache = null;
  strongsLoading = null;
  verseStrongsCache = null;
  verseStrongsLoading = null;
}
