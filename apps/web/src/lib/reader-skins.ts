/**
 * Bible reader skins backed by the shared theme-pack pipeline
 * (`@logoshome/bible` ThemePackManifest). First-party packs are local;
 * licensed publisher packs share the same apply path once R2-entitled.
 */
import {
  FIRST_PARTY_THEME_PACKS,
  getThemePack,
  listThemePacks,
  type ThemePackManifest,
} from "@logoshome/bible";

export const READER_SKIN_IDS = ["default", "parchment", "paper", "ink"] as const;
export type ReaderSkinId = (typeof READER_SKIN_IDS)[number];

/** Day/sepia app themes may pick these; night uses app chrome only (no parchment/ink). */
export const READER_SKIN_DAY_IDS = ["default", "parchment", "paper"] as const;
export type ReaderSkinDayId = (typeof READER_SKIN_DAY_IDS)[number];

// Keep first-party pack catalog aligned with skin ids.
if (
  !READER_SKIN_IDS.every((id) => FIRST_PARTY_THEME_PACKS.some((p) => p.id === id)) ||
  FIRST_PARTY_THEME_PACKS.length < READER_SKIN_IDS.length
) {
  throw new Error("READER_SKIN_IDS out of sync with FIRST_PARTY_THEME_PACKS");
}

export function appThemeAllowsReaderSkins(theme: string | null | undefined): boolean {
  return theme === "day" || theme === "sepia" || !theme;
}

const STORAGE_KEY = "lh.readerSkin";

export function isReaderSkinId(value: string): value is ReaderSkinId {
  return (READER_SKIN_IDS as readonly string[]).includes(value);
}

export function loadReaderSkin(): ReaderSkinId {
  if (typeof localStorage === "undefined") return "default";
  const raw = localStorage.getItem(STORAGE_KEY) ?? "default";
  return isReaderSkinId(raw) ? raw : "default";
}

/** Apply CSS variables from a theme-pack manifest onto the document. */
export function applyThemePack(pack: ThemePackManifest): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.readerSkin = pack.id;
  root.style.setProperty("--lh-reader-bg", pack.cssVariables.readerBg);
  root.style.setProperty("--lh-reader-verse", pack.cssVariables.verseColor);
  root.style.setProperty("--lh-reader-verse-num", pack.cssVariables.verseNum);
  if (pack.cssVariables.borderColor) {
    root.style.setProperty("--lh-reader-border", pack.cssVariables.borderColor);
  }
  localStorage.setItem(STORAGE_KEY, pack.id);
}

/** Drop inline pack overrides so app theme tokens (incl. night) win. */
export function clearReaderSkinOverrides(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  delete root.dataset.readerSkin;
  root.style.removeProperty("--lh-reader-bg");
  root.style.removeProperty("--lh-reader-verse");
  root.style.removeProperty("--lh-reader-verse-num");
  root.style.removeProperty("--lh-reader-border");
}

export function applyReaderSkin(skin: ReaderSkinId): void {
  const pack = getThemePack(skin);
  if (pack) {
    applyThemePack(pack);
    return;
  }
  if (typeof document === "undefined") return;
  document.documentElement.dataset.readerSkin = skin;
  localStorage.setItem(STORAGE_KEY, skin);
}

export function listAvailableReaderThemePacks(): ThemePackManifest[] {
  return listThemePacks({ availableOnly: true });
}
