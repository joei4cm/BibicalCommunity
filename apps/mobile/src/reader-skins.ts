import AsyncStorage from "@react-native-async-storage/async-storage";

export const READER_SKIN_IDS = ["default", "parchment", "paper", "ink"] as const;
export type ReaderSkinId = (typeof READER_SKIN_IDS)[number];

const STORAGE_KEY = "lh.readerSkin";

export type ReaderSkinPalette = {
  readerBg: string;
  verseColor: string;
  verseNum: string;
};

const PALETTES: Record<ReaderSkinId, ReaderSkinPalette> = {
  default: { readerBg: "#f7f3ea", verseColor: "#1c2b2a", verseNum: "#0f6b5c" },
  parchment: { readerBg: "#f3e6c8", verseColor: "#3a2c1c", verseNum: "#8a5a2b" },
  paper: { readerBg: "#fbfbf8", verseColor: "#1a1a1a", verseNum: "#004d40" },
  ink: { readerBg: "#0b1218", verseColor: "#d7e2ec", verseNum: "#7ec8ff" },
};

export function isReaderSkinId(value: string): value is ReaderSkinId {
  return (READER_SKIN_IDS as readonly string[]).includes(value);
}

export function readerSkinPalette(id: ReaderSkinId): ReaderSkinPalette {
  return PALETTES[id];
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
