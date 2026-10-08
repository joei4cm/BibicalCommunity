/**
 * Bible corpus-pack pipeline.
 *
 * Local public-domain / scaffold chapters ship as available packs derived from
 * `listLocalScaffoldInventory`. Full licensed translation corpora use the same
 * manifest shape and load chapter JSON from R2 (`bible/{translationId}/…`)
 * once entitlement lands.
 */

import { r2ChapterObjectKey } from "./r2-format.js";
import { listLocalScaffoldInventory } from "./provider.js";
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
  /** Chapter refs currently available offline (Book.chapter). */
  chapterRefs: string[];
  /** Sample R2 object keys for seeding / entitlement checks. */
  sampleR2Keys: string[];
  available: boolean;
  /** R2 prefix `bible/{translationId}/` when provider=r2. */
  r2Prefix?: string;
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
  };
}

export function buildCorpusPackManifestJson(pack: CorpusPackManifest): string {
  return JSON.stringify(pack);
}

function inventoryByTranslation(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of listLocalScaffoldInventory()) {
    const list = map.get(row.translationId) ?? [];
    list.push(row.ref);
    map.set(row.translationId, list);
  }
  for (const [, refs] of map) refs.sort();
  return map;
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

/** Local packs: every translation that already has offline scaffold chapters. */
export function buildLocalCorpusPacks(): CorpusPackManifest[] {
  const byTid = inventoryByTranslation();
  const packs: CorpusPackManifest[] = [];
  for (const [translationId, chapterRefs] of byTid) {
    const meta = getTranslation(translationId);
    if (!meta) continue;
    packs.push({
      id: `${translationId}-local`,
      version: 1,
      translationId,
      name: meta.name,
      language: meta.language,
      license: meta.license,
      provider: "local",
      chapterRefs,
      sampleR2Keys: sampleKeysFor(translationId, chapterRefs),
      available: true,
    });
  }
  return packs.sort((a, b) => a.translationId.localeCompare(b.translationId));
}

/**
 * Licensed / R2 full-corpus stubs — not available until entitlement + R2
 * chapter objects land. One stub per registry id with provider=r2.
 */
export function buildLicensedCorpusPackStubs(): CorpusPackManifest[] {
  return listTranslations()
    .filter((t) => t.provider === ("r2" as TranslationProviderKind) && t.license === "licensed")
    .map((t) => ({
      id: `${t.id}-r2`,
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
  const all = [...buildLocalCorpusPacks(), ...buildLicensedCorpusPackStubs()];
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
  languages: { zh: number; en: number; ja: number };
  sampleIds: string[];
};

export function probeCorpusPackPipeline(): CorpusPackPipelineProbe {
  const local = listCorpusPacks({ provider: "local", availableOnly: true });
  const licensed = listCorpusPacks({ provider: "r2" });
  const languages = { zh: 0, en: 0, ja: 0 };
  for (const p of local) {
    if (p.language === "zh" || p.language === "en" || p.language === "ja") {
      languages[p.language]++;
    }
  }
  const localChapterTotal = local.reduce((n, p) => n + p.chapterRefs.length, 0);
  const ok =
    local.length >= 5 &&
    localChapterTotal >= 100 &&
    languages.en >= 1 &&
    languages.zh >= 1 &&
    languages.ja >= 1 &&
    licensed.length >= 5 &&
    licensed.every((p) => p.r2Prefix?.startsWith("bible/") && p.sampleR2Keys.length >= 1) &&
    !licensed.some((p) => p.available);
  return {
    ok,
    localCount: local.length,
    licensedStubCount: licensed.length,
    localChapterTotal,
    languages,
    sampleIds: local.slice(0, 8).map((p) => p.id),
  };
}
