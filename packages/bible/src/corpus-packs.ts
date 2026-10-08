/**
 * Bible corpus-pack pipeline.
 *
 * Corpora are downloaded (R2 chapter JSON → client local DB), never bundled as
 * TypeScript chapter modules. Catalog rows come from boot/download defaults;
 * licensed full dumps share the same R2 prefix shape.
 */

import { r2ChapterObjectKey } from "./r2-format.js";
import {
  BOOT_DEFAULT_TRANSLATION_IDS,
  DOWNLOADABLE_TRANSLATION_IDS,
  listDownloadableCorpusCatalog,
} from "./local-corpus-db.js";
import {
  getTranslation,
  listTranslations,
  type TranslationLanguage,
  type TranslationLicense,
  type TranslationProviderKind,
} from "./translations.js";

export type CorpusPackProvider = "local" | "r2";

export type CorpusPackManifest = {
  id: string;
  version: number;
  translationId: string;
  name: Record<"zh-CN" | "en" | "ja", string>;
  language: TranslationLanguage;
  license: TranslationLicense;
  provider: CorpusPackProvider;
  /** Chapter refs currently advertised for seed / download smoke. */
  chapterRefs: string[];
  /** Sample R2 object keys for seeding / entitlement checks. */
  sampleR2Keys: string[];
  available: boolean;
  /** R2 prefix `bible/{translationId}/` when provider=r2. */
  r2Prefix?: string;
  /** boot = first-launch seed; download = user action. */
  installMode?: "boot" | "download";
};

export function r2CorpusPackPrefix(translationId: string): string {
  return `bible/${translationId}/`;
}

export function parseCorpusPackManifest(raw: string): CorpusPackManifest {
  const data = JSON.parse(raw) as Partial<CorpusPackManifest>;
  if (
    typeof data.id !== "string" ||
    typeof data.version !== "number" ||
    typeof data.translationId !== "string" ||
    !data.name ||
    !Array.isArray(data.chapterRefs)
  ) {
    throw new Error("invalid_corpus_pack_manifest");
  }
  return {
    id: data.id,
    version: data.version,
    translationId: data.translationId,
    name: {
      "zh-CN": String(data.name["zh-CN"] ?? data.translationId),
      en: String(data.name.en ?? data.translationId),
      ja: String(data.name.ja ?? data.translationId),
    },
    language: (data.language as TranslationLanguage) ?? "en",
    license: (data.license as TranslationLicense) ?? "licensed",
    provider: (data.provider as CorpusPackProvider) ?? "r2",
    chapterRefs: data.chapterRefs.map(String),
    sampleR2Keys: Array.isArray(data.sampleR2Keys) ? data.sampleR2Keys.map(String) : [],
    available: data.available !== false,
    r2Prefix: data.r2Prefix ?? r2CorpusPackPrefix(data.translationId),
    installMode: data.installMode,
  };
}

export function buildCorpusPackManifestJson(pack: CorpusPackManifest): string {
  return JSON.stringify(pack);
}

function sampleKeysFor(translationId: string, refs: string[]): string[] {
  return refs.slice(0, 3).flatMap((ref) => {
    const parts = ref.split(".");
    const book = parts[0];
    const chap = Number(parts[1]);
    if (!book || !Number.isFinite(chap)) return [];
    return [r2ChapterObjectKey(translationId, book, chap)];
  });
}

/**
 * Downloadable / boot packs derived from the slim catalog.
 * `provider` is always `r2` — content lives in MEDIA, not TypeScript.
 * Kept under filter `provider: "local"` historically meant "shipped offline";
 * those rows are gone. Callers should prefer corpus-catalog.
 */
export function buildLocalCorpusPacks(): CorpusPackManifest[] {
  // Intentionally empty — no TypeScript-embedded verse packs.
  return [];
}

/** Boot + download packs available once R2/fixtures are seeded. */
export function buildDownloadCorpusPacks(): CorpusPackManifest[] {
  const catalog = listDownloadableCorpusCatalog().filter(
    (p) => p.installMode === "boot" || p.installMode === "download",
  );
  return catalog.map((row) => {
    const meta = getTranslation(row.translationId);
    return {
      id: `${row.translationId}-r2`,
      version: row.version,
      translationId: row.translationId,
      name: row.name,
      language: row.language,
      license: row.license,
      provider: "r2" as const,
      chapterRefs: row.chapterRefs,
      sampleR2Keys: sampleKeysFor(row.translationId, row.chapterRefs),
      available: true,
      r2Prefix: row.r2Prefix,
      installMode: row.installMode === "boot" ? ("boot" as const) : ("download" as const),
      ...(meta ? {} : {}),
    };
  });
}

