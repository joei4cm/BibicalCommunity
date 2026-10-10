import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  STUDY_COMMENTARIES,
  commentaryDisplayName,
  defaultStudyCommentaryId,
  fetchCommentaryChapter,
  fetchCrossRefs,
  entriesForVerse,
  loadStrongsDictionary,
  loadVerseStrongs,
  loadEastonDictionary,
  searchStrongs,
  searchEaston,
  strongsForVerse,
  type CommentaryEntry,
  type CrossRefHit,
  type EastonDictionary,
  type EastonHit,
  type StudyCommentaryId,
  type StrongsDictionary,
  type StrongsEntry,
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
  fontSizePtToRem,
  fontStackFor,
  fontsByGroup,
  loadReaderFontId,
  loadReaderFontSizePt,
  READER_FONT_SIZES_PT,
  saveReaderFontId,
  saveReaderFontSizePt,
  type ReaderFontId,
  type ReaderFontSizePt,
} from "../lib/reader-fonts";
import {
  bibleLocalDb,
  densifyChapterVerses,
  ensureBootCorpusSeeded,
  installDownloadedPack,
  readLocalChapter,
} from "../lib/bible-local-db";

type DockPanel = "note" | "study" | "search" | "speak" | null;
type StudyTab = "commentary" | "dict" | "crossrefs";

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

function verseMapFromChapter(chapter: ChapterPayload | null): Map<number, string> {
  const map = new Map<number, string>();
  if (!chapter || "external" in chapter) return map;
  for (const v of chapter.verses) map.set(v.verse, v.text);
  return map;
}

