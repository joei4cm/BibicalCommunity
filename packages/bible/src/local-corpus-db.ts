/**
 * Local corpus database — verses live in a store after download/install,
 * not as compile-time TypeScript chapter packs in the app hot path.
 *
 * Server: R2 holds chapter JSON. Client: IndexedDB (`lh-bible`) or an
 * in-memory store (tests / Node). Boot ships only a few default tids;
 * everything else is downloaded on demand.
 */

import { r2ChapterObjectKey, type R2ChapterJson } from "./r2-format.js";
import { getTranslation, listTranslations, type TranslationMeta } from "./translations.js";

export type LocalChapterRecord = R2ChapterJson & {
  translationId: string;
  /** ISO time when this chapter was installed into the local DB. */
  installedAt: string;
};

export type InstalledTranslationSummary = {
  translationId: string;
  chapterCount: number;
  chapterRefs: string[];
  installedAt: string;
};

export type DownloadableCorpusPack = {
  translationId: string;
  version: number;
  name: TranslationMeta["name"];
  language: TranslationMeta["language"];
  license: TranslationMeta["license"];
  /** Boot default = pre-seeded at first launch; downloadable = user action. */
  installMode: "boot" | "download" | "external";
  /** Sample chapter refs included in the downloadable pack payload. */
  chapterRefs: string[];
  r2Prefix: string;
};

/** Persistence backend — Map in tests, IndexedDB on web/mobile. */
export interface LocalCorpusStore {
  getChapter(
    translationId: string,
    book: string,
    chapter: number,
  ): Promise<LocalChapterRecord | null>;
  putChapter(record: LocalChapterRecord): Promise<void>;
  deleteTranslation(translationId: string): Promise<void>;
  listChapterKeys(translationId?: string): Promise<
    Array<{ translationId: string; book: string; chapter: number; installedAt: string }>
  >;
  clear(): Promise<void>;
}

function chapterKey(translationId: string, book: string, chapter: number): string {
  return `${translationId}/${book}.${chapter}`;
}

/** In-memory store for unit tests and Node smoke. */
export class MemoryLocalCorpusStore implements LocalCorpusStore {
  private readonly map = new Map<string, LocalChapterRecord>();

  async getChapter(
    translationId: string,
    book: string,
    chapter: number,
  ): Promise<LocalChapterRecord | null> {
    return this.map.get(chapterKey(translationId, book, chapter)) ?? null;
  }

  async putChapter(record: LocalChapterRecord): Promise<void> {
    this.map.set(chapterKey(record.translationId, record.book, record.chapter), record);
  }

  async deleteTranslation(translationId: string): Promise<void> {
    for (const key of [...this.map.keys()]) {
      if (key.startsWith(`${translationId}/`)) this.map.delete(key);
    }
  }

  async listChapterKeys(translationId?: string) {
    const out: Array<{
      translationId: string;
      book: string;
      chapter: number;
      installedAt: string;
    }> = [];
    for (const rec of this.map.values()) {
      if (translationId && rec.translationId !== translationId) continue;
      out.push({
        translationId: rec.translationId,
        book: rec.book,
        chapter: rec.chapter,
        installedAt: rec.installedAt,
      });
    }
    return out.sort((a, b) =>
      `${a.translationId}.${a.book}.${a.chapter}`.localeCompare(
        `${b.translationId}.${b.book}.${b.chapter}`,
      ),
    );
  }

  async clear(): Promise<void> {
    this.map.clear();
  }
}

export class LocalCorpusDb {
  constructor(private readonly store: LocalCorpusStore) {}

  async getChapter(
    translationId: string,
    book: string,
    chapter: number,
  ): Promise<LocalChapterRecord | null> {
    return this.store.getChapter(translationId, book, chapter);
  }

  async installChapter(
    translationId: string,
    chapter: R2ChapterJson,
    installedAt = new Date().toISOString(),
  ): Promise<LocalChapterRecord> {
    const record: LocalChapterRecord = {
      translationId,
      book: chapter.book,
      chapter: chapter.chapter,
      verses: chapter.verses.map((v) => ({ verse: v.verse, text: v.text })),
      installedAt,
    };
    await this.store.putChapter(record);
    return record;
  }

  /** Install a multi-chapter download pack into the local DB. */
  async installPack(
    translationId: string,
    chapters: R2ChapterJson[],
    installedAt = new Date().toISOString(),
  ): Promise<{ translationId: string; installed: number }> {
    let installed = 0;
    for (const ch of chapters) {
      await this.installChapter(translationId, ch, installedAt);
      installed += 1;
    }
    return { translationId, installed };
  }

  async removeTranslation(translationId: string): Promise<void> {
    await this.store.deleteTranslation(translationId);
  }

