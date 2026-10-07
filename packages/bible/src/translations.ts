export type TranslationLicense = "public-domain" | "licensed" | "external";
export type TranslationProviderKind = "local" | "r2" | "external";
export type TranslationLanguage = "zh" | "en" | "ja";

export interface TranslationMeta {
  id: string;
  abbreviation: string;
  name: Record<"zh-CN" | "en" | "ja", string>;
  language: TranslationLanguage;
  license: TranslationLicense;
  provider: TranslationProviderKind;
  /** Deep link template; `{ref}` replaced with OSIS-like ref */
  externalUrlTemplate?: string;
  /** Partner SSO feature flag key */
  ssoFlag?: "endao" | "weread";
  available: boolean;
}

/**
 * Mainstream zh/en/ja translations. Licensed texts are registered but served
 * only when entitlement + R2 pack exists; otherwise UI offers external partners.
 */
export const TRANSLATION_REGISTRY: TranslationMeta[] = [
  {
    id: "web",
    abbreviation: "WEB",
    name: { "zh-CN": "世界英文圣经", en: "World English Bible", ja: "世界英語聖書" },
    language: "en",
    license: "public-domain",
    provider: "local",
    available: true,
  },
  {
    id: "kjv",
    abbreviation: "KJV",
    name: { "zh-CN": "钦定版", en: "King James Version", ja: "欽定訳" },
    language: "en",
    license: "public-domain",
    provider: "local",
    available: true,
  },
  {
    id: "asv",
    abbreviation: "ASV",
    name: { "zh-CN": "美国标准译本", en: "American Standard Version", ja: "アメリカ標準訳" },
    language: "en",
    license: "public-domain",
    provider: "local",
    available: true,
  },
  {
    id: "niv",
    abbreviation: "NIV",
    name: { "zh-CN": "新国际译本", en: "New International Version", ja: "NIV" },
    language: "en",
    license: "external",
    provider: "external",
    externalUrlTemplate: "https://www.biblegateway.com/passage/?search={ref}&version=NIV",
    available: true,
  },
  {
    id: "esv",
    abbreviation: "ESV",
    name: { "zh-CN": "英语标准译本", en: "English Standard Version", ja: "ESV" },
    language: "en",
    license: "external",
    provider: "external",
    externalUrlTemplate: "https://www.biblegateway.com/passage/?search={ref}&version=ESV",
    available: true,
  },
  {
    id: "nlt",
    abbreviation: "NLT",
    name: { "zh-CN": "新当代译本", en: "New Living Translation", ja: "NLT" },
    language: "en",
    license: "external",
    provider: "external",
    externalUrlTemplate: "https://www.biblegateway.com/passage/?search={ref}&version=NLT",
    available: true,
  },
  {
    id: "cuvs",
    abbreviation: "和合本",
    name: { "zh-CN": "和合本（简体）", en: "Chinese Union Version (Simplified)", ja: "和合本（簡体）" },
    language: "zh",
    license: "licensed",
    provider: "r2",
    /** Served via R2 path when chapter JSON is present (UI may attempt load). */
    available: true,
  },
  {
    id: "cuvt",
    abbreviation: "和合本",
    name: { "zh-CN": "和合本（繁體）", en: "Chinese Union Version (Traditional)", ja: "和合本（繁体）" },
    language: "zh",
    license: "licensed",
    provider: "r2",
    available: true,
  },
  {
    id: "rcuv",
    abbreviation: "新标点和合本",
    name: { "zh-CN": "新标点和合本", en: "Revised Chinese Union Version", ja: "新標點和合本" },
    language: "zh",
    license: "licensed",
    provider: "r2",
    available: true,
  },
  {
    id: "ccb",
    abbreviation: "圣经当代译本",
    name: { "zh-CN": "圣经当代译本", en: "Chinese Contemporary Bible", ja: "現代中国語訳" },
    language: "zh",
    license: "licensed",
    provider: "r2",
    available: true,
  },
  {
    id: "lzz",
    abbreviation: "吕振中",
    name: { "zh-CN": "吕振中译本", en: "Lü Zhenzhong Translation", ja: "呂振中訳" },
    language: "zh",
    license: "licensed",
    provider: "r2",
    available: true,
  },
  {
    id: "endao",
    abbreviation: "恩道",
    name: { "zh-CN": "恩道译本（外链）", en: "Endao (external)", ja: "恩道（外部）" },
    language: "zh",
    license: "external",
    provider: "external",
    externalUrlTemplate: "https://www.edobible.com/?ref={ref}",
    ssoFlag: "endao",
    available: true,
  },
  {
    id: "weread",
    abbreviation: "微读",
    name: { "zh-CN": "微读书城（外链）", en: "WeRead Bible (external)", ja: "微読（外部）" },
    language: "zh",
    license: "external",
    provider: "external",
    externalUrlTemplate: "https://bible.weixin.qq.com/?ref={ref}",
    ssoFlag: "weread",
    available: true,
  },
  {
    id: "kougo",
    abbreviation: "口語訳",
    name: { "zh-CN": "日语口语译本", en: "Japanese Colloquial", ja: "口語訳" },
    language: "ja",
    license: "licensed",
    provider: "r2",
    available: true,
  },
  {
    id: "kougoyaku-pd",
    abbreviation: "文語訳",
    name: { "zh-CN": "日语文语译本", en: "Japanese Classical", ja: "文語訳" },
    language: "ja",
    license: "public-domain",
    provider: "local",
    available: true,
  },
  {
    id: "shinkaiyaku",
    abbreviation: "新改訳",
    name: { "zh-CN": "新改译", en: "New Japanese Bible", ja: "新改訳" },
    language: "ja",
    license: "licensed",
    provider: "r2",
    /** Served via R2 path when chapter JSON is present (UI may attempt load). */
    available: true,
  },
  {
    id: "shinKyoudou",
    abbreviation: "新共同訳",
    name: { "zh-CN": "新共同译", en: "New Interconfessional", ja: "新共同訳" },
    language: "ja",
    license: "licensed",
    provider: "r2",
    available: true,
  },
];

export function listTranslations(filter?: {
  language?: TranslationLanguage;
  availableOnly?: boolean;
}): TranslationMeta[] {
  return TRANSLATION_REGISTRY.filter((t) => {
    if (filter?.language && t.language !== filter.language) return false;
    if (filter?.availableOnly && !t.available) return false;
    return true;
  });
}

export function getTranslation(id: string): TranslationMeta | undefined {
  return TRANSLATION_REGISTRY.find((t) => t.id === id);
}

export function buildExternalUrl(meta: TranslationMeta, ref: string): string | null {
  if (!meta.externalUrlTemplate) return null;
  return meta.externalUrlTemplate.replace("{ref}", encodeURIComponent(ref));
}
