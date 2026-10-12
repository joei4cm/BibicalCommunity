export * from "./ids.js";
export * from "./schemas.js";
export * from "./call-signaling.js";
export * from "./embed-allowlist.js";
export * from "./church-roles.js";
export * from "./read-receipts.js";

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
