/**
 * Bible reader theme-pack pipeline.
 *
 * First-party skins ship as local manifests. Licensed publisher packs use the
 * same shape and load from R2 (`theme-packs/{id}/manifest.json`) once entitled.
 */

export type ThemePackLicense = "first-party" | "licensed" | "cc0";
export type ThemePackProvider = "local" | "r2";

export type ThemePackCssVariables = {
  readerBg: string;
  verseColor: string;
  verseNum: string;
  borderColor?: string;
};

export type ThemePackStyleHints = {
  backgroundImage?: string;
  boxShadow?: string;
};

export type ThemePackManifest = {
  id: string;
  version: number;
  name: Record<"zh-CN" | "en" | "ja", string>;
  license: ThemePackLicense;
  provider: ThemePackProvider;
  cssVariables: ThemePackCssVariables;
  styleHints?: ThemePackStyleHints;
  available: boolean;
  /** When provider=r2, object key under MEDIA. */
  r2Key?: string;
};

/** R2 object key for a theme-pack manifest. */
export function r2ThemePackObjectKey(packId: string): string {
  return `theme-packs/${packId}/manifest.json`;
}

export function parseThemePackManifest(raw: string): ThemePackManifest {
  const data = JSON.parse(raw) as Partial<ThemePackManifest>;
  if (
    typeof data.id !== "string" ||
    typeof data.version !== "number" ||
    !data.name ||
    !data.cssVariables ||
    typeof data.cssVariables.readerBg !== "string" ||
    typeof data.cssVariables.verseColor !== "string" ||
    typeof data.cssVariables.verseNum !== "string"
  ) {
    throw new Error("invalid_theme_pack_manifest");
  }
  return {
    id: data.id,
    version: data.version,
    name: {
      "zh-CN": String(data.name["zh-CN"] ?? data.id),
      en: String(data.name.en ?? data.id),
      ja: String(data.name.ja ?? data.id),
    },
    license: (data.license as ThemePackLicense) ?? "licensed",
    provider: (data.provider as ThemePackProvider) ?? "r2",
    cssVariables: {
      readerBg: data.cssVariables.readerBg,
      verseColor: data.cssVariables.verseColor,
      verseNum: data.cssVariables.verseNum,
      borderColor: data.cssVariables.borderColor,
    },
    styleHints: data.styleHints,
    available: data.available !== false,
    r2Key: data.r2Key ?? r2ThemePackObjectKey(data.id),
  };
}

export function buildThemePackManifestJson(pack: ThemePackManifest): string {
  return JSON.stringify(pack);
}

/** Built-in first-party packs — same ids as legacy READER_SKIN_IDS. */
export const FIRST_PARTY_THEME_PACKS: ThemePackManifest[] = [
  {
    id: "default",
    version: 1,
    name: { "zh-CN": "默认", en: "Default", ja: "デフォルト" },
    license: "first-party",
    provider: "local",
    cssVariables: {
      readerBg: "#f7f3ea",
      verseColor: "#1c2b2a",
      verseNum: "#0f6b5c",
      borderColor: "rgba(0,0,0,0.08)",
    },
    available: true,
  },
  {
    id: "parchment",
    version: 1,
    name: { "zh-CN": "羊皮纸", en: "Parchment", ja: "羊皮紙" },
    license: "first-party",
    provider: "local",
    cssVariables: {
      readerBg: "#f3e6c8",
      verseColor: "#3a2c1c",
      verseNum: "#8a5a2b",
      borderColor: "rgba(90,60,20,0.15)",
    },
    styleHints: {
      backgroundImage:
        "linear-gradient(180deg, rgba(255, 248, 230, 0.55), transparent 40%), repeating-linear-gradient(0deg, rgba(90, 60, 20, 0.03) 0 1px, transparent 1px 4px)",
      boxShadow: "inset 0 0 40px rgba(90, 60, 20, 0.08)",
    },
    available: true,
  },
  {
    id: "paper",
    version: 1,
    name: { "zh-CN": "素纸", en: "Paper", ja: "用紙" },
    license: "first-party",
    provider: "local",
    cssVariables: {
      readerBg: "#fbfbf8",
      verseColor: "#1a1a1a",
      verseNum: "#004d40",
      borderColor: "rgba(0,0,0,0.08)",
    },
    styleHints: {
      boxShadow: "0 1px 0 rgba(255, 255, 255, 0.8) inset",
    },
    available: true,
  },
  {
    id: "ink",
    version: 1,
    name: { "zh-CN": "墨夜", en: "Ink night", ja: "墨夜" },
    license: "first-party",
    provider: "local",
    cssVariables: {
      readerBg: "#0b1218",
      verseColor: "#d7e2ec",
      verseNum: "#7ec8ff",
      borderColor: "rgba(215, 226, 236, 0.12)",
    },
    styleHints: {
      backgroundImage:
        "radial-gradient(800px 400px at 20% 0%, rgba(40, 90, 120, 0.25), transparent 55%)",
    },
    available: true,
  },
];

/** Placeholder licensed pack entry — available only when R2 entitlement lands. */
export const LICENSED_THEME_PACK_STUBS: ThemePackManifest[] = [
  {
    id: "publisher-sample",
    version: 1,
    name: {
      "zh-CN": "出版社主题包（样例）",
      en: "Publisher theme pack (sample)",
      ja: "出版社テーマパック（見本）",
    },
    license: "licensed",
    provider: "r2",
    cssVariables: {
      readerBg: "#faf6ef",
      verseColor: "#222",
      verseNum: "#6b4f2a",
    },
    available: false,
    r2Key: r2ThemePackObjectKey("publisher-sample"),
  },
];

const LOCAL_BY_ID = Object.fromEntries(
  FIRST_PARTY_THEME_PACKS.map((p) => [p.id, p]),
) as Record<string, ThemePackManifest>;

export function listThemePacks(filter?: {
  availableOnly?: boolean;
  license?: ThemePackLicense;
}): ThemePackManifest[] {
  const all = [...FIRST_PARTY_THEME_PACKS, ...LICENSED_THEME_PACK_STUBS];
  return all.filter((p) => {
    if (filter?.availableOnly && !p.available) return false;
    if (filter?.license && p.license !== filter.license) return false;
    return true;
  });
}

export function getThemePack(id: string): ThemePackManifest | undefined {
  return LOCAL_BY_ID[id] ?? LICENSED_THEME_PACK_STUBS.find((p) => p.id === id);
}

/** Resolve a pack for client apply: local first-party, else R2 stub metadata. */
export function resolveThemePack(id: string): ThemePackManifest | null {
  const pack = getThemePack(id);
  if (!pack) return null;
  if (pack.provider === "local") return pack;
  // Licensed R2 packs stay unavailable until MEDIA serves the manifest.
  return pack.available ? pack : pack;
}

export type ThemePackPipelineProbe = {
  ok: boolean;
  firstPartyCount: number;
  licensedStubCount: number;
  sampleIds: string[];
};

export function probeThemePackPipeline(): ThemePackPipelineProbe {
  const firstParty = listThemePacks({ license: "first-party", availableOnly: true });
  const licensed = listThemePacks({ license: "licensed" });
  const ok =
    firstParty.length >= 4 &&
    firstParty.every((p) => p.provider === "local" && p.cssVariables.readerBg) &&
    licensed.some((p) => p.provider === "r2" && p.r2Key?.startsWith("theme-packs/"));
  return {
    ok,
    firstPartyCount: firstParty.length,
    licensedStubCount: licensed.length,
    sampleIds: firstParty.map((p) => p.id),
  };
}
