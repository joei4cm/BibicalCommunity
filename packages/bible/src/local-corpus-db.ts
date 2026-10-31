/**
 * Local corpus database — verses live in a store after download/install,
 * not as compile-time TypeScript chapter packs in the app hot path.
 *
 * Server: R2 holds chapter JSON. Client: IndexedDB (`lh-bible`) or an
 * in-memory store (tests / Node). Boot ships only a few default tids;
 * everything else is downloaded on demand.
 */

import { listBooks } from "./books.js";
import { r2ChapterObjectKey, type R2ChapterJson } from "./r2-format.js";
import { getTranslation, listTranslations, type TranslationMeta } from "./translations.js";

export type LocalChapterRecord = R2ChapterJson & {
  translationId: string;
  /** ISO time when this chapter was installed into the local DB. */
  installedAt: string;
  /** Server corpus/chapter revision when known — used to skip re-download. */
  revision?: string;
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
  /**
   * Expected chapter refs for the pack. Product unit is whole-Bible (~1189)
   * for boot/download — never a chapter-by-chapter install UX.
   */
  chapterRefs: string[];
  r2Prefix: string;
  /** True when a full Protestant pack can be downloaded from R2. */
  fullPackAvailable?: boolean;
  /** Expected chapter count when `fullPackAvailable` (≈1189). */
  fullPackChapterCount?: number;
  /** Install unit for clients — always whole-bible for local packs. */
  packKind?: "whole-bible";
};

/** Persistence backend — Map in tests, IndexedDB on web/mobile. */
export interface LocalCorpusStore {
  getChapter(
    translationId: string,
    book: string,
    chapter: number,
  ): Promise<LocalChapterRecord | null>;
  putChapter(record: LocalChapterRecord): Promise<void>;
  /** Optional batch write — one transaction when the store supports it. */
  putChapters?(records: LocalChapterRecord[]): Promise<void>;
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