  async listInstalled(): Promise<InstalledTranslationSummary[]> {
    const keys = await this.store.listChapterKeys();
    const byTid = new Map<string, InstalledTranslationSummary>();
    for (const k of keys) {
      const ref = `${k.book}.${k.chapter}`;
      const cur = byTid.get(k.translationId);
      if (!cur) {
        byTid.set(k.translationId, {
          translationId: k.translationId,
          chapterCount: 1,
          chapterRefs: [ref],
          installedAt: k.installedAt,
        });
      } else {
        cur.chapterCount += 1;
        cur.chapterRefs.push(ref);
        if (k.installedAt < cur.installedAt) cur.installedAt = k.installedAt;
      }
    }
    for (const s of byTid.values()) s.chapterRefs.sort();
    return [...byTid.values()].sort((a, b) => a.translationId.localeCompare(b.translationId));
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }
}

/**
 * Boot defaults — the few translations present after first launch.
 * Everything else is downloadable (R2 pack) or external deep-link.
 * ESV/NIV stay external (cannot lawfully ship full text in-app).
 */
export const BOOT_DEFAULT_TRANSLATION_IDS = ["cuvs", "web", "shinKyoudou"] as const;

/**
 * Teaching-set chapter refs seeded for boot defaults (and PD download peers).
 * Content lives in `fixtures/corpus/{tid}/` — never TypeScript packs.
 */
export const BOOT_TEACHING_CHAPTER_REFS = [
  "John.1",
  "John.3",
  "John.14",
  "Ps.23",
  "Rom.8",
  "Matt.5",
  "Gen.1",
] as const;

/** Slim sample refs for downloadable peers that only ship a few fixtures. */
export const DOWNLOAD_SAMPLE_CHAPTER_REFS = ["John.1", "John.3", "Ps.23"] as const;

/** Extra licensed/PD ids users may download into the local DB (not bundled). */
export const DOWNLOADABLE_TRANSLATION_IDS = [
  "cuvt",
  "rcuv",
  "ccb",
  "lzz",
  "kougo",
  "shinkaiyaku",
  "kjv",
  "asv",
  "kougoyaku-pd",
] as const;

/** Downloadable tids that advertise the full teaching-set refs (fixtures present). */
const TEACHING_SET_DOWNLOAD_IDS = new Set([
  "kjv",
  "asv",
  "cuvt",
  "kougo",
  "rcuv",
  "ccb",
  "lzz",
  "shinkaiyaku",
]);

export function listDownloadableCorpusCatalog(): DownloadableCorpusPack[] {
  const packs: DownloadableCorpusPack[] = [];
  const boot = new Set<string>(BOOT_DEFAULT_TRANSLATION_IDS);
  const downloadable = new Set<string>(DOWNLOADABLE_TRANSLATION_IDS);

  for (const t of listTranslations()) {
    let installMode: DownloadableCorpusPack["installMode"];
    if (t.provider === "external") installMode = "external";
    else if (boot.has(t.id)) installMode = "boot";
    else if (downloadable.has(t.id) || t.provider === "r2" || t.provider === "local") {
      installMode = "download";
    } else {
      installMode = "external";
    }

    let chapterRefs: string[] = [];
    if (installMode === "boot") {
      chapterRefs = [...BOOT_TEACHING_CHAPTER_REFS];
    } else if (installMode === "download") {
      chapterRefs = TEACHING_SET_DOWNLOAD_IDS.has(t.id)
        ? [...BOOT_TEACHING_CHAPTER_REFS]
        : [...DOWNLOAD_SAMPLE_CHAPTER_REFS];
    }

    packs.push({
      translationId: t.id,
      version: 1,
      name: t.name,
      language: t.language,
      license: t.license,
      installMode,
      chapterRefs,
      r2Prefix: `bible/${t.id}/`,
    });
  }

  return packs.sort((a, b) => {
    const order = { boot: 0, download: 1, external: 2 };
    const d = order[a.installMode] - order[b.installMode];
    return d !== 0 ? d : a.translationId.localeCompare(b.translationId);
  });
}

export function getBootDefaultMeta(): TranslationMeta[] {
  return BOOT_DEFAULT_TRANSLATION_IDS.map((id) => getTranslation(id)).filter(
    (t): t is TranslationMeta => Boolean(t),
  );
}

export type DownloadPackPayload = {
  translationId: string;
  version: number;
  chapters: R2ChapterJson[];
};

export function parseDownloadPackPayload(raw: string): DownloadPackPayload {
  const data = JSON.parse(raw) as Partial<DownloadPackPayload>;
  if (typeof data.translationId !== "string" || !Array.isArray(data.chapters)) {
    throw new Error("invalid_download_pack");
  }
  return {
    translationId: data.translationId,
    version: typeof data.version === "number" ? data.version : 1,
    chapters: data.chapters.map((ch) => ({
      book: String(ch.book),
      chapter: Number(ch.chapter),
      verses: (ch.verses ?? []).map((v) => ({
        verse: Number(v.verse),
        text: String(v.text),
      })),
    })),
  };
}

export function buildDownloadPackPayloadJson(pack: DownloadPackPayload): string {
  return JSON.stringify(pack);
}

