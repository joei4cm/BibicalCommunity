import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  adjacentChapter,
  bookIdFromSlug,
  bookSlug,
  buildPartnerAuthUrl,
  getBook,
  isPartnerId,
  listBooks,
  listDownloadableCorpusCatalog,
  listStudyMaterials,
  listTranslations,
  type DownloadableCorpusPack,
  type InstalledTranslationSummary,
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

/** Strip demo fixture markers so reading UI is not visually polluted. */
function displayVerseText(text: string): string {
  return text
    .replace(/（样例[·・.]?fixture）/gi, "")
    .replace(/\(样例[·・.]?fixture\)/gi, "")
    .replace(/\(fixture\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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
      className="reader bible-prose"
      data-testid="reader-prose"
      style={{
        ["--reader-size" as string]: `${fontSize}rem`,
        ["--reader-lh" as string]: String(lineHeight),
        fontFamily,
      }}
    >
      {/* WeDevote-style continuous chapter prose: chapter lead + superscript verses */}
      <div className="bible-prose-body">
        <span className="chapter-lead" aria-hidden="true">
          {chapter.chapter}
        </span>
        {chapter.verses.map((v) => {
          const hl = highlightByVerse?.[v.verse];
          return (
            <span
              className={`verse-inline${selectedVerse === v.verse ? " verse-selected" : ""}${hl ? " verse-highlighted" : ""}`}
              key={v.verse}
              style={hl ? { backgroundColor: hl } : undefined}
              onClick={() => onSelectVerse(v.verse)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectVerse(v.verse);
              }}
              role="button"
              tabIndex={0}
              data-verse={v.verse}
            >
              <sup className="verse-num">{v.verse}</sup>
              {displayVerseText(v.text)}{" "}
            </span>
          );
        })}
      </div>
    </article>
  );
}

