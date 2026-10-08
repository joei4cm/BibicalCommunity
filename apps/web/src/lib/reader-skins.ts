/** First-party Bible reader skins (not licensed publisher theme packs). */

export const READER_SKIN_IDS = ["default", "parchment", "paper", "ink"] as const;
export type ReaderSkinId = (typeof READER_SKIN_IDS)[number];

const STORAGE_KEY = "lh.readerSkin";

export function isReaderSkinId(value: string): value is ReaderSkinId {
  return (READER_SKIN_IDS as readonly string[]).includes(value);
}

export function loadReaderSkin(): ReaderSkinId {
  if (typeof localStorage === "undefined") return "default";
  const raw = localStorage.getItem(STORAGE_KEY) ?? "default";
  return isReaderSkinId(raw) ? raw : "default";
}

export function applyReaderSkin(skin: ReaderSkinId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.readerSkin = skin;
  localStorage.setItem(STORAGE_KEY, skin);
}
