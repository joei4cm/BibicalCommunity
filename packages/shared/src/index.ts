export * from "./ids.js";
export * from "./schemas.js";

import { zhCN, en, ja } from "./i18n/catalogs.js";
import type { LocaleCode } from "./ids.js";

export const catalogs: Record<LocaleCode, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
  ja,
};

export function t(locale: LocaleCode, key: string): string {
  return catalogs[locale]?.[key] ?? catalogs.en[key] ?? key;
}
