import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEME_IDS, type ThemeId } from "@logoshome/shared";

const THEME_KEY = "lh.theme";

export type ThemePalette = {
  id: ThemeId;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  danger: string;
  chip: string;
};

const PALETTES: Record<ThemeId, ThemePalette> = {
  day: {
    id: "day",
    bg: "#e4e8ee",
    surface: "#f7f5f1",
    text: "#18232b",
    muted: "#5f6d78",
    border: "#c8d0db",
    accent: "#1c3d48",
    danger: "#9b2c2c",
    chip: "#dde3ea",
  },
  blush: {
    id: "blush",
    bg: "#f6ecee",
    surface: "#fff8f9",
    text: "#3a2428",
    muted: "#8a6570",
    border: "#e4c8cf",
    accent: "#c45c6a",
    danger: "#9b2c2c",
    chip: "#efdce0",
  },
  sepia: {
    id: "sepia",
    bg: "#e8d9c0",
    surface: "#f7edd8",
    text: "#3b2f1e",
    muted: "#7a6a52",
    border: "#c4b396",
    accent: "#6b4f2a",
    danger: "#8b3a2a",
    chip: "#dcc9a8",
  },
  night: {
    id: "night",
    bg: "#121a19",
    surface: "#1c2b2a",
    text: "#e8efe9",
    muted: "#9aabb0",
    border: "#2f403e",
    accent: "#3cb8a0",
    danger: "#e07070",
    chip: "#243534",
  },
  highContrast: {
    id: "highContrast",
    bg: "#000000",
    surface: "#111111",
    text: "#ffffff",
    muted: "#dddddd",
    border: "#ffffff",
    accent: "#ffff00",
    danger: "#ff4444",
    chip: "#222222",
  },
};

export function themePalette(id: ThemeId): ThemePalette {
  return PALETTES[id] ?? PALETTES.day;
}

export async function loadTheme(): Promise<ThemeId> {
  const raw = await AsyncStorage.getItem(THEME_KEY);
  if (raw && (THEME_IDS as string[]).includes(raw)) return raw as ThemeId;
  return "day";
}

export async function saveTheme(theme: ThemeId): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, theme);
}

export { THEME_IDS };
export type { ThemeId };
