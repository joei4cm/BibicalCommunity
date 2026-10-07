import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LocaleCode } from "@logoshome/shared";

const LOCALE_KEY = "lh.locale";

type LocaleContextValue = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: "zh-CN",
  setLocale: () => undefined,
});

/** Normalize stored / device locale prefixes to API LocaleCode (matches Web). */
export function normalizeApiLocale(lng: string | null | undefined): LocaleCode {
  const value = lng || "zh-CN";
  if (value.startsWith("zh")) return "zh-CN";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>("zh-CN");

  useEffect(() => {
    void AsyncStorage.getItem(LOCALE_KEY)
      .then((value) => {
        if (value) setLocaleState(normalizeApiLocale(value));
      })
      .catch(() => undefined);
  }, []);

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    void AsyncStorage.setItem(LOCALE_KEY, next).catch(() => undefined);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
