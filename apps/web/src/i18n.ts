import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { catalogs } from "@logoshome/shared";

function flatToNested(flat: Record<string, string>) {
  // i18next can use flat keys with dots if keySeparator is false — keep flat.
  return flat;
}

void i18n.use(initReactI18next).init({
  resources: {
    "zh-CN": { translation: flatToNested(catalogs["zh-CN"]) },
    en: { translation: flatToNested(catalogs.en) },
    ja: { translation: flatToNested(catalogs.ja) },
  },
  lng: localStorage.getItem("lh.locale") ?? "zh-CN",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  keySeparator: false,
  nsSeparator: false,
});

export default i18n;