/** Verse-stacked compare: same verse number, primary + peer lines. */
function CompareChapterPane({
  primary,
  peer,
  primaryAbbr,
  peerAbbr,
  fontSize,
  lineHeight,
  fontFamily,
  selection,
  onSelectVerse,
  onExtendSelection,
  highlightByVerse,
}: {
  primary: ChapterPayload | null;
  peer: ChapterPayload | null;
  primaryAbbr: string;
  peerAbbr: string;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  selection: VerseRange | null;
  onSelectVerse: (verse: number) => void;
  onExtendSelection: (verse: number) => void;
  highlightByVerse?: Record<number, string>;
}) {
  if (!primary || "external" in primary) {
    return <p className="muted">…</p>;
  }
  const peerMap = verseMapFromChapter(peer);
  return (
    <article
      className="bible-chapter bible-chapter--compare"
      style={{ fontSize: `${fontSize}rem`, lineHeight, fontFamily }}
      data-testid="reader-compare-pane"
    >
      {primary.verses.map((v) => {
        const selected = rangeIncludes(selection, v.verse);
        const hl = highlightByVerse?.[v.verse];
        const peerText = peerMap.get(v.verse);
        return (
          <div
            key={v.verse}
            className={`compare-verse${selected ? " verse-selected" : ""}${hl ? " verse-highlighted" : ""}`}
            style={hl ? { background: hl } : undefined}
            data-verse={v.verse}
            role="button"
            tabIndex={0}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              onSelectVerse(v.verse);
            }}
            onPointerEnter={(e) => {
              if (e.buttons === 1) onExtendSelection(v.verse);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectVerse(v.verse);
              }
            }}
          >
            <sup className="verse-num">{v.verse}</sup>
            <div className="compare-verse-stack">
              <p className="compare-line">
                <span className="compare-abbr">{primaryAbbr}</span>
                <span className="compare-text">{displayVerseText(v.text)}</span>
              </p>
              {peerText != null && (
                <p className="compare-line compare-line--peer">
                  <span className="compare-abbr">{peerAbbr}</span>
                  <span className="compare-text">{displayVerseText(peerText)}</span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </article>
  );
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
              onPointerUp={() => {
                /* release drag anchor after gesture */
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
  const [searchParams] = useSearchParams();
  const books = useMemo(() => listBooks(), []);
  const routeTid = params.tid && listTranslations().some((tr) => tr.id === params.tid) ? params.tid : "cuvs";
  const routeBookId = bookIdFromSlug(params.bookSlug ?? "john") ?? "John";
  const routeChapter = Math.max(1, Number(params.chapter ?? "1") || 1);
  const routeVerse = (() => {
    const raw = searchParams.get("verse");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  })();

  const [translationId, setTranslationId] = useState(routeTid);
  const [secondTranslationId, setSecondTranslationId] = useState("web");
  const [dualPane, setDualPane] = useState(false);
  const [tidPickerOpen, setTidPickerOpen] = useState(false);
  const [bookId, setBookId] = useState(routeBookId);
  const [chapterNum, setChapterNum] = useState(routeChapter);
  const [fontSizePt, setFontSizePt] = useState<ReaderFontSizePt>(() => loadReaderFontSizePt());
  const [lineHeight, setLineHeight] = useState(2.18);
  const [fontId, setFontId] = useState<ReaderFontId>(() => loadReaderFontId());
  const [preset, setPreset] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [readerSkin, setReaderSkin] = useState<ReaderSkinId>(() => loadReaderSkin());
  const [dockPanel, setDockPanel] = useState<DockPanel>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [speakNote, setSpeakNote] = useState<string | null>(null);
  const [studyTab, setStudyTab] = useState<StudyTab>("commentary");
  const [studyCommentaryId, setStudyCommentaryId] = useState<StudyCommentaryId>("mhcc-zh");
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState<string | null>(null);
  const [studyEntries, setStudyEntries] = useState<CommentaryEntry[]>([]);
  const [studyCrossRefs, setStudyCrossRefs] = useState<CrossRefHit[]>([]);
  const [strongsDict, setStrongsDict] = useState<StrongsDictionary | null>(null);
  const [verseStrongsMap, setVerseStrongsMap] = useState<Record<string, string[]> | null>(null);
  const [eastonDict, setEastonDict] = useState<EastonDictionary | null>(null);
  const [dictQuery, setDictQuery] = useState("");
  const [dictFocusId, setDictFocusId] = useState<string | null>(null);
  const [eastonFocus, setEastonFocus] = useState<EastonHit | null>(null);

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
    compact: { fontSizePt: 12 as ReaderFontSizePt, lineHeight: 1.7, fontId: "heiti" as ReaderFontId },
    comfortable: { fontSizePt: 16 as ReaderFontSizePt, lineHeight: 2.18, fontId: "songti" as ReaderFontId },
    spacious: { fontSizePt: 18 as ReaderFontSizePt, lineHeight: 2.35, fontId: "songti" as ReaderFontId },
  } as const;

  function applyPreset(id: keyof typeof TYPO_PRESETS) {
    const p = TYPO_PRESETS[id];
    setPreset(id);
    setFontSizePt(p.fontSizePt);
    saveReaderFontSizePt(p.fontSizePt);
    setLineHeight(p.lineHeight);
    setFontId(p.fontId);
    saveReaderFontId(p.fontId);
  }

  function pickFont(id: ReaderFontId) {
    setFontId(id);
    saveReaderFontId(id);
  }

  function pickFontSize(pt: ReaderFontSizePt) {
    setFontSizePt(pt);
    saveReaderFontSizePt(pt);
  }

  function toggleDock(panel: Exclude<DockPanel, null>) {
    setDockPanel((cur) => (cur === panel ? null : panel));
    setHighlightPaletteOpen(false);
    if ((panel === "note" || panel === "study") && !selection) setSelection({ start: 1, end: 1 });
  }

  function stopSpeech() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakNote(null);
  }

  function speakText(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeakNote("unsupported");
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      setSpeakNote("empty");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(trimmed);
    utter.lang = locale.startsWith("zh") ? "zh-CN" : locale.startsWith("ja") ? "ja-JP" : "en-US";
    utter.rate = 0.95;
    utter.onend = () => setSpeakNote(null);
    utter.onerror = () => setSpeakNote(null);
    setSpeakNote(null);
    window.speechSynthesis.speak(utter);
  }

  function chapterPlainText(): string {
    if (!chapter || "external" in chapter) return "";
    return chapter.verses.map((v) => displayVerseText(v.text)).join(" ");
  }

  function selectionPlainText(): string {
    if (!chapter || "external" in chapter || !selection) return chapterPlainText();
    return chapter.verses
      .filter((v) => v.verse >= selection.start && v.verse <= selection.end)
      .map((v) => displayVerseText(v.text))
      .join(" ");
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
  const [highlightIdByVerse, setHighlightIdByVerse] = useState<Record<number, string>>({});
  const [bookmarks, setBookmarks] = useState<{ id: string; label: string }[]>([]);
  const [corpusHint, setCorpusHint] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [passagePickerOpen, setPassagePickerOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<"book" | "chapter" | "verse">("book");
  const [pickerBookId, setPickerBookId] = useState(routeBookId);
  const [pickerChapter, setPickerChapter] = useState(routeChapter);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [highlightPaletteOpen, setHighlightPaletteOpen] = useState(false);
  const [focusVerse, setFocusVerse] = useState<number | null>(null);
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
  const fontSize = fontSizePtToRem(fontSizePt);
  const readerFont = fontStackFor(fontId);
  const studyLang = bookNameLocale;
  const studyLinks = useMemo(() => listStudyMaterials({ language: studyLang }), [studyLang]);
  useEffect(() => {
    setStudyCommentaryId((cur) => {
      const preferred = defaultStudyCommentaryId(studyLang);
      // Only auto-switch when still on a language-default pick.
      if (cur === "mhcc" || cur === "mhcc-zh") return preferred;
      return cur;
    });
  }, [studyLang]);
  const studyVerse = selection?.start ?? 1;
  const verseDictIds = useMemo(() => {
    if (!verseStrongsMap) return [] as string[];
    return strongsForVerse(verseStrongsMap, bookId, chapterNum, studyVerse);
  }, [verseStrongsMap, bookId, chapterNum, studyVerse]);
  const verseDictEntries = useMemo(() => {
    const dict = strongsDict;
    if (!dict) return [] as Array<{ id: string; entry: StrongsEntry }>;
    return verseDictIds
      .map((id) => {
        const entry = dict[id];
        return entry ? { id, entry } : null;
      })
      .filter((x): x is { id: string; entry: StrongsEntry } => Boolean(x));
  }, [strongsDict, verseDictIds]);
  const dictSearchHits = useMemo(() => {
    if (!dictQuery.trim()) return [] as Array<{ id: string; entry: StrongsEntry }>;
    return searchStrongs(dictQuery, strongsDict ?? undefined, 20);
  }, [dictQuery, strongsDict]);
  const eastonSearchHits = useMemo(() => {
    if (!dictQuery.trim() || !eastonDict) return [] as EastonHit[];
    return searchEaston(dictQuery, eastonDict, 12);
  }, [dictQuery, eastonDict]);
  const dictFocusEntry = useMemo(() => {
    if (!dictFocusId || !strongsDict) return null;
    const entry = strongsDict[dictFocusId];
    return entry ? { id: dictFocusId, entry } : null;
  }, [dictFocusId, strongsDict]);

  useEffect(() => {
    if (dockPanel !== "study") return;
    let cancelled = false;
    void (async () => {
      setStudyLoading(true);
      setStudyError(null);
      try {
        if (studyTab === "commentary") {
          const chapter = await fetchCommentaryChapter(studyCommentaryId, bookId, chapterNum);
          if (cancelled) return;
          setStudyEntries(entriesForVerse(chapter, studyVerse));
        } else if (studyTab === "crossrefs") {
          const refs = await fetchCrossRefs(bookId, chapterNum, studyVerse);
          if (cancelled) return;
          setStudyCrossRefs(refs);
        } else {
          const [dict, verseMap, easton] = await Promise.all([
            loadStrongsDictionary(),
            loadVerseStrongs(),
            loadEastonDictionary(),
          ]);
          if (cancelled) return;
          setStrongsDict(dict);
          setVerseStrongsMap(verseMap);
          setEastonDict(easton);
        }
      } catch {
        if (!cancelled) setStudyError("load");
      } finally {
        if (!cancelled) setStudyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dockPanel, studyTab, studyCommentaryId, bookId, chapterNum, studyVerse]);

  const chapterNotes = useMemo(
    () =>
      decryptedNotes.filter((n) => {
        const m = n.label.match(/:(\d+)/);
        if (!m) return true;
        return true;
      }),
    [decryptedNotes],
  );
  const searchHits = useMemo(() => {
    if (!chapter || "external" in chapter) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return chapter.verses.filter((v) => displayVerseText(v.text).toLowerCase().includes(q));
  }, [chapter, searchQuery]);

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
        try {
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
        } catch (netErr) {
          // Licensed R2 / missing corpus must not block book/chapter navigation.
          const demo = densifyChapterVerses(translationId, bookId, chapterNum, []);
          if (demo.length > 0) {
            if (!cancelled) {
              setChapter({
                translationId,
                book: bookId,
                chapter: chapterNum,
                verses: demo,
                source: "local-demo",
              });
              setError(null);
            }
            return;
          }
          throw netErr;
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
        const local = await readLocalChapter(secondTranslationId, bookId, chapterNum);
        if (local && local.verses.length > 0) {
          if (!cancelled) {
            setSecondChapter({
              translationId: secondTranslationId,
              book: bookId,
              chapter: chapterNum,
              verses: densifyChapterVerses(secondTranslationId, bookId, chapterNum, local.verses),
              source: "local",
            });
          }
          return;
        }
        const data = await api<ChapterPayload>(
          `/v1/bible/chapter?translation=${encodeURIComponent(secondTranslationId)}&ref=${encodeURIComponent(ref)}`,
        );
        if (cancelled) return;
        if ("external" in data) {
          setSecondChapter(null);
          return;
        }
        setSecondChapter({
          ...data,
          verses: densifyChapterVerses(secondTranslationId, bookId, chapterNum, data.verses),
        });
      } catch {
        if (!cancelled) setSecondChapter(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dualPane, secondTranslationId, ref, bookId, chapterNum]);

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
      const highlightIds: Record<number, string> = {};
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
              text: "(无法解密)",
            });
          }
        } else if (row.kind === "highlight" && sameChapter && row.verseStart != null) {
          const raw = row.color ?? "amber";
          const color = colorMap[raw] ?? (raw.startsWith("#") ? raw : "#f5d76e");
          const end = row.verseEnd ?? row.verseStart;
          for (let v = row.verseStart; v <= end; v += 1) {
            highlights[v] = color;
            highlightIds[v] = row.id;
          }
        } else if (row.kind === "bookmark") {
          marks.push({
            id: row.id,
            label: `${row.book} ${row.chapter}:${row.verseStart ?? 1}`,
          });
        }
      }
      setDecryptedNotes(notes);
      setHighlightByVerse(highlights);
      setHighlightIdByVerse(highlightIds);
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
    setHighlightPaletteOpen(false);
    // Keep 研读/搜索/朗读 open so verse picks refresh study tools; close only chrome overlays.
    setDockPanel((cur) => (cur === "note" ? null : cur));
  }

  function extendSelection(verse: number) {
    const anchor = dragAnchor.current ?? verse;
    setSelection(normalizeRange(anchor, verse));
  }

  useEffect(() => {
    const clear = () => {
      dragAnchor.current = null;
    };
    window.addEventListener("pointerup", clear);
    return () => window.removeEventListener("pointerup", clear);
  }, [dragAnchor]);

  async function removeHighlightAt(verse: number) {
    const id = highlightIdByVerse[verse];
    if (!id) return;
    if (!getToken()) {
      setError("login_required");
      return;
    }
    try {
      await api(`/v1/annotations/${encodeURIComponent(id)}`, { method: "DELETE" });
      setHighlightByVerse((prev) => {
        const next = { ...prev };
        delete next[verse];
        return next;
      });
      setHighlightIdByVerse((prev) => {
        const next = { ...prev };
        delete next[verse];
        return next;
      });
      await refreshNotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    }
  }

  useEffect(() => {
    if (routeVerse == null) return;
    setFocusVerse(routeVerse);
  }, [routeTid, routeBookId, routeChapter, routeVerse]);

  useEffect(() => {
    if (focusVerse == null) return;
    // Wait until chapter prose is mounted so ?verse= survives the load race.
    if (!chapter || "external" in chapter || !("verses" in chapter)) return;
    const el = document.querySelector(`[data-testid="reader-prose"] [data-verse="${focusVerse}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      selectVerse(focusVerse);
    } else {
      // Verse absent from this pack — still select so dock/study have a target.
      selectVerse(focusVerse);
    }
    setFocusVerse(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jump once after chapter load
  }, [focusVerse, chapter]);

  const pickerChapterOptions = useMemo(() => {
    const book = getBook(pickerBookId);
    return Array.from({ length: book?.chapters ?? 1 }, (_, i) => i + 1);
  }, [pickerBookId]);

  const pickerVerseOptions = useMemo(() => {
    if (pickerBookId === bookId && pickerChapter === chapterNum && chapter && "verses" in chapter) {
      return chapter.verses.map((v) => v.verse);
    }
    return Array.from({ length: 50 }, (_, i) => i + 1);
  }, [pickerBookId, pickerChapter, bookId, chapterNum, chapter]);

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
    setHighlightPaletteOpen(false);
    setSelection(null);
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
  const peerTranslation = translations.find((tr) => tr.id === secondTranslationId);
  const activeAbbr =
    activeTranslation?.abbreviation || activeTranslation?.name[locale] || translationId;
  const peerAbbr =
    peerTranslation?.abbreviation || peerTranslation?.name[locale] || secondTranslationId;
  const comparePeers = translations.filter((tr) => {
    if (tr.id === translationId) return false;
    if (tr.ssoFlag) return false;
    return true;
  });
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
          onClick={() => {
            setTranslationId(translationId);
            setBookId(prevCursor.bookId);
            setChapterNum(prevCursor.chapter);
            setPassagePickerOpen(false);
            setTidPickerOpen(false);
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
          onClick={() => {
            setTranslationId(translationId);
            setBookId(nextCursor.bookId);
            setChapterNum(nextCursor.chapter);
            setPassagePickerOpen(false);
            setTidPickerOpen(false);
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

  const selectionAlreadyHighlighted =
    selection != null &&
    Array.from({ length: selection.end - selection.start + 1 }, (_, i) => selection.start + i).every(
      (v) => Boolean(highlightIdByVerse[v]),
    );

  function openPassagePicker() {
    setPickerBookId(bookId);
    setPickerChapter(chapterNum);
    setPickerStep("book");
    setPassagePickerOpen(true);
    setLayoutOpen(false);
    setTidPickerOpen(false);
    setSettingsOpen(false);
  }

  return (
    <section className="bible-reader" data-testid="bible-reader">
      <header className="bible-reader-topbar">
        <div className="bible-reader-topbar-main">
          <button
            type="button"
            className="bible-passage-trigger"
            data-testid="reader-passage-title"
            onClick={openPassagePicker}
            aria-label={`${t("reader.book")} ${t("reader.chapter")}`}
          >
            <span className="bible-reader-title">{passageTitle}</span>
            <span className="bible-passage-chevron" aria-hidden="true">
              ▾
            </span>
          </button>
          <p className="sr-only" data-testid="reader-translation-label">
            {activeTranslation?.name[locale] ?? translationId}
          </p>
        </div>
        <div className="bible-reader-topbar-actions" data-testid="reader-passage-controls">
          <button
            type="button"
            className={`bible-tid-btn${tidPickerOpen ? " is-on" : ""}`}
            data-testid="reader-translation-select"
            aria-label={t("reader.pickTranslation")}
            aria-expanded={tidPickerOpen}
            onClick={() => {
              setTidPickerOpen((v) => !v);
              setPassagePickerOpen(false);
              setLayoutOpen(false);
              setSettingsOpen(false);
            }}
          >
            <span className="bible-tid-abbr">{activeAbbr}</span>
            <span className="bible-passage-chevron" aria-hidden="true">
              ▾
            </span>
          </button>
          <button
            type="button"
            className={`bible-gear-btn${layoutOpen ? " is-on" : ""}`}
            data-testid="reader-layout-btn"
            aria-label={t("reader.settings")}
            aria-expanded={layoutOpen}
            onClick={() => {
              setLayoutOpen((v) => !v);
              setPassagePickerOpen(false);
              setTidPickerOpen(false);
              setSettingsOpen(false);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm9.4 3.1-1.1-.6c.1-.3.1-.7.1-1s0-.7-.1-1l1.1-.6a1 1 0 0 0 .4-1.3l-1-1.7a1 1 0 0 0-1.3-.4l-1.1.6a7.2 7.2 0 0 0-1.7-1l-.2-1.2A1 1 0 0 0 15.4 2h-2.8a1 1 0 0 0-1 .9l-.2 1.2c-.6.2-1.2.6-1.7 1l-1.1-.6a1 1 0 0 0-1.3.4l-1 1.7a1 1 0 0 0 .4 1.3l1.1.6c-.1.3-.1.7-.1 1s0 .7.1 1l-1.1.6a1 1 0 0 0-.4 1.3l1 1.7a1 1 0 0 0 1.3.4l1.1-.6c.5.4 1.1.7 1.7 1l.2 1.2a1 1 0 0 0 1 .9h2.8a1 1 0 0 0 1-.9l.2-1.2c.6-.2 1.2-.6 1.7-1l1.1.6a1 1 0 0 0 1.3-.4l1-1.7a1 1 0 0 0-.4-1.3Z"
              />
            </svg>
          </button>
          <button
            type="button"
            className="bible-gear-btn"
            data-testid="reader-top-bookmark"
            aria-label={t("reader.bookmark")}
            onClick={() => void addBookmark(selection?.start ?? 1)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1Z" />
            </svg>
          </button>
        </div>
      </header>

      {error && <p className="bible-reader-error">{humanizeStatus(t, error)}</p>}

      {tidPickerOpen && (
        <div className="bible-modal-backdrop" role="presentation" onClick={() => setTidPickerOpen(false)}>
        <div
          className="bible-picker bible-modal-sheet"
          data-testid="reader-tid-picker"
          role="dialog"
          aria-modal="true"
          aria-label={t("reader.pickTranslation")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bible-picker-steps">
            <span className="bible-hint">{t("reader.pickTranslation")}</span>
            <button type="button" className="bible-text-btn" onClick={() => setTidPickerOpen(false)}>
              ✕
            </button>
          </div>
          <ul className="bible-picker-list" data-testid="reader-tid-list">
            {translations.map((tr) => (
              <li key={tr.id}>
                <button
                  type="button"
                  className={`bible-picker-item${tr.id === translationId ? " is-on" : ""}`}
                  data-testid={`reader-tid-${tr.id}`}
                  onClick={() => {
                    goToPassage(tr.id, bookId, chapterNum);
                    setTidPickerOpen(false);
                  }}
                >
                  <strong className="bible-tid-row-abbr">{tr.abbreviation || tr.name[locale]}</strong>
                  <span className="bible-tid-row-name">{tr.name[locale]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        </div>
      )}

      {passagePickerOpen && (
        <div className="bible-modal-backdrop" role="presentation" onClick={() => setPassagePickerOpen(false)}>
        <div
          className="bible-picker bible-modal-sheet"
          data-testid="reader-passage-picker"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bible-picker-steps">
            {(["book", "chapter", "verse"] as const).map((step) => (
              <button
                key={step}
                type="button"
                className={`bible-text-btn${pickerStep === step ? " is-on" : ""}`}
                onClick={() => setPickerStep(step)}
              >
                {step === "book" ? t("reader.book") : step === "chapter" ? t("reader.chapter") : t("reader.verse")}
              </button>
            ))}
            <button type="button" className="bible-text-btn" onClick={() => setPassagePickerOpen(false)}>
              ✕
            </button>
          </div>
          {pickerStep === "book" && (
            <ul className="bible-picker-list" data-testid="reader-picker-books">
              {books.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    className={`bible-picker-item${pickerBookId === b.id ? " is-on" : ""}`}
                    onClick={() => {
                      setPickerBookId(b.id);
                      setPickerChapter(1);
                      setPickerStep("chapter");
                    }}
                  >
                    {b.name[bookNameLocale]}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pickerStep === "chapter" && (
            <ul className="bible-picker-grid" data-testid="reader-picker-chapters">
              {pickerChapterOptions.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    className={`bible-picker-item${pickerChapter === n ? " is-on" : ""}`}
                    onClick={() => {
                      setPickerChapter(n);
                      setPickerStep("verse");
                      if (pickerBookId !== bookId || n !== chapterNum) {
                        goToPassage(translationId, pickerBookId, n);
                      }
                    }}
                  >
                    {n}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pickerStep === "verse" && (
            <ul className="bible-picker-grid" data-testid="reader-picker-verses">
              {pickerVerseOptions.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    className="bible-picker-item"
                    data-testid={`reader-picker-verse-${n}`}
                    onClick={() => {
                      if (pickerBookId !== bookId || pickerChapter !== chapterNum) {
                        goToPassage(translationId, pickerBookId, pickerChapter);
                      }
                      setFocusVerse(n);
                      setPassagePickerOpen(false);
                    }}
                  >
                    {n}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>
      )}

      {layoutOpen && (
        <div className="bible-modal-backdrop" role="presentation" onClick={() => setLayoutOpen(false)}>
        <div
          className="bible-settings-sheet bible-modal-sheet"
          data-testid="reader-layout-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={t("reader.layout")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bible-settings-row">
            <span>{t("reader.colorTheme")}</span>
            <div className="bible-more-actions" data-testid="reader-skin">
              {READER_SKIN_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`bible-text-btn${readerSkin === id ? " is-on" : ""}`}
                  onClick={() => setReaderSkin(id)}
                >
                  {t(`reader.skin.${id}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="bible-settings-row bible-settings-row--stack">
            <span>{t("reader.fontFamily")}</span>
            {(
              [
                ["zh", "reader.fontZh"],
                ["en", "reader.fontEn"],
                ["ja", "reader.fontJa"],
              ] as const
            ).map(([group, labelKey]) => (
              <div key={group} className="bible-font-group">
                <span className="bible-font-group-label">{t(labelKey)}</span>
                <div className="bible-more-actions bible-font-chips" data-testid={`reader-fonts-${group}`}>
                  {fontsByGroup(group).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`bible-text-btn bible-font-chip${fontId === f.id ? " is-on" : ""}`}
                      style={{ fontFamily: f.stack }}
                      data-testid={`reader-font-${f.id}`}
                      onClick={() => pickFont(f.id)}
                    >
                      {t(f.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="bible-settings-row">
            <span>{t("reader.fontSize")}</span>
            <div className="bible-more-actions bible-size-chips" data-testid="reader-font-sizes">
              {READER_FONT_SIZES_PT.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  className={`bible-text-btn${fontSizePt === pt ? " is-on" : ""}`}
                  data-testid={`reader-size-${pt}`}
                  onClick={() => pickFontSize(pt)}
                >
                  {pt}
                </button>
              ))}
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
            <span>{t("reader.dual")}</span>
            <div className="bible-more-actions">
              <button
                type="button"
                className={`bible-text-btn${!dualPane ? " is-on" : ""}`}
                data-testid="reader-layout-single"
                onClick={() => setDualPane(false)}
              >
                {t("reader.singleLayout")}
              </button>
              <button
                type="button"
                className={`bible-text-btn${dualPane ? " is-on" : ""}`}
                data-testid="reader-layout-compare"
                onClick={() => setDualPane(true)}
              >
                {t("reader.compareLayout")}
              </button>
            </div>
          </div>
          {dualPane && (
            <div className="bible-settings-row bible-settings-row--stack">
              <span>{t("reader.comparePeer")}</span>
              <div className="bible-more-actions bible-peer-chips" data-testid="reader-compare-peers">
                {comparePeers.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    className={`bible-text-btn${secondTranslationId === tr.id ? " is-on" : ""}`}
                    onClick={() => setSecondTranslationId(tr.id)}
                  >
                    {tr.abbreviation || tr.name[locale]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      <div className="bible-folio" data-testid="reader-folio">
        {dualPane ? (
          <CompareChapterPane
            primary={chapter}
            peer={secondChapter}
            primaryAbbr={activeAbbr}
            peerAbbr={peerAbbr}
            fontSize={fontSize}
            lineHeight={lineHeight}
            fontFamily={readerFont}
            selection={selection}
            onSelectVerse={selectVerse}
            onExtendSelection={extendSelection}
            highlightByVerse={highlightByVerse}
          />
        ) : (
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
        )}
      </div>

      {renderChapterNav("reader-bottom", "bottom")}

      {selection && !dockPanel && (
        <div className="bible-selection-bar" data-testid="reader-selection-bar" role="toolbar">
          <span className="bible-hint">{selectionLabel}</span>
          {selectionAlreadyHighlighted ? (
            <button
              type="button"
              className="bible-dock-btn"
              data-testid="reader-unhighlight"
              onClick={() => {
                if (selection) {
                  for (let v = selection.start; v <= selection.end; v += 1) {
                    void removeHighlightAt(v);
                  }
                  setSelection(null);
                }
              }}
            >
              {t("reader.clearHighlight")}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`bible-dock-btn${highlightPaletteOpen ? " is-on" : ""}`}
                data-testid="reader-highlight-toggle"
                onClick={() => setHighlightPaletteOpen((v) => !v)}
              >
                {t("reader.highlight")}
              </button>
              {highlightPaletteOpen && (
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
              )}
            </>
          )}
          <button type="button" className="bible-dock-btn" onClick={() => setSelection(null)}>
            {t("reader.clearSelection")}
          </button>
        </div>
      )}

      <div className="bible-reading-dock" data-testid="reader-dock" role="toolbar" aria-label={t("reader.moreTools")}>
          <button
            type="button"
            className={`bible-dock-btn${dockPanel === "note" ? " is-on" : ""}`}
            data-testid="reader-dock-note"
            onClick={() => toggleDock("note")}
          >
            {t("reader.note")}
          </button>
          <span className="bible-dock-sep" aria-hidden="true" />
          <button
            type="button"
            className={`bible-dock-btn${dockPanel === "study" ? " is-on" : ""}`}
            data-testid="reader-dock-study"
            onClick={() => toggleDock("study")}
          >
            {t("reader.study")}
          </button>
          <span className="bible-dock-sep" aria-hidden="true" />
          <button
            type="button"
            className={`bible-dock-btn${dockPanel === "search" ? " is-on" : ""}`}
            data-testid="reader-dock-search"
            onClick={() => toggleDock("search")}
          >
            {t("reader.search")}
          </button>
          <span className="bible-dock-sep" aria-hidden="true" />
          <button
            type="button"
            className={`bible-dock-btn${dockPanel === "speak" ? " is-on" : ""}`}
            data-testid="reader-dock-speak"
            onClick={() => toggleDock("speak")}
          >
            {t("reader.speak")}
          </button>
        </div>

      {dockPanel === "note" && (
        <div className="bible-modal-backdrop" role="presentation" onClick={() => setDockPanel(null)}>
        <div
          className="bible-dock-panel bible-dock-panel--modal"
          data-testid="reader-note-compose"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bible-modal-close-row">
            <button type="button" className="bible-text-btn" onClick={() => setDockPanel(null)}>✕</button>
          </div>
          <h2>
            {t("reader.note")}
            {selectionLabel ? ` · ${selectionLabel}` : ""}
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
        </div>
      )}

      {dockPanel === "study" && (
        <div className="bible-modal-backdrop" role="presentation" onClick={() => setDockPanel(null)}>
        <div
          className="bible-dock-panel bible-dock-panel--modal"
          data-testid="reader-study-panel"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bible-modal-close-row">
            <button type="button" className="bible-text-btn" onClick={() => setDockPanel(null)}>✕</button>
          </div>
          <h2>{t("reader.study")}</h2>
          <p className="bible-hint">
            {t("reader.studyHint")}
            {selection ? ` · ${selectionLabel}` : ""}
          </p>
          <div className="bible-study-tabs" role="tablist" aria-label={t("reader.study")}>
            {(
              [
                ["commentary", "reader.studyTabCommentary"],
                ["dict", "reader.studyTabDict"],
                ["crossrefs", "reader.studyTabCrossrefs"],
              ] as const
            ).map(([id, labelKey]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={studyTab === id}
                className={`bible-study-tab${studyTab === id ? " is-on" : ""}`}
                data-testid={`reader-study-tab-${id}`}
                onClick={() => setStudyTab(id)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          {!selection && <p className="bible-hint">{t("reader.studyPickVerse")}</p>}
          {studyLoading && <p className="bible-hint">{t("reader.studyLoading")}</p>}
          {studyError && <p className="bible-hint">{t("reader.studyLoadError")}</p>}

          {studyTab === "commentary" && (
            <div data-testid="reader-study-commentary">
              <label className="bible-study-source">
                <span>{t("reader.studyCommentarySource")}</span>
                <select
                  value={studyCommentaryId}
                  onChange={(e) => setStudyCommentaryId(e.target.value as StudyCommentaryId)}
                  data-testid="reader-study-commentary-select"
                >
                  {STUDY_COMMENTARIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {commentaryDisplayName(c, studyLang)}
                    </option>
                  ))}
                </select>
              </label>
              <ul className="bible-dock-list bible-study-entries">
                {!studyLoading && studyEntries.length === 0 && (
                  <li className="muted">{t("reader.studyEmptyCommentary")}</li>
                )}
                {studyEntries.map((e, i) => (
                  <li key={`${e.verse}-${i}`} data-verse={e.verse}>
                    <strong>
                      {e.verse > 0 ? `${passageTitle}:${e.verse}` : passageTitle}
                    </strong>
                    <p className="bible-study-body">{e.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {studyTab === "dict" && (
            <div data-testid="reader-study-dict">
              <div className="field">
                <input
                  value={dictQuery}
                  onChange={(e) => {
                    setDictQuery(e.target.value);
                    setEastonFocus(null);
                  }}
                  placeholder={t("reader.studyDictSearch")}
                  data-testid="reader-study-dict-input"
                />
              </div>
              {dictFocusEntry && (
                <article className="bible-study-strongs-card" data-testid="reader-study-dict-focus">
                  <strong>
                    {dictFocusEntry.id} · {dictFocusEntry.entry.lemma}{" "}
                    <span className="muted">({dictFocusEntry.entry.translit})</span>
                  </strong>
                  <p>{dictFocusEntry.entry.gloss}</p>
                  {dictFocusEntry.entry.kjv && (
                    <p className="bible-hint">KJV: {dictFocusEntry.entry.kjv}</p>
                  )}
                </article>
              )}
              {eastonFocus && (
                <article className="bible-study-strongs-card" data-testid="reader-study-easton-focus">
                  <strong>
                    {eastonFocus.headword}{" "}
                    <span className="muted">· {t("reader.studyEaston")}</span>
                  </strong>
                  {eastonFocus.definitions.map((def, i) => (
                    <p key={i}>{def}</p>
                  ))}
                </article>
              )}
              <h3>{t("reader.studyDictVerse")}</h3>
              <ul className="bible-dock-list bible-study-strongs">
                {!studyLoading && verseDictEntries.length === 0 && (
                  <li className="muted">{t("reader.studyEmptyDict")}</li>
                )}
                {verseDictEntries.map(({ id, entry }) => (
                  <li key={id}>
                    <button
                      type="button"
                      className="bible-study-strongs-btn"
                      data-testid={`reader-study-strongs-${id}`}
                      onClick={() => {
                        setDictFocusId(id);
                        setEastonFocus(null);
                      }}
                    >
                      <strong>
                        {id} {entry.lemma}
                      </strong>
                      <span>{entry.gloss}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {dictQuery.trim() && (
                <>
                  <h3>{t("reader.studyDictResults")}</h3>
                  <ul className="bible-dock-list bible-study-strongs">
                    {dictSearchHits.length === 0 && eastonSearchHits.length === 0 && (
                      <li className="muted">—</li>
                    )}
                    {dictSearchHits.map(({ id, entry }) => (
                      <li key={`q-${id}`}>
                        <button
                          type="button"
                          className="bible-study-strongs-btn"
                          onClick={() => {
                            setDictFocusId(id);
                            setEastonFocus(null);
                          }}
                        >
                          <strong>
                            {id} {entry.lemma}
                          </strong>
                          <span>{entry.gloss}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {eastonSearchHits.length > 0 && (
                    <>
                      <h3>{t("reader.studyEastonResults")}</h3>
                      <ul className="bible-dock-list bible-study-strongs" data-testid="reader-study-easton-list">
                        {eastonSearchHits.map((hit) => (
                          <li key={`e-${hit.headword}`}>
                            <button
                              type="button"
                              className="bible-study-strongs-btn"
                              data-testid={`reader-study-easton-${hit.headword}`}
                              onClick={() => {
                                setEastonFocus(hit);
                                setDictFocusId(null);
                              }}
                            >
                              <strong>{hit.headword}</strong>
                              <span>{hit.definitions[0]?.slice(0, 140) ?? ""}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {studyTab === "crossrefs" && (
            <div data-testid="reader-study-crossrefs">
              <ul className="bible-dock-list bible-study-crossrefs">
                {!studyLoading && studyCrossRefs.length === 0 && (
                  <li className="muted">{t("reader.studyEmptyCrossrefs")}</li>
                )}
                {studyCrossRefs.map((r, i) => (
                  <li key={`${r.label}-${i}`}>
                    {r.theme && <p className="bible-hint">{r.theme}</p>}
                    {r.bookId && r.chapter != null ? (
                      <button
                        type="button"
                        className="bible-study-ref-btn"
                        data-testid={`reader-study-xref-${i}`}
                        onClick={() => {
                          goToPassage(translationId, r.bookId!, r.chapter!);
                          if (r.verse) setFocusVerse(r.verse);
                          setDockPanel(null);
                        }}
                      >
                        {r.label}
                        <span className="muted"> · {t("reader.studyJump")}</span>
                      </button>
                    ) : (
                      <span>{r.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3>{t("reader.studyNotes")}</h3>
          <ul className="bible-dock-list">
            {chapterNotes.length === 0 && <li className="muted">{t("reader.studyNoNotes")}</li>}
            {chapterNotes.map((n) => (
              <li key={n.id}>
                <strong>{n.label}</strong>
                <p>{n.text}</p>
              </li>
            ))}
          </ul>
          <h3>{t("reader.studyLinks")}</h3>
          <p className="bible-hint">{t("reader.studyLicense")}</p>
          <ul className="bible-dock-list">
            {studyLinks.map((m) => (
              <li key={m.id}>
                <a href={m.url} target="_blank" rel="noreferrer">
                  {m.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
        </div>
      )}

      {dockPanel === "search" && (
        <div className="bible-modal-backdrop" role="presentation" onClick={() => setDockPanel(null)}>
        <div
          className="bible-dock-panel bible-dock-panel--modal"
          data-testid="reader-search-panel"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bible-modal-close-row">
            <button type="button" className="bible-text-btn" onClick={() => setDockPanel(null)}>✕</button>
          </div>
          <h2>{t("reader.search")}</h2>
          <p className="bible-hint">{t("reader.searchHint")}</p>
          <div className="field">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("reader.searchPlaceholder")}
              data-testid="reader-search-input"
              autoFocus
            />
          </div>
          <ul className="bible-dock-list">
            {searchQuery.trim() && searchHits.length === 0 && (
              <li className="muted">{t("reader.searchEmpty")}</li>
            )}
            {searchHits.map((v) => (
              <li key={v.verse}>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => {
                    setFocusVerse(v.verse);
                    setSelection({ start: v.verse, end: v.verse });
                    setDockPanel(null);
                  }}
                >
                  <strong>
                    {passageTitle}:{v.verse}
                  </strong>
                  <span className="muted"> {displayVerseText(v.text)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        </div>
      )}

      {dockPanel === "speak" && (
        <div className="bible-modal-backdrop" role="presentation" onClick={() => setDockPanel(null)}>
        <div
          className="bible-dock-panel bible-dock-panel--modal"
          data-testid="reader-speak-panel"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bible-modal-close-row">
            <button type="button" className="bible-text-btn" onClick={() => setDockPanel(null)}>✕</button>
          </div>
          <h2>{t("reader.speak")}</h2>
          <div className="toolbar">
            <button
              type="button"
              className="btn"
              data-testid="reader-speak-chapter"
              onClick={() => speakText(chapterPlainText())}
            >
              {t("reader.speakChapter")}
            </button>
            <button
              type="button"
              className="btn ghost"
              data-testid="reader-speak-selection"
              onClick={() => speakText(selectionPlainText())}
            >
              {t("reader.speakSelection")}
            </button>
            <button type="button" className="btn ghost" data-testid="reader-speak-stop" onClick={stopSpeech}>
              {t("reader.speakStop")}
            </button>
          </div>
          {speakNote === "unsupported" && <p className="bible-hint">{t("reader.speakUnsupported")}</p>}
          {speakNote === "empty" && <p className="bible-hint">{t("reader.speakEmpty")}</p>}
        </div>
        </div>
      )}

      {(bookmarks.length > 0 || decryptedNotes.length > 0) && (
        <div className="bible-more-body" style={{ marginTop: "1.25rem" }}>
          <div className="bible-side-block">
            <h2>{t("reader.bookmark")}</h2>
            <ul>
              {bookmarks.map((b) => (
                <li key={b.id}>{b.label}</li>
              ))}
            </ul>
          </div>
          <div className="bible-side-block">
            <h2>{t("reader.notesPanel")}</h2>
            <ul>
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
