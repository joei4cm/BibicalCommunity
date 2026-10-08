import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  buildPartnerAuthUrl,
  getBook,
  isPartnerId,
  listBooks,
  listDownloadableCorpusCatalog,
  listStudyMaterials,
  listTranslations,
  type TranslationMeta,
} from "@logoshome/bible";
import { api, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";
import { decryptJson, encryptJson } from "../lib/note-crypto";
import {
  applyReaderSkin,
  loadReaderSkin,
  READER_SKIN_IDS,
  type ReaderSkinId,
} from "../lib/reader-skins";
import {
  bibleLocalDb,
  ensureBootCorpusSeeded,
  installDownloadedPack,
  readLocalChapter,
} from "../lib/bible-local-db";

type AnnotationRow = {
  id: string;
  translationId: string;
  book: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  kind: string;
  color?: string | null;
  ciphertext: string;
  iv: string;
};

type DecryptedNote = {
  id: string;
  label: string;
  text: string;
};

type ChapterPayload =
  | {
      translationId: string;
      book: string;
      chapter: number;
      verses: { verse: number; text: string }[];
      source: string;
    }
  | { external: true; url: string; meta: TranslationMeta; sso?: boolean };

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

function partnerSsoEnabled(chapter: { url: string; sso?: boolean }): boolean {
  return Boolean(chapter.sso) || chapter.url.includes("sso=1");
}

function ChapterPane({
  chapter,
  verseRef,
  fontSize,
  lineHeight,
  fontFamily,
  locale,
  t,
  selectedVerse,
  onSelectVerse,
  highlightByVerse,
}: {
  chapter: ChapterPayload | null;
  verseRef: string;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  locale: "zh-CN" | "en" | "ja";
  t: (key: string) => string;
  selectedVerse: number | null;
  onSelectVerse: (verse: number) => void;
  highlightByVerse?: Record<number, string>;
}) {
  if (!chapter) return <p className="muted">…</p>;
  if ("external" in chapter && chapter.external) {
    const partner = chapter.meta.ssoFlag;
    const href =
      partner && isPartnerId(partner)
        ? buildPartnerAuthUrl(partner, {
            ref: verseRef,
            ssoEnabled: partnerSsoEnabled(chapter),
          })
        : chapter.url;
    return (
      <div className="panel" data-testid="reader-external">
        <p>{chapter.meta.name[locale]}</p>
        <a
          className="btn"
          href={href}
          target="_blank"
          rel="noreferrer"
          data-testid="reader-external-link"
          data-sso={partnerSsoEnabled(chapter) ? "1" : "0"}
        >
          {chapter.meta.ssoFlag === "endao" ? t("reader.external.endao") : t("reader.external.weread")}
        </a>
      </div>
    );
  }
  if (!("verses" in chapter)) return <p className="muted">…</p>;
  return (
    <article
      className="reader"
      style={{
        ["--reader-size" as string]: `${fontSize}rem`,
        ["--reader-lh" as string]: String(lineHeight),
        fontFamily,
      }}
    >
      <h2>
        {chapter.book} {chapter.chapter}
      </h2>
      {chapter.verses.map((v) => {
        const hl = highlightByVerse?.[v.verse];
        return (
          <p
            className={`verse${selectedVerse === v.verse ? " verse-selected" : ""}${hl ? " verse-highlighted" : ""}`}
            key={v.verse}
            style={hl ? { backgroundColor: hl } : undefined}
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
        );
      })}
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
  const [lineHeight, setLineHeight] = useState(1.75);
  const [serif, setSerif] = useState(true);
  const [preset, setPreset] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [readerSkin, setReaderSkin] = useState<ReaderSkinId>(() => loadReaderSkin());

  const TYPO_PRESETS = {
    compact: { fontSize: 1.0, lineHeight: 1.35, serif: false },
    comfortable: { fontSize: 1.15, lineHeight: 1.75, serif: true },
    spacious: { fontSize: 1.35, lineHeight: 2.1, serif: true },
  } as const;

  function applyPreset(id: keyof typeof TYPO_PRESETS) {
    const p = TYPO_PRESETS[id];
    setPreset(id);
    setFontSize(p.fontSize);
    setLineHeight(p.lineHeight);
    setSerif(p.serif);
  }

  useEffect(() => {
    applyReaderSkin(readerSkin);
  }, [readerSkin]);
  const [noteText, setNoteText] = useState("");
  const [chapter, setChapter] = useState<ChapterPayload | null>(null);
  const [secondChapter, setSecondChapter] = useState<ChapterPayload | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const [decryptedNotes, setDecryptedNotes] = useState<DecryptedNote[]>([]);
  const [highlightByVerse, setHighlightByVerse] = useState<Record<number, string>>({});
  const [bookmarks, setBookmarks] = useState<{ id: string; label: string }[]>([]);
  const [corpusHint, setCorpusHint] = useState<string | null>(null);
  const translations = listTranslations();
  const locale = (i18n.language || "zh-CN") as "zh-CN" | "en" | "ja";
  const bookNameLocale = bookLocaleKey(i18n.language || "zh-CN");
  const currentBook = getBook(bookId) ?? books[0];
  const ref = `${bookId}.${chapterNum}`;
  const chapterOptions = useMemo(
    () => Array.from({ length: currentBook?.chapters ?? 1 }, (_, i) => i + 1),
    [currentBook?.chapters],
  );
  const studyMaterials = useMemo(
    () => listStudyMaterials({ language: bookNameLocale }),
    [bookNameLocale],
  );
  const readerFont = serif ? "var(--lh-font-reader)" : "var(--lh-font-ui)";

  useEffect(() => {
    void ensureBootCorpusSeeded(async (tid) => {
      try {
        const pack = await api<{
          chapters: { book: string; chapter: number; verses: { verse: number; text: string }[] }[];
          source?: string;
        }>(`/v1/bible/corpus-download/${encodeURIComponent(tid)}`);
        return { chapters: pack.chapters, source: pack.source };
      } catch {
        return null;
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        // Prefer client local DB (download/boot install) over network/TS scaffolds.
        const local = await readLocalChapter(translationId, bookId, chapterNum);
        if (local && !cancelled) {
          setChapter({
            translationId,
            book: local.book,
            chapter: local.chapter,
            verses: local.verses,
            source: "local-db",
          });
          return;
        }
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
  }, [translationId, ref, bookId, chapterNum]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const catalog = listDownloadableCorpusCatalog();
        const entry = catalog.find((p) => p.translationId === translationId);
        const installed = await bibleLocalDb.listInstalled();
        const localRow = installed.find((r) => r.translationId === translationId);
        if (cancelled) return;
        if (localRow) {
          const hasChapter = localRow.chapterRefs.includes(ref);
          setCorpusHint(
            hasChapter
              ? `${t("reader.corpusLocalDb")} · ${localRow.chapterCount}`
              : `${t("reader.corpusPartial")} · ${localRow.chapterCount}`,
          );
        } else if (entry?.installMode === "download") {
          setCorpusHint(t("reader.corpusDownloadable"));
        } else if (entry?.installMode === "external") {
          setCorpusHint(t("reader.corpusExternal"));
        } else if (entry?.installMode === "boot") {
          setCorpusHint(t("reader.corpusBootPending"));
        } else {
          setCorpusHint(null);
        }
      } catch {
        if (!cancelled) setCorpusHint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [translationId, ref, t]);

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

  const refreshNotes = useCallback(async () => {
    if (!getToken()) {
      setDecryptedNotes([]);
      setHighlightByVerse({});
      setBookmarks([]);
      return;
    }
    try {
      const res = await api<{ annotations: AnnotationRow[] }>(
        `/v1/annotations?translation=${encodeURIComponent(translationId)}`,
      );
      const notes: DecryptedNote[] = [];
      const highlights: Record<number, string> = {};
      const marks: { id: string; label: string }[] = [];
      const colorMap: Record<string, string> = {
        amber: "#f5d76e",
        mint: "#a8e6cf",
        rose: "#f8b4c4",
        sky: "#a8d8ea",
      };
      for (const row of res.annotations) {
        const sameChapter = row.book === bookId && row.chapter === chapterNum;
        if (row.kind === "note") {
          try {
            const payload = await decryptJson<{ text?: string }>(row.ciphertext, row.iv, "note");
            notes.push({
              id: row.id,
              label: `${row.book} ${row.chapter}:${row.verseStart ?? "?"}`,
              text: payload.text ?? "",
            });
          } catch {
            notes.push({
              id: row.id,
              label: `${row.book} ${row.chapter}:${row.verseStart ?? "?"}`,
              text: "…",
            });
          }
        } else if (row.kind === "highlight" && sameChapter && row.verseStart != null) {
          const raw = row.color ?? "amber";
          highlights[row.verseStart] = colorMap[raw] ?? (raw.startsWith("#") ? raw : "#f5d76e");
        } else if (row.kind === "bookmark") {
          marks.push({
            id: row.id,
            label: `${row.book} ${row.chapter}:${row.verseStart ?? 1}`,
          });
        }
      }
      setDecryptedNotes(notes);
      setHighlightByVerse(highlights);
      setBookmarks(marks);
    } catch {
      /* listing is optional when offline / unauthenticated */
    }
  }, [translationId, bookId, chapterNum]);

  useEffect(() => {
    void refreshNotes();
  }, [refreshNotes]);

  async function grantEntitlement() {
    if (!getToken()) {
      setError("login_required");
      return;
    }
    try {
      await api("/v1/bible/entitlements", {
        method: "POST",
        body: JSON.stringify({ translationId }),
      });
      setNoteMsg("entitlement_ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    }
  }

  /** Download translation pack from API → install into IndexedDB local corpus DB. */
  async function downloadCorpusPack() {
    try {
      setError(null);
      const pack = await api<{
        translationId: string;
        chapters: { book: string; chapter: number; verses: { verse: number; text: string }[] }[];
        source?: string;
        error?: string;
      }>(`/v1/bible/corpus-download/${encodeURIComponent(translationId)}`);
      if (!pack.chapters?.length) {
        setError("corpus_download_empty");
        return;
      }
      const { installed } = await installDownloadedPack(translationId, pack.chapters);
      setNoteMsg(`corpus_installed:${installed}`);
      setCorpusHint(`${t("reader.corpusLocalDb")} · ${installed}`);
      // Reload chapter from local DB.
      const local = await readLocalChapter(translationId, bookId, chapterNum);
      if (local) {
        setChapter({
          translationId,
          book: local.book,
          chapter: local.chapter,
          verses: local.verses,
          source: "local-db",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    }
  }

  async function addBookmark() {
    if (!getToken()) {
      setError("login_required");
      return;
    }
    const verse = selectedVerse ?? 1;
    const { ciphertext, iv } = await encryptJson({ kind: "bookmark" }, "bookmark");
    await api("/v1/annotations", {
      method: "POST",
      body: JSON.stringify({
        translationId,
        ref: { book: bookId, chapter: chapterNum, verseStart: verse },
        kind: "bookmark",
        ciphertext,
        iv,
      }),
    });
    await refreshNotes();
  }

  async function addHighlight(color: string) {
    if (!getToken()) {
      setError("login_required");
      return;
    }
    const verse = selectedVerse ?? 1;
    const colorMap: Record<string, string> = {
      amber: "#f5d76e",
      mint: "#a8e6cf",
      rose: "#f8b4c4",
      sky: "#a8d8ea",
    };
    const { ciphertext, iv } = await encryptJson({ kind: "highlight", color }, "highlight");
    await api("/v1/annotations", {
      method: "POST",
      body: JSON.stringify({
        translationId,
        ref: { book: bookId, chapter: chapterNum, verseStart: verse, verseEnd: verse },
        kind: "highlight",
        color,
        ciphertext,
        iv,
      }),
    });
    setHighlightByVerse((prev) => ({ ...prev, [verse]: colorMap[color] ?? color }));
    await refreshNotes();
  }

  async function saveNote() {
    if (!getToken()) {
      setError("login_required");
      return;
    }
    if (selectedVerse == null || !noteText.trim()) return;
    const { ciphertext, iv } = await encryptJson({ text: noteText.trim() }, "note");
    await api("/v1/annotations", {
      method: "POST",
      body: JSON.stringify({
        translationId,
        ref: { book: bookId, chapter: chapterNum, verseStart: selectedVerse, verseEnd: selectedVerse },
        kind: "note",
        ciphertext,
        iv,
      }),
    });
    setNoteMsg("saved");
    setNoteText("");
    await refreshNotes();
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
        <button type="button" className={`btn ghost${dualPane ? " active-toggle" : ""}`} onClick={() => setDualPane((d) => !d)}>
          {t("reader.dual")}
        </button>
        <button type="button" className="btn ghost" onClick={() => void addBookmark()}>
          {t("reader.bookmark")}
        </button>
        <button type="button" className="btn ghost" onClick={() => void grantEntitlement()}>
          {t("reader.entitlement")}
        </button>
        <button
          type="button"
          className="btn ghost"
          data-testid="reader-corpus-download"
          onClick={() => void downloadCorpusPack()}
        >
          {t("reader.corpusDownload")}
        </button>
      </div>
      {corpusHint ? (
        <p className="muted" data-testid="reader-corpus-hint">
          {corpusHint}
        </p>
      ) : null}

      <div className="panel typography-panel">
        <h2 style={{ marginTop: 0 }}>{t("reader.typography")}</h2>
        <div className="toolbar">
          {(
            [
              ["compact", "reader.presetCompact"],
              ["comfortable", "reader.presetComfortable"],
              ["spacious", "reader.presetSpacious"],
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              type="button"
              className={`btn ghost${preset === id ? " active-toggle" : ""}`}
              onClick={() => applyPreset(id)}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <div className="toolbar">
          <button type="button" className="btn ghost" onClick={() => setFontSize((s) => Math.min(1.8, s + 0.1))}>
            A+
          </button>
          <button type="button" className="btn ghost" onClick={() => setFontSize((s) => Math.max(0.9, s - 0.1))}>
            A-
          </button>
          <button
            type="button"
            className={`btn ghost${serif ? " active-toggle" : ""}`}
            onClick={() => setSerif(true)}
          >
            {t("reader.serif")}
          </button>
          <button
            type="button"
            className={`btn ghost${!serif ? " active-toggle" : ""}`}
            onClick={() => setSerif(false)}
          >
            {t("reader.sans")}
          </button>
        </div>
        <div className="field">
          <label htmlFor="reader-skin">{t("reader.skin")}</label>
          <select
            id="reader-skin"
            data-testid="reader-skin"
            value={readerSkin}
            onChange={(e) => setReaderSkin(e.target.value as ReaderSkinId)}
          >
            {READER_SKIN_IDS.map((id) => (
              <option key={id} value={id}>
                {t(`reader.skin.${id}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="reader-lh">
            {t("reader.lineHeight")}: {lineHeight.toFixed(2)}
          </label>
          <input
            id="reader-lh"
            type="range"
            min={1.2}
            max={2.4}
            step={0.05}
            value={lineHeight}
            onChange={(e) => setLineHeight(Number(e.target.value))}
          />
        </div>
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
            onClick={() => void addHighlight(c.id)}
          />
        ))}
      </div>

      {selectedVerse != null && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>
            {t("reader.note")} · {bookId} {chapterNum}:{selectedVerse}
          </h2>
          <div className="field">
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t("reader.note")}
            />
          </div>
          <button type="button" className="btn" onClick={() => void saveNote()}>
            {t("reader.saveNote")}
          </button>
          {noteMsg && <p className="muted">{humanizeStatus(t, noteMsg)}</p>}
        </div>
      )}

      {error && <p className="muted">{humanizeStatus(t, error)}</p>}

      <div className={dualPane ? "reader-dual" : undefined}>
        <ChapterPane
          chapter={chapter}
          verseRef={ref}
          fontSize={fontSize}
          lineHeight={lineHeight}
          fontFamily={readerFont}
          locale={locale}
          t={t}
          selectedVerse={selectedVerse}
          onSelectVerse={setSelectedVerse}
          highlightByVerse={highlightByVerse}
        />
        {dualPane && (
          <ChapterPane
            chapter={secondChapter}
            verseRef={ref}
            fontSize={fontSize}
            lineHeight={lineHeight}
            fontFamily={readerFont}
            locale={locale}
            t={t}
            selectedVerse={selectedVerse}
            onSelectVerse={setSelectedVerse}
            highlightByVerse={highlightByVerse}
          />
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("reader.bookmark")}</h2>
        <ul className="list">
          {bookmarks.length === 0 && <li className="muted">—</li>}
          {bookmarks.map((b) => (
            <li key={b.id}>
              <strong>{b.label}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("reader.notesPanel")}</h2>
        <ul className="list">
          {decryptedNotes.length === 0 && <li className="muted">{t("reader.noNotes")}</li>}
          {decryptedNotes.map((n) => (
            <li key={n.id}>
              <strong>{n.label}</strong>
              <p style={{ margin: "0.35rem 0 0" }}>{n.text}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("reader.study")}</h2>
        <ul className="list">
          {studyMaterials.map((m) => (
            <li key={m.id}>
              <a href={m.url} target="_blank" rel="noreferrer">
                {m.title}
              </a>
              <div className="muted">{m.license}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
