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
  listTranslations,
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
  densifyChapterVerses,
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
    .replace(/[（(]\s*样例[^）)]*[）)]/gi, "")
    .replace(/[（(]\s*fixture[^）)]*[）)]/gi, "")
    .replace(/[（(]\s*見本[^）)]*[）)]/g, "")
    .replace(/[（(]\s*サンプル[^）)]*[）)]/g, "")
    .replace(/\s*\(local-db(?:\s+demo)?\)\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type VerseRange = { start: number; end: number };

function normalizeRange(a: number, b: number): VerseRange {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

function rangeIncludes(range: VerseRange | null, verse: number): boolean {
  return Boolean(range && verse >= range.start && verse <= range.end);
}

function ChapterPane({
  chapter,
  verseRef,
  fontSize,
  lineHeight,
  fontFamily,
  locale,
  t,
  selection,
  onSelectVerse,
  onExtendSelection,
  highlightByVerse,
}: {
  chapter: ChapterPayload | null;
  verseRef: string;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  locale: "zh-CN" | "en" | "ja";
  t: (key: string) => string;
  selection: VerseRange | null;
  onSelectVerse: (verse: number) => void;
  onExtendSelection: (verse: number) => void;
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
      <div
        className="bible-prose-body"
        onPointerUp={() => {
          /* drag end handled per-verse */
        }}
      >
        <span className="chapter-lead" aria-hidden="true">
          {chapter.chapter}
        </span>
        {chapter.verses.map((v) => {
          const hl = highlightByVerse?.[v.verse];
          const selected = rangeIncludes(selection, v.verse);
          return (
            <span
              className={`verse-inline${selected ? " verse-selected" : ""}${hl ? " verse-highlighted" : ""}`}
              key={v.verse}
              style={hl ? { backgroundColor: hl } : undefined}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                onSelectVerse(v.verse);
              }}
              onPointerEnter={(e) => {
                if (e.buttons === 1) onExtendSelection(v.verse);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectVerse(v.verse);
              }}
              role="button"
              tabIndex={0}
              data-verse={v.verse}
              data-selected={selected ? "1" : "0"}
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
  const [fontSize, setFontSize] = useState(1.34);
  const [lineHeight, setLineHeight] = useState(2.18);
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
    compact: { fontSize: 1.1, lineHeight: 1.7, serif: false },
    comfortable: { fontSize: 1.34, lineHeight: 2.18, serif: true },
    spacious: { fontSize: 1.48, lineHeight: 2.35, serif: true },
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
  const [selection, setSelection] = useState<VerseRange | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dragAnchor = useMemo(() => ({ current: null as number | null }), []);
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
  const corpusCatalog = useMemo(() => listDownloadableCorpusCatalog(), []);
  const readerFont = serif ? "var(--br-font-reader)" : "var(--br-font-ui)";

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

  const [bootTick, setBootTick] = useState(0);

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
    }).then(() => setBootTick((n) => n + 1));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        // Prefer client local DB (download/boot install) over network/TS scaffolds.
        const local = await readLocalChapter(translationId, bookId, chapterNum);
        if (local && !cancelled) {
          const verses = densifyChapterVerses(
            translationId,
            local.book,
            local.chapter,
            local.verses,
          );
          setChapter({
            translationId,
            book: local.book,
            chapter: local.chapter,
            verses,
            source: "local-db",
          });
          return;
        }
        const data = await api<ChapterPayload>(
          `/v1/bible/chapter?translation=${encodeURIComponent(translationId)}&ref=${encodeURIComponent(ref)}`,
        );
        if (cancelled) return;
        if (data && "verses" in data && Array.isArray(data.verses)) {
          setChapter({
            ...data,
            verses: densifyChapterVerses(translationId, bookId, chapterNum, data.verses),
          });
        } else {
          setChapter(data);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [translationId, ref, bookId, chapterNum, bootTick]);

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
          const color = colorMap[raw] ?? (raw.startsWith("#") ? raw : "#f5d76e");
          const end = row.verseEnd ?? row.verseStart;
          for (let v = row.verseStart; v <= end; v += 1) highlights[v] = color;
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

  function selectVerse(verse: number) {
    dragAnchor.current = verse;
    setSelection({ start: verse, end: verse });
  }

  function extendSelection(verse: number) {
    const anchor = dragAnchor.current ?? verse;
    setSelection(normalizeRange(anchor, verse));
  }

  async function addBookmark(verseOverride?: number) {
    if (!getToken()) {
      setError("login_required");
      return;
    }
    const verse = verseOverride ?? selection?.start ?? 1;
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
    setNoteMsg("bookmark_ok");
    await refreshNotes();
  }

  async function addHighlight(color: string) {
    if (!getToken()) {
      setError("login_required");
      return;
    }
    const range = selection ?? { start: 1, end: 1 };
    const colorMap: Record<string, string> = {
      amber: "#f5d76e",
      mint: "#a8e6cf",
      rose: "#f8b4c4",
      sky: "#a8d8ea",
    };
    const { ciphertext, iv } = await encryptJson(
      { kind: "highlight", color, verseStart: range.start, verseEnd: range.end },
      "highlight",
    );
    await api("/v1/annotations", {
      method: "POST",
      body: JSON.stringify({
        translationId,
        ref: {
          book: bookId,
          chapter: chapterNum,
          verseStart: range.start,
          verseEnd: range.end,
        },
        kind: "highlight",
        color,
        ciphertext,
        iv,
      }),
    });
    setHighlightByVerse((prev) => {
      const next = { ...prev };
      for (let v = range.start; v <= range.end; v += 1) {
        next[v] = colorMap[color] ?? color;
      }
      return next;
    });
    await refreshNotes();
  }

  async function saveNote() {
    if (!getToken()) {
      setError("login_required");
      return;
    }
    if (selection == null || !noteText.trim()) return;
    const verse = selection.start;
    const { ciphertext, iv } = await encryptJson({ text: noteText.trim() }, "note");
    await api("/v1/annotations", {
      method: "POST",
      body: JSON.stringify({
        translationId,
        ref: {
          book: bookId,
          chapter: chapterNum,
          verseStart: verse,
          verseEnd: selection.end,
        },
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
          {placement === "top" ? (
            <span className="bible-nav-target">← {prevShort}</span>
          ) : (
            <>
              <span className="bible-nav-dir">← {t("reader.prevChapter")}</span>
              <span className="bible-nav-target">{prevShort}</span>
            </>
          )}
        </Link>
      ) : (
        <span className="bible-nav-link is-disabled">
          {placement === "top" ? "←" : `← ${t("reader.prevChapter")}`}
        </span>
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
          {placement === "top" ? (
            <span className="bible-nav-target">{nextShort} →</span>
          ) : (
            <>
              <span className="bible-nav-dir">{t("reader.nextChapter")} →</span>
              <span className="bible-nav-target">{nextShort}</span>
            </>
          )}
        </Link>
      ) : (
        <span className="bible-nav-link is-disabled bible-nav-link--next">
          {placement === "top" ? "→" : `${t("reader.nextChapter")} →`}
        </span>
      )}
    </nav>
  );

  const selectionLabel =
    selection == null
      ? null
      : selection.start === selection.end
        ? `${passageTitle}:${selection.start}`
        : `${passageTitle}:${selection.start}–${selection.end}`;

  return (
    <section className="bible-reader" data-testid="bible-reader">
      <header className="bible-reader-topbar">
        <div className="bible-reader-topbar-main">
          <h1 className="bible-reader-title" data-testid="reader-passage-title">
            {passageTitle}
          </h1>
          <p className="bible-reader-tid" data-testid="reader-translation-label">
            {activeTranslation?.name[locale] ?? translationId}
          </p>
        </div>
        <div className="bible-reader-topbar-actions">
          <div className="bible-passage-controls" data-testid="reader-passage-controls">
            <label className="bible-control">
              <span className="sr-only">{t("reader.book")}</span>
              <select
                value={bookId}
                onChange={(e) => goToPassage(translationId, e.target.value, 1)}
                aria-label={t("reader.book")}
                data-testid="reader-book-select"
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name[bookNameLocale]}
                  </option>
                ))}
              </select>
            </label>
            <label className="bible-control bible-control--chapter">
              <span className="sr-only">{t("reader.chapter")}</span>
              <select
                value={chapterNum}
                onChange={(e) => goToPassage(translationId, bookId, Number(e.target.value))}
                aria-label={t("reader.chapter")}
                data-testid="reader-chapter-select"
              >
                {chapterOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className={`bible-gear-btn${settingsOpen ? " is-on" : ""}`}
            data-testid="reader-settings-gear"
            aria-label={t("reader.gear")}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.48.41l-.36 2.54c-.59.23-1.13.55-1.63.94l-2.39-.96a.49.49 0 0 0-.59.22L2.63 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.75 14.52a.49.49 0 0 0-.12.61l1.92 3.32c.13.22.4.31.62.22l2.39-.96c.5.39 1.04.71 1.63.94l.36 2.54c.05.24.25.41.49.41h4c.24 0 .44-.17.49-.41l.36-2.54c.59-.23 1.13-.55 1.63-.94l2.39.96c.22.09.49 0 .62-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
              />
            </svg>
          </button>
        </div>
      </header>

      {error && <p className="bible-reader-error">{humanizeStatus(t, error)}</p>}

      {settingsOpen && (
        <div className="bible-settings-sheet" data-testid="reader-settings-sheet" role="dialog" aria-label={t("reader.settings")}>
          <div className="bible-settings-row">
            <span>{t("reader.translations")}</span>
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
          </div>
          <div className="bible-settings-row">
            <span>{t("reader.colorTheme")}</span>
            <select
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
          <div className="bible-settings-row">
            <span>{t("reader.fontFamily")}</span>
            <div className="bible-more-actions">
              <button type="button" className={`bible-text-btn${serif ? " is-on" : ""}`} onClick={() => setSerif(true)}>
                {t("reader.serif")}
              </button>
              <button type="button" className={`bible-text-btn${!serif ? " is-on" : ""}`} onClick={() => setSerif(false)}>
                {t("reader.sans")}
              </button>
            </div>
          </div>
          <div className="bible-settings-row">
            <span>{t("reader.fontSize")}</span>
            <div className="bible-more-actions">
              <button type="button" className="bible-text-btn" onClick={() => setFontSize((s) => Math.max(0.9, +(s - 0.08).toFixed(2)))}>
                A−
              </button>
              <span className="bible-hint">{fontSize.toFixed(2)}</span>
              <button type="button" className="bible-text-btn" onClick={() => setFontSize((s) => Math.min(1.8, +(s + 0.08).toFixed(2)))}>
                A+
              </button>
            </div>
          </div>
          <div className="bible-settings-row">
            <span>{t("reader.lineHeight")}</span>
            <input
              type="range"
              min={1.5}
              max={2.6}
              step={0.05}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              aria-label={t("reader.lineHeight")}
            />
          </div>
          <div className="bible-settings-row">
            <span>{t("reader.layout")}</span>
            <div className="bible-more-actions">
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
            </div>
          </div>
          <div className="bible-settings-row">
            <button
              type="button"
              className={`bible-text-btn${dualPane ? " is-on" : ""}`}
              onClick={() => setDualPane((d) => !d)}
            >
              {t("reader.dual")}
            </button>
            {dualPane && (
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
            )}
          </div>
          <div className="bible-settings-row">
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
            <button type="button" className="bible-text-btn" onClick={() => void grantEntitlement()}>
              {t("reader.entitlement")}
            </button>
          </div>
          {corpusHint ? (
            <p className="bible-hint" data-testid="reader-corpus-hint">
              {corpusHint}
            </p>
          ) : null}
          {showCatalog ? (
            <div className="bible-catalog" data-testid="reader-corpus-catalog">
              <ul className="bible-catalog-list">
                {corpusCatalog.map((pack) => {
                  const installed = installedByTid[pack.translationId];
                  const busy = downloadingTid === pack.translationId;
                  return (
                    <li key={pack.translationId} data-testid={`corpus-catalog-row-${pack.translationId}`}>
                      <div className="bible-catalog-row">
                        <strong>{pack.name[locale] ?? pack.translationId}</strong>
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
                              setSettingsOpen(false);
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
        </div>
      )}

      <div className="bible-folio" data-testid="reader-folio">
        <div className={dualPane ? "reader-dual" : undefined}>
          <ChapterPane
            chapter={chapter}
            verseRef={ref}
            fontSize={fontSize}
            lineHeight={lineHeight}
            fontFamily={readerFont}
            locale={locale}
            t={t}
            selection={selection}
            onSelectVerse={selectVerse}
            onExtendSelection={extendSelection}
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
              selection={selection}
              onSelectVerse={selectVerse}
              onExtendSelection={extendSelection}
              highlightByVerse={highlightByVerse}
            />
          )}
        </div>
      </div>

      {renderChapterNav("reader-bottom", "bottom")}

      {selection && (
        <div className="bible-selection-bar" data-testid="reader-selection-bar" role="toolbar">
          <span className="bible-hint">{selectionLabel}</span>
          <div className="bible-highlight-row" aria-label={t("reader.highlight")}>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="bible-swatch"
                style={{ background: c.value }}
                aria-label={`${t("reader.selectionHighlight")} ${c.id}`}
                data-testid={`reader-highlight-${c.id}`}
                onClick={() => void addHighlight(c.id)}
              />
            ))}
          </div>
          <button
            type="button"
            className="bible-dock-btn"
            data-testid="reader-dock-bookmark"
            onClick={() => void addBookmark()}
          >
            {t("reader.bookmark")}
          </button>
          <button
            type="button"
            className="bible-dock-btn"
            data-testid="reader-bookmark-chapter"
            onClick={() => void addBookmark(1)}
          >
            {t("reader.bookmarkChapter")}
          </button>
          <button type="button" className="bible-dock-btn" onClick={() => setSelection(null)}>
            {t("reader.clearSelection")}
          </button>
        </div>
      )}

      {!selection && (
        <div className="bible-reading-dock" data-testid="reader-dock" role="toolbar" aria-label={t("reader.gear")}>
          <button
            type="button"
            className="bible-dock-btn"
            data-testid="reader-dock-bookmark"
            onClick={() => void addBookmark(1)}
          >
            {t("reader.bookmarkChapter")}
          </button>
          <span className="bible-dock-sep" aria-hidden="true" />
          <button
            type="button"
            className={`bible-dock-btn${settingsOpen ? " is-on" : ""}`}
            data-testid="reader-dock-tools"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            {t("reader.gear")}
          </button>
        </div>
      )}

      {selection && (
        <div className="bible-note-compose bible-note-compose--float">
          <h2>
            {t("reader.note")} · {selectionLabel}
          </h2>
          <textarea
            rows={2}
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

      {(bookmarks.length > 0 || decryptedNotes.length > 0) && (
        <div className="bible-more-body" style={{ marginTop: "1.25rem" }}>
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
        </div>
      )}
    </section>
  );
}