/**
 * Licensed / R2 full-corpus stubs — not available until entitlement + R2
 * chapter objects land. One stub per registry id with provider=r2 that is
 * not already in the boot/download catalog as a slim pack.
 */
export function buildLicensedCorpusPackStubs(): CorpusPackManifest[] {
  const catalogIds = new Set(
    listDownloadableCorpusCatalog()
      .filter((p) => p.installMode === "boot" || p.installMode === "download")
      .map((p) => p.translationId),
  );
  return listTranslations()
    .filter(
      (t) =>
        t.provider === ("r2" as TranslationProviderKind) &&
        t.license === "licensed" &&
        !catalogIds.has(t.id),
    )
    .map((t) => ({
      id: `${t.id}-r2-full`,
      version: 1,
      translationId: t.id,
      name: {
        "zh-CN": `${t.name["zh-CN"]}（完整语料）`,
        en: `${t.name.en} (full corpus)`,
        ja: `${t.name.ja}（フルコーパス）`,
      },
      language: t.language,
      license: t.license,
      provider: "r2" as const,
      chapterRefs: [],
      sampleR2Keys: [
        r2ChapterObjectKey(t.id, "John", 1),
        r2ChapterObjectKey(t.id, "John", 3),
        r2ChapterObjectKey(t.id, "Ps", 23),
      ],
      available: false,
      r2Prefix: r2CorpusPackPrefix(t.id),
    }));
}

export function listCorpusPacks(filter?: {
  availableOnly?: boolean;
  provider?: CorpusPackProvider;
  language?: TranslationLanguage;
}): CorpusPackManifest[] {
  const all = [...buildDownloadCorpusPacks(), ...buildLicensedCorpusPackStubs()];
  return all.filter((p) => {
    if (filter?.availableOnly && !p.available) return false;
    if (filter?.provider && p.provider !== filter.provider) return false;
    if (filter?.language && p.language !== filter.language) return false;
    return true;
  });
}

export function getCorpusPack(id: string): CorpusPackManifest | undefined {
  return listCorpusPacks().find((p) => p.id === id);
}

export type CorpusPackPipelineProbe = {
  ok: boolean;
  localCount: number;
  licensedStubCount: number;
  localChapterTotal: number;
  downloadableCount: number;
  bootCount: number;
  languages: { zh: number; en: number; ja: number };
  sampleIds: string[];
  /** True when TypeScript densify packs are gone (expected). */
  noTsPacks: boolean;
};

export function probeCorpusPackPipeline(): CorpusPackPipelineProbe {
  const downloadable = buildDownloadCorpusPacks();
  const boot = downloadable.filter((p) => p.installMode === "boot");
  const licensed = buildLicensedCorpusPackStubs();
  const languages = { zh: 0, en: 0, ja: 0 };
  for (const p of downloadable) {
    if (p.language === "zh" || p.language === "en" || p.language === "ja") {
      languages[p.language]++;
    }
  }
  const chapterTotal = downloadable.reduce((n, p) => n + p.chapterRefs.length, 0);
  const bootIds = new Set(BOOT_DEFAULT_TRANSLATION_IDS);
  const downloadIds = new Set(DOWNLOADABLE_TRANSLATION_IDS);
  const ok =
    boot.length === BOOT_DEFAULT_TRANSLATION_IDS.length &&
    boot.every((p) => bootIds.has(p.translationId as (typeof BOOT_DEFAULT_TRANSLATION_IDS)[number])) &&
    downloadable.length >= 8 &&
    downloadable.some((p) => downloadIds.has(p.translationId as (typeof DOWNLOADABLE_TRANSLATION_IDS)[number])) &&
    languages.en >= 1 &&
    languages.zh >= 1 &&
    languages.ja >= 1 &&
    chapterTotal >= 20 &&
    buildLocalCorpusPacks().length === 0;

  return {
    ok,
    localCount: 0,
    licensedStubCount: licensed.length,
    localChapterTotal: chapterTotal,
    downloadableCount: downloadable.length,
    bootCount: boot.length,
    languages,
    sampleIds: downloadable.slice(0, 8).map((p) => p.id),
    noTsPacks: true,
  };
}
