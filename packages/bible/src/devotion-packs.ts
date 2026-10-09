/**
 * Devotion-pack pipeline.
 *
 * CC0 first-party materials ship as local packs. Licensed third-party devotion
 * packs use the same manifest shape and load from R2
 * (`devotion-packs/{id}/manifest.json`) once entitled.
 */

import { DEVOTION_MATERIALS, type DevotionMaterial, type StudyLicense } from "./study.js";

export type DevotionPackProvider = "local" | "r2";

export type DevotionPackManifest = {
  id: string;
  version: number;
  title: Record<"zh-CN" | "en" | "ja", string>;
  steps: DevotionMaterial["steps"];
  body: Record<"zh-CN" | "en" | "ja", string>;
  license: StudyLicense;
  provider: DevotionPackProvider;
  available: boolean;
  r2Key?: string;
};

export function r2DevotionPackObjectKey(packId: string): string {
  return `devotion-packs/${packId}/manifest.json`;
}

export function parseDevotionPackManifest(raw: string): DevotionPackManifest {
  const data = JSON.parse(raw) as Partial<DevotionPackManifest>;
  if (
    typeof data.id !== "string" ||
    typeof data.version !== "number" ||
    !data.title ||
    !data.body ||
    !Array.isArray(data.steps)
  ) {
    throw new Error("invalid_devotion_pack_manifest");
  }
  return {
    id: data.id,
    version: data.version,
    title: {
      "zh-CN": String(data.title["zh-CN"] ?? data.id),
      en: String(data.title.en ?? data.id),
      ja: String(data.title.ja ?? data.id),
    },
    steps: data.steps as DevotionMaterial["steps"],
    body: {
      "zh-CN": String(data.body["zh-CN"] ?? ""),
      en: String(data.body.en ?? ""),
      ja: String(data.body.ja ?? ""),
    },
    license: (data.license as StudyLicense) ?? "cc0",
    provider: (data.provider as DevotionPackProvider) ?? "r2",
    available: data.available !== false,
    r2Key: data.r2Key ?? r2DevotionPackObjectKey(data.id),
  };
}

export function buildDevotionPackManifestJson(pack: DevotionPackManifest): string {
  return JSON.stringify(pack);
}

export const LOCAL_DEVOTION_PACKS: DevotionPackManifest[] = DEVOTION_MATERIALS.map((m) => ({
  id: m.id,
  version: 1,
  title: m.title,
  steps: m.steps,
  body: m.body,
  license: m.license,
  provider: "local" as const,
  available: true,
}));

export const LICENSED_DEVOTION_PACK_STUBS: DevotionPackManifest[] = [
  {
    id: "publisher-devotion-sample",
    version: 1,
    title: {
      "zh-CN": "出版社灵修包（样例）",
      en: "Publisher devotion pack (sample)",
      ja: "出版社デボーションパック（見本）",
    },
    steps: ["pause", "read", "reflect", "pray"],
    body: {
      "zh-CN": "（授权内容占位）完整灵修稿将通过 R2 与 entitlement 下发。",
      en: "(Licensed placeholder) Full devotion copy ships via R2 + entitlement.",
      ja: "（ライセンス見本）全文は R2 と entitlement 経由で配信します。",
    },
    license: "open",
    provider: "r2",
    available: false,
    r2Key: r2DevotionPackObjectKey("publisher-devotion-sample"),
  },
];

export function listDevotionPacks(filter?: {
  availableOnly?: boolean;
  provider?: DevotionPackProvider;
}): DevotionPackManifest[] {
  const all = [...LOCAL_DEVOTION_PACKS, ...LICENSED_DEVOTION_PACK_STUBS];
  return all.filter((p) => {
    if (filter?.availableOnly && !p.available) return false;
    if (filter?.provider && p.provider !== filter.provider) return false;
    return true;
  });
}

export function getDevotionPack(id: string): DevotionPackManifest | undefined {
  return (
    LOCAL_DEVOTION_PACKS.find((p) => p.id === id) ??
    LICENSED_DEVOTION_PACK_STUBS.find((p) => p.id === id)
  );
}

export type DevotionPackPipelineProbe = {
  ok: boolean;
  localCount: number;
  licensedStubCount: number;
  sampleIds: string[];
};

export function probeDevotionPackPipeline(): DevotionPackPipelineProbe {
  const local = listDevotionPacks({ provider: "local", availableOnly: true });
  const licensed = listDevotionPacks({ provider: "r2" });
  const ok =
    local.length >= 5 &&
    local.every((p) => p.body.en.trim() && p.body["zh-CN"].trim() && p.body.ja.trim()) &&
    licensed.some((p) => p.r2Key?.startsWith("devotion-packs/"));
  return {
    ok,
    localCount: local.length,
    licensedStubCount: licensed.length,
    sampleIds: local.map((p) => p.id),
  };
}
