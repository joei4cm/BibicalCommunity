export type ThemeId = "day" | "sepia" | "night" | "highContrast";

export function applyTheme(theme: ThemeId, el: HTMLElement = document.documentElement) {
  el.setAttribute("data-theme", theme);
}
