import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FIRST_PARTY_THEME_PACKS,
  getThemePack,
  listThemePacks,
  type ThemePackManifest,
} from "@logoshome/bible";

export const READER_SKIN_IDS = ["default", "parchment", "paper", "ink"] as const;
export type ReaderSkinId = (typeof READER_SKIN_IDS)[number];

const STORAGE_KEY = "lh.readerSkin";

export type ReaderSkinPalette = {
  readerBg: string;
  verseColor: string;
  verseNum: string;
};

export function isReaderSkinId(value: string): value is ReaderSkinId {
  return (READER_SKIN_IDS as readonly string[]).includes(value);
}

export function readerSkinPalette(id: ReaderSkinId): ReaderSkinPalette {
  const pack = getThemePack(id) ?? FIRST_PARTY_THEME_PACKS[0]!;
  return {
    readerBg: pack.cssVariables.readerBg,
    verseColor: pack.cssVariables.verseColor,
    verseNum: pack.cssVariables.verseNum,
  };
}

export async function loadReaderSkin(): Promise<ReaderSkinId> {
  try {
    const raw = (await AsyncStorage.getItem(STORAGE_KEY)) ?? "default";
    return isReaderSkinId(raw) ? raw : "default";
  } catch {
    return "default";
  }
}

export async function saveReaderSkin(skin: ReaderSkinId): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, skin);
}

export function listAvailableReaderThemePacks(): ThemePackManifest[] {
  return listThemePacks({ availableOnly: true });
}
