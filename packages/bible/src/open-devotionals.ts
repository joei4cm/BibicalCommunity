/**
 * Calendar devotion readings backed by public-domain corpora
 * (Spurgeon Morning & Evening, Daily Light, BCP 1662 collects)
 * published via Open Christian Data.
 *
 * Full year JSON lives at apps/web/public/devotion/open-devotionals.json
 * and is fetched at runtime. A small sample ships for tests/offline fallback.
 */

import sampleJson from "./data/open-devotionals.sample.json";

export type OpenDevotionalMeta = {
  spurgeon: {
    work: string;
    author: string;
    year: number;
    license: string;
    source: string;
    dataset: string;
    note?: string;
  };
  dailyLight: {
    work: string;
    license: string;
    dataset: string;
  };
  bcp: {
    work: string;
    license: string;
    dataset: string;
  };
};

export type SpurgeonMorning = {
  md: string;
  ref: string;
  title: string;
  text: string;
};

export type DailyLightMorning = {
  md: string;
  refs: string[];
  text: string;
};

export type BcpCollect = {
  id: string;
  title: string;
  text: string;
};

export type OpenDevotionalsBundle = {
  meta: OpenDevotionalMeta;
  mornings: SpurgeonMorning[];
  dailyLightMornings: DailyLightMorning[];
  collects: BcpCollect[];
};

export type CalendarDevotion = {
  md: string;
  scriptureRef: string;
  dailyLightRefs: string[];
  dailyLightText: string;
  reflectTitle: string;
  reflectBody: string;
  prayTitle: string;
  prayBody: string;
  attribution: {
    reflect: string;
    pray: string;
    dataset: string;
  };
};

function padMd(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function calendarMd(date = new Date()): string {
  return padMd(date.getMonth() + 1, date.getDate());
}

export const SAMPLE_OPEN_DEVOTIONALS: OpenDevotionalsBundle =
  sampleJson as OpenDevotionalsBundle;

let cachedBundle: OpenDevotionalsBundle | null = null;

export function getOpenDevotionalsBundle(): OpenDevotionalsBundle {
  return cachedBundle ?? SAMPLE_OPEN_DEVOTIONALS;
}

export function setOpenDevotionalsBundle(bundle: OpenDevotionalsBundle | null): void {
  cachedBundle = bundle;
}

/** Resolve a day; falls back to first sample entry when md missing. */
export function getCalendarDevotion(
  md: string = calendarMd(),
  bundle: OpenDevotionalsBundle = getOpenDevotionalsBundle(),
): CalendarDevotion {
  const morning =
    bundle.mornings.find((m) => m.md === md) ?? bundle.mornings[0] ?? {
      md,
      ref: "John.1.1",
      title: "Devotion",
      text: "",
    };
  const light =
    bundle.dailyLightMornings.find((m) => m.md === md) ?? bundle.dailyLightMornings[0];
  const collectIndex = (() => {
    const [mm, dd] = md.split("-").map(Number);
    const n = ((mm || 1) - 1) * 31 + (dd || 1);
    return Math.abs(n) % Math.max(1, bundle.collects.length);
  })();
  const collect = bundle.collects[collectIndex] ?? bundle.collects[0];
  const meta = bundle.meta;
  return {
    md: morning.md,
    scriptureRef: morning.ref || light?.refs?.[0] || "John.1.1",
    dailyLightRefs: light?.refs ?? [],
    dailyLightText: light?.text ?? "",
    reflectTitle: morning.title,
    reflectBody: morning.text,
    prayTitle: collect?.title ?? "Collect",
    prayBody: collect?.text ?? "",
    attribution: {
      reflect: `${meta.spurgeon.author}, ${meta.spurgeon.work} (${meta.spurgeon.year}) · ${meta.spurgeon.license}`,
      pray: `${meta.bcp.work} · ${meta.bcp.license}`,
      dataset: meta.spurgeon.dataset,
    },
  };
}

export async function loadOpenDevotionalsFromUrl(
  url = "/devotion/open-devotionals.json",
): Promise<OpenDevotionalsBundle> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`open_devotionals_fetch_${res.status}`);
  const bundle = (await res.json()) as OpenDevotionalsBundle;
  if (!Array.isArray(bundle.mornings) || bundle.mornings.length === 0) {
    throw new Error("open_devotionals_invalid");
  }
  setOpenDevotionalsBundle(bundle);
  return bundle;
}