export function BibleReader() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ tid?: string; bookSlug?: string; chapter?: string }>();
  const books = useMemo(() => listBooks(), []);
  const routeTid = params.tid && listTranslations().some((tr) => tr.id === params.tid) ? params.tid : "cuvs";
  const routeBookId = bookIdFromSlug(params.bookSlug ?? "john") ?? "John";
  const routeChapter = Math.max(1, Number(params.chapter ?? "1") || 1);

  const [translationId, setTranslationId] = useState(routeTid);
  const [secondTranslationId, setSecondTranslationId] = useState("nasb");
  const [dualPane, setDualPane] = useState(false);
  const [bookId, setBookId] = useState(routeBookId);
  const [chapterNum, setChapterNum] = useState(routeChapter);
  const [fontSize, setFontSize] = useState(1.15);
  const [lineHeight, setLineHeight] = useState(1.75);
  const [serif, setSerif] = useState(true);
  const [preset, setPreset] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [readerSkin, setReaderSkin] = useState<ReaderSkinId>(() => loadReaderSkin());

  /** Keep URL in WeDevote shape: /app/bible/{tid}/{book}/{chapter} */
  const goToPassage = useCallback(
    (tid: string, nextBookId: string, nextChapter: number, replace = false) => {
      const book = getBook(nextBookId);
      const capped = Math.min(Math.max(1, nextChapter), book?.chapters ?? 1);
      const path = `/app/bible/${tid}/${bookSlug(nextBookId)}/${capped}`;
      navigate(path, { replace });
      setTranslationId(tid);
      setBookId(nextBookId);
      setChapterNum(capped);
    },
    [navigate],
  );

  useEffect(() => {
    const book = getBook(routeBookId);
    const capped = Math.min(routeChapter, book?.chapters ?? 1);
    if (
      routeTid !== translationId ||
      routeBookId !== bookId ||
      capped !== chapterNum
    ) {
      setTranslationId(routeTid);
      setBookId(routeBookId);
      setChapterNum(capped);
    }
    // Normalize incomplete URLs once.
    if (!params.tid || !params.bookSlug || !params.chapter || capped !== routeChapter) {
      goToPassage(routeTid, routeBookId, capped, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from route params only
  }, [routeTid, routeBookId, routeChapter, params.tid, params.bookSlug, params.chapter]);

  const prevCursor = useMemo(
    () => adjacentChapter(bookId, chapterNum, -1),
    [bookId, chapterNum],
  );
  const nextCursor = useMemo(
    () => adjacentChapter(bookId, chapterNum, 1),
    [bookId, chapterNum],
  );

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
  const [showCatalog, setShowCatalog] = useState(false);
  const [installedByTid, setInstalledByTid] = useState<
    Record<string, InstalledTranslationSummary>
  >({});
  const [downloadingTid, setDownloadingTid] = useState<string | null>(null);
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
  const corpusCatalog = useMemo(() => listDownloadableCorpusCatalog(), []);
  const readerFont = serif ? "var(--lh-font-reader)" : "var(--lh-font-ui)";

  const refreshInstalledCorpus = useCallback(async () => {
    try {
      const rows = await bibleLocalDb.listInstalled();
      const map: Record<string, InstalledTranslationSummary> = {};
      for (const row of rows) map[row.translationId] = row;
      setInstalledByTid(map);
    } catch {
      setInstalledByTid({});
    }
  }, []);

  useEffect(() => {
    if (!showCatalog) return;
    void refreshInstalledCorpus();
  }, [showCatalog, refreshInstalledCorpus]);

  useEffect(() => {
    void ensureBootCorpusSeeded(async (tid) => {
      try {
        // Boot = whole-Bible pack for 和合本 / NASB (not chapter subsets).
        const pack = await api<{
          chapters: { book: string; chapter: number; verses: { verse: number; text: string }[] }[];
          source?: string;
        }>(`/v1/bible/corpus-download/${encodeURIComponent(tid)}?scope=full`);
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

  /** Download whole-Bible translation pack → IndexedDB (one install unit, not chapter UX). */
  async function downloadCorpusPack(targetTid = translationId) {
    try {
      setError(null);
      setDownloadingTid(targetTid);
      // Prefer a single whole-Bible response; fall back to paging only for large R2 prefixes.
      let after: string | null = null;
      let installedTotal = 0;
      let pages = 0;
      for (;;) {
        const qs = new URLSearchParams({ scope: "full" });
        // Optional transport paging — product still installs as one whole-Bible pack.
        if (pages > 0 || after) qs.set("limit", "200");
        if (after) qs.set("after", after);
        const pack = await api<{
          translationId: string;
          chapters: { book: string; chapter: number; verses: { verse: number; text: string }[] }[];
          source?: string;
          done?: boolean;
          nextAfter?: string | null;
          totalChapterKeys?: number;
          packKind?: string;
          error?: string;
        }>(`/v1/bible/corpus-download/${encodeURIComponent(targetTid)}?${qs.toString()}`);
        if (!pack.chapters?.length && pages === 0) {
          setError("corpus_download_empty");
          return;
        }
        if (pack.chapters?.length) {
          const { installed } = await installDownloadedPack(targetTid, pack.chapters);
          installedTotal += installed;
        }
        pages += 1;
        setNoteMsg(
          `corpus_installed:${installedTotal}${pack.totalChapterKeys ? `/${pack.totalChapterKeys}` : ""}`,
        );
        if (pack.done !== false || !pack.nextAfter) break;
        after = pack.nextAfter;
      }
      await refreshInstalledCorpus();
      if (targetTid === translationId) {
        setCorpusHint(`${t("reader.corpusLocalDb")} · ${installedTotal}`);
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setDownloadingTid(null);
    }
  }

  function catalogModeLabel(mode: DownloadableCorpusPack["installMode"]): string {
    if (mode === "boot") return t("reader.corpusCatalogBoot");
    if (mode === "download") return t("reader.corpusCatalogDownload");
    return t("reader.corpusCatalogExternal");
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

  const activeTranslation = translations.find((tr) => tr.id === translationId);
  const passageTitle = `${currentBook?.name[bookNameLocale] ?? bookId} ${chapterNum}`;
  const prevShort = prevCursor
    ? `${getBook(prevCursor.bookId)?.name[bookNameLocale] ?? prevCursor.bookId} ${prevCursor.chapter}`
    : null;
  const nextShort = nextCursor
    ? `${getBook(nextCursor.bookId)?.name[bookNameLocale] ?? nextCursor.bookId} ${nextCursor.chapter}`
    : null;

  const renderChapterNav = (testPrefix: string, placement: "top" | "bottom") => (
    <nav className={`bible-chapter-nav bible-chapter-nav--${placement}`} aria-label="Chapter">
      {prevCursor ? (
        <Link
          className="bible-nav-link"
          data-testid={`${testPrefix}-prev-chapter`}
          to={`/app/bible/${translationId}/${bookSlug(prevCursor.bookId)}/${prevCursor.chapter}`}
          onClick={(e) => {
            e.preventDefault();
            goToPassage(translationId, prevCursor.bookId, prevCursor.chapter);
          }}
        >
          <span className="bible-nav-dir">← {t("reader.prevChapter")}</span>
          <span className="bible-nav-target">{prevShort}</span>
        </Link>
      ) : (
        <span className="bible-nav-link is-disabled">{t("reader.prevChapter")}</span>
      )}
      {nextCursor ? (
        <Link
          className="bible-nav-link bible-nav-link--next"
          data-testid={`${testPrefix}-next-chapter`}
          to={`/app/bible/${translationId}/${bookSlug(nextCursor.bookId)}/${nextCursor.chapter}`}
          onClick={(e) => {
            e.preventDefault();
            goToPassage(translationId, nextCursor.bookId, nextCursor.chapter);
          }}
        >
          <span className="bible-nav-dir">{t("reader.nextChapter")} →</span>
          <span className="bible-nav-target">{nextShort}</span>
        </Link>
      ) : (
        <span className="bible-nav-link is-disabled">{t("reader.nextChapter")}</span>
      )}
    </nav>
  );

  return (
    <section className="bible-reader" data-testid="bible-reader">
      {/* Primary composition: passage chrome + continuous prose only */}
      <header className="bible-reader-masthead">
        <p className="bible-reader-translation" data-testid="reader-translation-label">
          {activeTranslation?.name[locale] ?? translationId}
        </p>
        <h1 className="bible-reader-title" data-testid="reader-passage-title">
          {passageTitle}
        </h1>
        {renderChapterNav("reader", "top")}
        <div className="bible-passage-controls" data-testid="reader-passage-controls">
          <label className="bible-control">
            <span className="sr-only">{t("reader.translations")}</span>
            <select
              value={translationId}
              onChange={(e) => goToPassage(e.target.value, bookId, chapterNum)}
              aria-label={t("reader.translations")}
            >
              {translations.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name[locale] ?? tr.abbreviation}
                </option>
              ))}
            </select>
          </label>
          <label className="bible-control">
            <span className="sr-only">Book</span>
            <select
              value={bookId}
              onChange={(e) => goToPassage(translationId, e.target.value, 1)}
              aria-label="Book"
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name[bookNameLocale]}
                </option>
              ))}
            </select>
          </label>
          <label className="bible-control bible-control--chapter">
            <span className="sr-only">Chapter</span>
            <select
              value={chapterNum}
              onChange={(e) => goToPassage(translationId, bookId, Number(e.target.value))}
              aria-label="Chapter"
            >
              {chapterOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error && <p className="bible-reader-error">{humanizeStatus(t, error)}</p>}

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

      {renderChapterNav("reader-bottom", "bottom")}

      {/* Secondary tools — never compete with the reading plane */}
      <details className="bible-more" open={showCatalog || selectedVerse != null || dualPane}>
        <summary>{t("reader.moreTools")}</summary>
        <div className="bible-more-body">
          <div className="bible-more-actions">
            <button type="button" className={`bible-text-btn${dualPane ? " is-on" : ""}`} onClick={() => setDualPane((d) => !d)}>
              {t("reader.dual")}
            </button>
            <button type="button" className="bible-text-btn" onClick={() => void addBookmark()}>
              {t("reader.bookmark")}
            </button>
            <button type="button" className="bible-text-btn" onClick={() => void grantEntitlement()}>
              {t("reader.entitlement")}
            </button>
            <button
              type="button"
              className="bible-text-btn"
              data-testid="reader-corpus-download"
              disabled={downloadingTid === translationId}
              onClick={() => void downloadCorpusPack()}
            >
              {downloadingTid === translationId
                ? t("reader.corpusCatalogDownloading")
                : t("reader.corpusDownloadFull")}
            </button>
            <button
              type="button"
              className={`bible-text-btn${showCatalog ? " is-on" : ""}`}
              data-testid="reader-corpus-catalog-toggle"
              onClick={() => setShowCatalog((v) => !v)}
            >
              {t("reader.corpusCatalog")}
            </button>
          </div>
          {corpusHint ? (
            <p className="bible-hint" data-testid="reader-corpus-hint">
              {corpusHint} · {t("reader.wholeBiblePack")}
            </p>
          ) : null}

          {showCatalog ? (
            <div className="bible-catalog" data-testid="reader-corpus-catalog">
              <p className="bible-hint">{t("reader.corpusCatalogHint")}</p>
              <ul className="bible-catalog-list">
                {corpusCatalog.map((pack) => {
                  const installed = installedByTid[pack.translationId];
                  const busy = downloadingTid === pack.translationId;
                  const active = pack.translationId === translationId;
                  return (
                    <li key={pack.translationId} data-testid={`corpus-catalog-row-${pack.translationId}`}>
                      <div className="bible-catalog-row">
                        <div>
                          <strong>
                            {pack.name[locale] ?? pack.translationId}
                            {active ? " · ★" : ""}
                          </strong>
                          <p className="bible-hint">
                            {catalogModeLabel(pack.installMode)}
                            {pack.installMode !== "external" ? ` · ${t("reader.wholeBiblePack")}` : ""}
                            {installed ? ` · ${t("reader.corpusCatalogInstalled")} ${installed.chapterCount}` : ""}
                          </p>
                        </div>
                        <div className="bible-more-actions">
                          {pack.installMode !== "external" ? (
                            <button
                              type="button"
                              className="bible-text-btn"
                              data-testid={`corpus-catalog-download-${pack.translationId}`}
                              disabled={busy}
                              onClick={() => void downloadCorpusPack(pack.translationId)}
                            >
                              {busy ? t("reader.corpusCatalogDownloading") : t("reader.corpusDownloadFull")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="bible-text-btn"
                            data-testid={`corpus-catalog-open-${pack.translationId}`}
                            onClick={() => {
                              goToPassage(pack.translationId, bookId, chapterNum);
                              setShowCatalog(false);
                            }}
                          >
                            {t("reader.corpusCatalogOpen")}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="bible-type-row">
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
                className={`bible-text-btn${preset === id ? " is-on" : ""}`}
                onClick={() => applyPreset(id)}
              >
                {t(key)}
              </button>
            ))}
            <button type="button" className="bible-text-btn" onClick={() => setFontSize((s) => Math.min(1.8, s + 0.1))}>
              A+
            </button>
            <button type="button" className="bible-text-btn" onClick={() => setFontSize((s) => Math.max(0.9, s - 0.1))}>
              A-
            </button>
            <label className="bible-control">
              <span className="sr-only">{t("reader.skin")}</span>
              <select
                data-testid="reader-skin"
                value={readerSkin}
                onChange={(e) => setReaderSkin(e.target.value as ReaderSkinId)}
                aria-label={t("reader.skin")}
              >
                {READER_SKIN_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(`reader.skin.${id}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {dualPane && (
            <label className="bible-control">
              <span className="sr-only">{`${t("reader.translations")} 2`}</span>
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
            </label>
          )}

          <div className="bible-highlight-row" aria-label={t("reader.highlight")}>
            <span>{t("reader.highlight")}</span>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="bible-swatch"
                style={{ background: c.value }}
                aria-label={`${t("reader.highlight")} ${c.id}`}
                onClick={() => void addHighlight(c.id)}
              />
            ))}
          </div>

          {selectedVerse != null && (
            <div className="bible-note-compose">
              <h2>
                {t("reader.note")} · {bookId} {chapterNum}:{selectedVerse}
              </h2>
              <textarea
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t("reader.note")}
              />
              <button type="button" className="bible-text-btn is-on" onClick={() => void saveNote()}>
                {t("reader.saveNote")}
              </button>
              {noteMsg && <p className="bible-hint">{humanizeStatus(t, noteMsg)}</p>}
            </div>
          )}

          <div className="bible-side-block">
            <h2>{t("reader.bookmark")}</h2>
            <ul>
              {bookmarks.length === 0 && <li className="bible-hint">—</li>}
              {bookmarks.map((b) => (
                <li key={b.id}>{b.label}</li>
              ))}
            </ul>
          </div>

          <div className="bible-side-block">
            <h2>{t("reader.notesPanel")}</h2>
            <ul>
              {decryptedNotes.length === 0 && <li className="bible-hint">{t("reader.noNotes")}</li>}
              {decryptedNotes.map((n) => (
                <li key={n.id}>
                  <strong>{n.label}</strong>
                  <p>{n.text}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="bible-side-block">
            <h2>{t("reader.study")}</h2>
            <ul>
              {studyMaterials.map((m) => (
                <li key={m.id}>
                  <a href={m.url} target="_blank" rel="noreferrer">
                    {m.title}
                  </a>
                  <span className="bible-hint"> · {m.license}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}
