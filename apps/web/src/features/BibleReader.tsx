import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listTranslations, type TranslationMeta } from "@logoshome/bible";
import { api, getToken } from "../lib/api";

type Chapter =
  | {
      translationId: string;
      book: string;
      chapter: number;
      verses: { verse: number; text: string }[];
      source: string;
    }
  | { external: true; url: string; meta: TranslationMeta };

export function BibleReader() {
  const { t, i18n } = useTranslation();
  const [translationId, setTranslationId] = useState("web");
  const [ref, setRef] = useState("John.1");
  const [fontSize, setFontSize] = useState(1.15);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const translations = listTranslations();
  const locale = (i18n.language || "zh-CN") as "zh-CN" | "en" | "ja";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await api<Chapter>(
          `/v1/bible/chapter?translation=${encodeURIComponent(translationId)}&ref=${encodeURIComponent(ref)}`,
        );
        if (!cancelled) setChapter(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [translationId, ref]);

  async function addBookmark() {
    if (!getToken()) {
      setError("login_required");
      return;
    }
    const iv = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))));
    await api("/v1/annotations", {
      method: "POST",
      body: JSON.stringify({
        translationId,
        ref: { book: "John", chapter: 1, verseStart: 1 },
        kind: "bookmark",
        ciphertext: btoa("bookmark"),
        iv,
      }),
    });
  }

  return (
    <section className="fade-up">
      <p className="muted">{t("app.tagline")}</p>
      <h1 className="brand">{t("app.name")}</h1>

      <div className="toolbar">
        <select value={translationId} onChange={(e) => setTranslationId(e.target.value)} aria-label={t("reader.translations")}>
          {translations.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.name[locale] ?? tr.abbreviation}
              {!tr.available && tr.provider === "r2" ? " (R2)" : ""}
            </option>
          ))}
        </select>
        <input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Reference" />
        <button type="button" className="btn ghost" onClick={() => setFontSize((s) => Math.min(1.8, s + 0.1))}>
          A+
        </button>
        <button type="button" className="btn ghost" onClick={() => setFontSize((s) => Math.max(0.9, s - 0.1))}>
          A-
        </button>
        <button type="button" className="btn ghost" onClick={() => void addBookmark()}>
          {t("reader.bookmark")}
        </button>
      </div>

      {error && <p className="muted">{error}</p>}

      {chapter && "external" in chapter && chapter.external ? (
        <div className="panel">
          <p>{chapter.meta.name[locale]}</p>
          <a className="btn" href={chapter.url} target="_blank" rel="noreferrer">
            {chapter.meta.ssoFlag === "endao" ? t("reader.external.endao") : t("reader.external.weread")}
          </a>
        </div>
      ) : chapter && "verses" in chapter ? (
        <article className="reader" style={{ ["--reader-size" as string]: `${fontSize}rem` }}>
          <h2>
            {chapter.book} {chapter.chapter}
          </h2>
          {chapter.verses.map((v) => (
            <p className="verse" key={v.verse}>
              <span className="verse-num">{v.verse}</span>
              {v.text}
            </p>
          ))}
        </article>
      ) : (
        <p className="muted">…</p>
      )}
    </section>
  );
}