  async putChapters(records: LocalChapterRecord[]): Promise<void> {
    for (const record of records) {
      await this.putChapter(record);
    }
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
    chapter: R2ChapterJson & { revision?: string },
    installedAt = new Date().toISOString(),
  ): Promise<LocalChapterRecord> {
    const record: LocalChapterRecord = {
      translationId,
      book: chapter.book,
      chapter: chapter.chapter,
      verses: chapter.verses.map((v) => ({ verse: v.verse, text: v.text })),
      installedAt,
      ...(chapter.revision ? { revision: chapter.revision } : {}),
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
    const records: LocalChapterRecord[] = chapters.map((ch) => ({
      translationId,
      book: ch.book,
      chapter: ch.chapter,
      verses: ch.verses.map((v) => ({ verse: v.verse, text: v.text })),
      installedAt,
    }));
    if (this.store.putChapters) {
      // Chunk large packs so a single IDB transaction stays responsive.
      const chunkSize = 200;
      for (let i = 0; i < records.length; i += chunkSize) {
        await this.store.putChapters(records.slice(i, i + chunkSize));
      }
    } else {
      for (const record of records) {
        await this.store.putChapter(record);
      }
    }
    return { translationId, installed: records.length };
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
 * Boot defaults — only translations that can ship a complete corpus today.
 * 和合本 (cuvs) boots first; WEB/KJV/ASV are optional whole-Bible downloads.
 * Never densify verse text into TypeScript; never chapter-by-chapter product UX.
 */
export const BOOT_DEFAULT_TRANSLATION_IDS = ["cuvs"] as const;

/**
 * @deprecated Product boot is whole-Bible for BOOT_DEFAULT_TRANSLATION_IDS.
 * Kept for fixture scaffolding / admin PD dense samples only — not the client install unit.
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

/**
 * Key-chapter public-domain sample set kept in-repo under fixtures/corpus.
 * Full Protestant canon for WEB/KJV/ASV is seeded to R2 via admin PD seed /
 * `scripts/seed-r2-pd-full.mjs` — never TypeScript packs / never licensed dumps.
 */
export const PD_DENSE_CHAPTER_REFS = [
  "Gen.1",
  "Exod.20",
  "Ps.1",
  "Ps.23",
  "Prov.3",
  "Isa.53",
  "Matt.5",
  "Matt.6",
  "Matt.28",
  "Mark.1",
  "Luke.2",
  "John.1",
  "John.3",
  "John.14",
  "John.15",
  "Acts.2",
  "Rom.8",
  "Rom.12",
  "1Cor.13",
  "Eph.2",
  "Phil.4",
  "Col.3",
  "Heb.11",
  "Jas.1",
  "1John.4",
  "Rev.21",
] as const;

/** Full Protestant canon refs (for PD tids whose R2 prefix holds complete text). */
export function listProtestantChapterRefs(): string[] {
  const refs: string[] = [];
  for (const b of listBooks()) {
    for (let c = 1; c <= b.chapters; c += 1) refs.push(`${b.id}.${c}`);
  }
  return refs;
}

/**
 * Optional whole-Bible downloads with a complete PD corpus path (getbible → R2).
 * Incomplete licensed/sample tids are not listed.
 */
export const DOWNLOADABLE_TRANSLATION_IDS = ["web", "kjv", "asv"] as const;

/** Tids that can advertise a full Protestant whole-Bible R2 pack. */
const WHOLE_BIBLE_PACK_IDS = new Set<string>([
  ...BOOT_DEFAULT_TRANSLATION_IDS,
  ...DOWNLOADABLE_TRANSLATION_IDS,
]);

export function listDownloadableCorpusCatalog(): DownloadableCorpusPack[] {
  const packs: DownloadableCorpusPack[] = [];
  const boot = new Set<string>(BOOT_DEFAULT_TRANSLATION_IDS);
  const downloadable = new Set<string>(DOWNLOADABLE_TRANSLATION_IDS);
  const wholeRefs = listProtestantChapterRefs();

  // Only list translations that are available AND have a full-pack path.
  for (const t of listTranslations({ availableOnly: true })) {
    let installMode: DownloadableCorpusPack["installMode"];
    if (t.provider === "external") installMode = "external";
    else if (boot.has(t.id)) installMode = "boot";
    else if (downloadable.has(t.id)) installMode = "download";
    else {
      // Available but not in boot/download sets — skip (should not happen).
      continue;
    }

    // Product unit is always the whole Bible for boot/download (never chapter packs).
    const chapterRefs = installMode === "external" ? [] : wholeRefs;
    const fullPackAvailable = installMode !== "external" && WHOLE_BIBLE_PACK_IDS.has(t.id);
    const fullPackChapterCount = fullPackAvailable ? wholeRefs.length : undefined;

    packs.push({
      translationId: t.id,
      // v2: clients re-pull after PD footnote-marker (`a`) sanitization.
      version: 2,
      name: t.name,
      language: t.language,
      license: t.license,
      installMode,
      chapterRefs,
      r2Prefix: `bible/${t.id}/`,
      fullPackAvailable: fullPackAvailable || undefined,
      fullPackChapterCount,
      /** Client must download the whole translation, not chapter-by-chapter UX. */
      packKind: installMode === "external" ? undefined : "whole-bible",
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

function demoPlaceholderVerse(
  translationId: string,
  abbr: string,
  book: string,
  chapter: number,
): string {
  if (translationId === "cuvs" || translationId === "cuvt" || translationId === "rcuv") {
    return `（预览）${book} ${chapter} 章全文尚未载入。可继续选书选章；安装完整译本后显示经文。`;
  }
  if (translationId === "shinKyoudou" || translationId === "kougo" || translationId === "shinkaiyaku") {
    return `（プレビュー）${book} ${chapter} 章の本文は未収録です。書・章の移動はできます。`;
  }
  return `(Preview) ${abbr} ${book} ${chapter} — full text not loaded yet. Navigation still works; install the complete translation for verses.`;
}

/**
 * Boot / fallback pack: whole Protestant canon so chapter navigation always works.
 * Rich teaching prose is kept for a few sample chapters; every other chapter gets
 * a short preview placeholder (not a TS verse module).
 */
export function buildDemoDownloadPack(translationId: string): DownloadPackPayload {
  const meta = getTranslation(translationId);
  const abbr = meta?.abbreviation ?? translationId;
  const rich = new Map<string, R2ChapterJson>();
  const put = (ch: R2ChapterJson) => rich.set(`${ch.book}.${ch.chapter}`, ch);

  put({
    book: "John",
    chapter: 1,
    verses: [
      { verse: 1, text: `[${abbr}] In the beginning was the Word.` },
      { verse: 14, text: `[${abbr}] The Word became flesh.` },
    ],
  });
  put({
    book: "John",
    chapter: 3,
    verses: [{ verse: 16, text: `[${abbr}] For God so loved the world.` }],
  });
  put({
    book: "Ps",
    chapter: 23,
    verses: [{ verse: 1, text: `[${abbr}] The Lord is my shepherd.` }],
  });

  if (translationId === "cuvs") {
    put({
      book: "John",
      chapter: 1,
      verses: [
        { verse: 1, text: "太初有道，道与神同在，道就是神。" },
        { verse: 2, text: "这道太初与神同在。" },
        { verse: 3, text: "万物是借着他造的；凡被造的，没有一样不是借着他造的。" },
        { verse: 4, text: "生命在他里头，这生命就是人的光。" },
        { verse: 5, text: "光照在黑暗里，黑暗却不接受光。" },
        { verse: 9, text: "那光是真光，照亮一切生在世上的人。" },
        { verse: 10, text: "他在世界，世界也是借着他造的，世界却不认识他。" },
        { verse: 11, text: "他到自己的地方来，自己的人倒不接待他。" },
        { verse: 12, text: "凡接待他的，就是信他名的人，他就赐他们权柄，作神的儿女。" },
        { verse: 14, text: "道成了肉身，住在我们中间，充充满满地有恩典有真理。我们也见过他的荣光，正是父独生子的荣光。" },
        { verse: 16, text: "从他丰满的恩典里，我们都领受了，而且恩上加恩。" },
        { verse: 17, text: "律法本是借着摩西传的；恩典和真理都是由耶稣基督来的。" },
        { verse: 18, text: "从来没有人看见神，只有在父怀里的独生子将他表明出来。" },
      ],
    });
    put({
      book: "John",
      chapter: 2,
      verses: [
        { verse: 1, text: "第三日，在加利利的迦拿有娶亲的筵席，耶稣的母亲在那里。" },
        { verse: 2, text: "耶稣和他的门徒也被请去赴席。" },
        { verse: 3, text: "酒用尽了，耶稣的母亲对他说：「他们没有酒了。」" },
        { verse: 4, text: "耶稣说：「母亲，我与你有什么相干？我的时候还没有到。」" },
        { verse: 5, text: "他母亲对用人说：「他告诉你们什么，你们就做什么。」" },
        { verse: 6, text: "照犹太人洁净的规矩，有六口石缸摆在那里，每口可以盛两三桶水。" },
        { verse: 7, text: "耶稣对用人说：「把缸倒满了水。」他们就倒满了，直到缸口。" },
        { verse: 8, text: "耶稣又说：「现在可以舀出来，送给管筵席的。」他们就送了去。" },
        { verse: 9, text: "管筵席的尝了那水变的酒，并不知道是哪里来的，只有舀水的用人知道。管筵席的便叫新郎来，" },
        { verse: 10, text: "对他说：「人都是先摆上好酒，等客喝足了才摆下次的；你倒把好酒留到如今！」" },
        { verse: 11, text: "这是耶稣所行的头一件神迹，是在加利利的迦拿行的，显出他的荣耀来；他的门徒就信他了。" },
      ],
    });
    put({
      book: "John",
      chapter: 3,
      verses: [
        { verse: 16, text: "神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不至灭亡，反得永生。" },
        { verse: 17, text: "因为神差他的儿子降世，不是要定世人的罪，乃是要叫世人因他得救。" },
      ],
    });
    put({
      book: "Ps",
      chapter: 23,
      verses: [
        { verse: 1, text: "耶和华是我的牧者，我必不至缺乏。" },
        { verse: 2, text: "他使我躺卧在青草地上，领我在可安歇的水边。" },
        { verse: 3, text: "他使我的灵魂苏醒，为自己的名引导我走义路。" },
        { verse: 4, text: "我虽然行过死荫的幽谷，也不怕遭害，因为你与我同在；你的杖，你的竿，都安慰我。" },
      ],
    });
  } else if (translationId === "shinKyoudou") {
    put({
      book: "John",
      chapter: 1,
      verses: [
        { verse: 1, text: "初めに言があった。言は神と共にあった。" },
        { verse: 14, text: "言は肉となって、わたしたちの間に宿られた。" },
      ],
    });
    put({
      book: "John",
      chapter: 3,
      verses: [{ verse: 16, text: "神は、その独り子をお与えになったほどに、世を愛された。" }],
    });
    put({
      book: "Ps",
      chapter: 23,
      verses: [{ verse: 1, text: "主は羊飼い。わたしには何も欠けることがない。" }],
    });
  } else if (translationId === "nasb" || translationId === "web") {
    put({
      book: "John",
      chapter: 1,
      verses: [
        {
          verse: 1,
          text: "In the beginning was the Word, and the Word was with God, and the Word was God.",
        },
        {
          verse: 14,
          text: "And the Word became flesh, and dwelt among us, and we saw His glory.",
        },
      ],
    });
    put({
      book: "John",
      chapter: 3,
      verses: [
        {
          verse: 16,
          text: "For God so loved the world, that He gave His only begotten Son.",
        },
      ],
    });
    put({
      book: "Ps",
      chapter: 23,
      verses: [{ verse: 1, text: "The Lord is my shepherd, I shall not want." }],
    });
  }

  const chapters: R2ChapterJson[] = [];
  for (const ref of listProtestantChapterRefs()) {
    const existing = rich.get(ref);
    if (existing) {
      chapters.push(existing);
      continue;
    }
    const dot = ref.lastIndexOf(".");
    const book = ref.slice(0, dot);
    const chapter = Number(ref.slice(dot + 1));
    chapters.push({
      book,
      chapter,
      verses: [
        {
          verse: 1,
          text: demoPlaceholderVerse(translationId, abbr, book, chapter),
        },
      ],
    });
  }

  return { translationId, version: 2, chapters };
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
    downloadable.length >= 3 &&
    downloadable.every((d) => ["web", "kjv", "asv"].includes(d.translationId)) &&
    external.length === 0 &&
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