/** Minimal demo chapters used to seed boot/download packs without TS densify. */
export function buildDemoDownloadPack(translationId: string): DownloadPackPayload {
  const meta = getTranslation(translationId);
  const abbr = meta?.abbreviation ?? translationId;
  const samples: R2ChapterJson[] = [
    {
      book: "John",
      chapter: 1,
      verses: [
        { verse: 1, text: `[${abbr}] In the beginning was the Word (local-db demo).` },
        { verse: 14, text: `[${abbr}] The Word became flesh (local-db demo).` },
      ],
    },
    {
      book: "John",
      chapter: 3,
      verses: [
        { verse: 16, text: `[${abbr}] For God so loved the world (local-db demo).` },
      ],
    },
    {
      book: "Ps",
      chapter: 23,
      verses: [
        { verse: 1, text: `[${abbr}] The Lord is my shepherd (local-db demo).` },
      ],
    },
  ];

  // Language-flavored demos for boot defaults (still data, not full corpora).
  if (translationId === "cuvs") {
    samples[0] = {
      book: "John",
      chapter: 1,
      verses: [
        { verse: 1, text: "（样例·本地库）太初有道，道与神同在，道就是神。" },
        { verse: 14, text: "（样例·本地库）道成了肉身，住在我们中间。" },
      ],
    };
    samples[1] = {
      book: "John",
      chapter: 3,
      verses: [{ verse: 16, text: "（样例·本地库）神爱世人，甚至将他的独生子赐给他们。" }],
    };
    samples[2] = {
      book: "Ps",
      chapter: 23,
      verses: [{ verse: 1, text: "（样例·本地库）耶和华是我的牧者，我必不至缺乏。" }],
    };
  } else if (translationId === "shinKyoudou") {
    samples[0] = {
      book: "John",
      chapter: 1,
      verses: [
        { verse: 1, text: "（見本・ローカルDB）初めに言があった。言は神と共にあった。" },
        { verse: 14, text: "（見本・ローカルDB）言は肉となって、わたしたちの間に宿られた。" },
      ],
    };
    samples[1] = {
      book: "John",
      chapter: 3,
      verses: [
        { verse: 16, text: "（見本・ローカルDB）神は、その独り子をお与えになったほどに、世を愛された。" },
      ],
    };
    samples[2] = {
      book: "Ps",
      chapter: 23,
      verses: [{ verse: 1, text: "（見本・ローカルDB）主は羊飼い。わたしには何も欠けることがない。" }],
    };
  } else if (translationId === "web") {
    samples[0] = {
      book: "John",
      chapter: 1,
      verses: [
        {
          verse: 1,
          text: "In the beginning was the Word, and the Word was with God, and the Word was God. (local-db)",
        },
        {
          verse: 14,
          text: "The Word became flesh and lived among us. (local-db)",
        },
      ],
    };
  }

  return { translationId, version: 1, chapters: samples };
}

export type LocalCorpusPipelineProbe = {
  ok: boolean;
  bootDefaults: string[];
  downloadableCount: number;
  externalCount: number;
  sampleR2Key: string;
  installedAfterBoot: number;
};

/** Prove boot→install→read path without embedding full TS corpora. */
export async function probeLocalCorpusPipeline(
  store: LocalCorpusStore = new MemoryLocalCorpusStore(),
): Promise<LocalCorpusPipelineProbe> {
  const db = new LocalCorpusDb(store);
  await db.clear();

  const catalog = listDownloadableCorpusCatalog();
  const boot = catalog.filter((p) => p.installMode === "boot");
  const downloadable = catalog.filter((p) => p.installMode === "download");
  const external = catalog.filter((p) => p.installMode === "external");

  for (const id of BOOT_DEFAULT_TRANSLATION_IDS) {
    const pack = buildDemoDownloadPack(id);
    await db.installPack(id, pack.chapters);
  }

  const installed = await db.listInstalled();
  const john1 = await db.getChapter("cuvs", "John", 1);
  const ok =
    boot.length === BOOT_DEFAULT_TRANSLATION_IDS.length &&
    boot.every((b) => (BOOT_DEFAULT_TRANSLATION_IDS as readonly string[]).includes(b.translationId)) &&
    downloadable.length >= 5 &&
    external.some((e) => e.translationId === "esv") &&
    installed.length === BOOT_DEFAULT_TRANSLATION_IDS.length &&
    (john1?.verses.length ?? 0) >= 2 &&
    Boolean(john1?.verses[0]?.text.includes("太初有道") || john1?.verses[0]?.text.includes("本地库"));

  return {
    ok,
    bootDefaults: [...BOOT_DEFAULT_TRANSLATION_IDS],
    downloadableCount: downloadable.length,
    externalCount: external.length,
    sampleR2Key: r2ChapterObjectKey("cuvs", "John", 1),
    installedAfterBoot: installed.reduce((n, s) => n + s.chapterCount, 0),
  };
}
