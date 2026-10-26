const STORAGE_KEY = "lh.reader.bookPickerMode";

/** How books appear in the passage picker. */
export type BookPickerMode = "abbr" | "full";

export function parseBookPickerMode(raw: string | null | undefined): BookPickerMode {
  return raw === "full" ? "full" : "abbr";
}

export function loadBookPickerMode(): BookPickerMode {
  if (typeof localStorage === "undefined") return "abbr";
  return parseBookPickerMode(localStorage.getItem(STORAGE_KEY));
}

export function saveBookPickerMode(mode: BookPickerMode): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
}
