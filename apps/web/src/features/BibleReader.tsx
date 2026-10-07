import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getBook,
  listBooks,
  listTranslations,
  type TranslationMeta,
} from "@logoshome/bible";
import { api, getToken } from "../lib/api";

type ChapterPayload =
  | {
      translationId: string;
      book: string;
      chapter: number;
      verses: { verse: number; text: string }[];
      source: string;
    }
  | { external: true; url: string; meta: TranslationMeta };

const HIGHLIGHT_COLORS = [
  { id: "amber", value: "#f5d76e" },
  { id: "mint", value: "#a8e6cf" },
  { id: "rose", value: "#f8b4c4" },
  { id: "sky", value: "#a8d8ea" },
] as const;

function bookLocaleKey(lang: string): "zh" | "en" | "ja" {
  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("ja")) return "ja";
  return "en";
}

function ChapterPane({
  chapter,
  fontSize,
  locale,
  t,
  selectedVerse,
  onSelectVerse,
}: {
  chapter: ChapterPayload | null;
  fontSize: number;
  locale: "zh-CN" | "en" | "ja";
  t: (key: string) => string;
  selectedVerse: number | null;
  onSelectVerse: (verse: number) => void;
}) {
  if (!chapter) return <p className="muted">…</p>;
  if ("external" in chapter && chapter.external) {
    return (
      <div className="panel">
        <p>{chapter.meta.name[locale]}</p>
        <a className="btn" href={chapter.url} target="_blank" rel="noreferrer">
          {chapter.meta.ssoFlag === "endao" ? t("reader.external.endao") : t("reader.external.weread")}
        </a>
      </div>
    );
  }
  if (!("verses" in chapter)) return <p className="muted">…</p>;
  return (
    <article className="reader" style={{ ["--reader-size" as string]: `${fontSize}rem` }}>
      <h2>
        {chapter.book} {chapter.chapter}
      </h2>
      {chapter.verses.map((v) => (
        <p
          className={`verse${selectedVerse === v.verse ? " verse-selected" : ""}`}
          key={v.verse}
          onClick={() => onSelectVerse(v.verse)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelectVerse(v.verse);
          }}
          role="button"
          tabIndex={0}
        >
          <span className="verse-num">{v.verse}</span>
          {v.text}
        </p>
      ))}
    </article>
  );
}

export function BibleReader() {
  const { t, i18n } = useTranslation();
  const books = useMemo(() => listBooks(), []);
  const [translationId, setTranslationId] = useState("web");
  const [secondTranslationId, setSecondTranslationId] = useState("kjv");
  const [dualPane, setDualPane] = useState(false);
  const [bookId, setBookId] = useState("John");
  const [chapterNum, setChapterNum] = useState(1);
  const [fontSize, setFontSize] = useState(1.15);
  const [chapter, setChapter] = useState<ChapterPayload | null>(null);
  const [secondChapter, setSecondChapter] = useState<ChapterPayload | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const translations = listTranslations();
  const locale = (i18n.language || "zh-CN") as "zh-CN" | "en" | "ja";
  const bookNameLocale = bookLocaleKey(i18n.language || "zh-CN");
  const currentBook = getBook(bookId) ?? books[0];
  const ref = `${bookId}.${chapterNum}`;
  const chapterOptions = useMemo(
    () => Array.from({ length: currentBook?.chapters ?? 1 }, (_, i) => i + 1),
    [currentBook?.chapters],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await api<ChapterPayload>(
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

  useEffect(() => {
    if (!dualPane) {
      setSecondChapter(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api<ChapterPayload>(
          `/v1/bible/chapter?translation=${encodeURIComponent(secondTranslationId)}&ref=${encodeURIComponent(ref)}`,
        );
        if (!cancelled) setSecondChapter(data);
      } catch {
        if (!cancelled) setSecondChapter(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dualPane, secondTranslationId, ref]);

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
        ref: { book: bookId, chapter: chapterNum, verseStart: selectedVerse ?? 1 },
        kind: "bookmark",
        ciphertext: btoa("bookmark"),
        iv,
      }),
    });
  }

  async function addHighlight(color: string) {
    if (!getToken()) {
      setError("login_required");
      return;
    }
    const verse = selectedVerse ?? 1;
    const iv = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))));
    await api("/v1/annotations", {
      method: "POST",
      body: JSON.stringify({
        translationId,
        ref: { book: bookId, chapter: chapterNum, verseStart: verse, verseEnd: verse },
        kind: "highlight",
        color,
        ciphertext: btoa(`highlight:${color}`),
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
        <select
          value={bookId}
          onChange={(e) => {
            const next = e.target.value;
            setBookId(next);
            const book = getBook(next);
            if (book && chapterNum > book.chapters) setChapterNum(1);
          }}
          aria-label="Book"
        >
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name[bookNameLocale]}
            </option>
          ))}
        </select>
        <select
          value={chapterNum}
          onChange={(e) => setChapterNum(Number(e.target.value))}
          aria-label="Chapter"
        >
          {chapterOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button type="button" className="btn ghost" onClick={() => setFontSize((s) => Math.min(1.8, s + 0.1))}>
          A+
        </button>
        <button type="button" className="btn ghost" onClick={() => setFontSize((s) => Math.max(0.9, s - 0.1))}>
          A-
        </button>
        <button type="button" className={`btn ghost${dualPane ? " active-toggle" : ""}`} onClick={() => setDualPane((d) => !d)}>
          {t("reader.dual")}
        </button>
        <button type="button" className="btn ghost" onClick={() => void addBookmark()}>
          {t("reader.bookmark")}
        </button>
      </div>

      {dualPane && (
        <div className="toolbar">
          <select
            value={secondTranslationId}
            onChange={(e) => setSecondTranslationId(e.target.value)}
            aria-label={`${t("reader.translations")} 2`}
          >
            {translations.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name[locale] ?? tr.abbreviation}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="toolbar highlight-colors" aria-label={t("reader.highlight")}>
        <span className="muted">{t("reader.highlight")}</span>
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className="swatch"
            style={{ background: c.value }}
            aria-label={`${t("reader.highlight")} ${c.id}`}
            onClick={() => void addHighlight(c.value)}
          />
        ))}
      </div>

      {error && <p className="muted">{error}</p>}

      <div className={dualPane ? "reader-dual" : undefined}>
        <ChapterPane
          chapter={chapter}
          fontSize={fontSize}
          locale={locale}
          t={t}
          selectedVerse={selectedVerse}
          onSelectVerse={setSelectedVerse}
        />
        {dualPane && (
          <ChapterPane
            chapter={secondChapter}
            fontSize={fontSize}
            locale={locale}
            t={t}
            selectedVerse={selectedVerse}
            onSelectVerse={setSelectedVerse}
          />
        )}
      </div>
    </section>
  );
}
