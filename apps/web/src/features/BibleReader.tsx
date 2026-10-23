import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { saveReaderPlace } from "../lib/reader-place";
import {
  applyVerseTap,
  highlightIdsInRange,
  normalizeVerseRange,
  rangeForHighlightAt,
  type VerseRange,
} from "../lib/reader-selection";
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
  listBooksGrouped,
  listDownloadableCorpusCatalog,
  listStudyMaterials,
  listTranslations,
  getTranslation,
  PANSHI_WEB_PLAYER,
  sectionHeadingsFor,
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
import { api, getApiBase, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";
import { decryptJson, encryptJson } from "../lib/note-crypto";
import {
  applyReaderSkin,
  clearReaderSkinOverrides,
  appThemeAllowsReaderSkins,
  loadReaderSkin,
  READER_SKIN_DAY_IDS,
  type ReaderSkinId,
} from "../lib/reader-skins";
import {
  DEFAULT_LINE_HEIGHT,
  fontGroupForLanguage,
  fontSizePtToRem,
  fontStackFor,
  fontsByGroup,
  loadFontByLang,
  loadReaderFontSizePt,
  loadReaderLineHeight,
  READER_FONT_SIZES_PT,
  saveReaderFontForLang,
  saveReaderFontSizePt,
  saveReaderLineHeight,
  type FontByLang,
  type ReaderFontGroup,
  type ReaderFontId,
  type ReaderFontSizePt,
} from "../lib/reader-fonts";
import {
  bibleLocalDb,
  cacheNetworkChapter,
  densifyChapterVerses,
  installDownloadedPack,
  peekLocalChapter,
  readLocalChapter,
} from "../lib/bible-local-db";
import { scheduleBiblePreload } from "../lib/bible-preload";

type DockPanel = "note" | "study" | "search" | "speak" | "settings" | null;
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

function rangeIncludes(range: VerseRange | null, verse: number): boolean {
  return Boolean(range && verse >= range.start && verse <= range.end);
}

function verseMapFromChapter(chapter: ChapterPayload | null): Map<number, string> {
  const map = new Map<number, string>();
  if (!chapter || "external" in chapter) return map;
  for (const v of chapter.verses) map.set(v.verse, v.text);
  return map;
}

/** Resolve verse under the finger/cursor — pointer capture would pin the first verse. */
function verseFromPoint(clientX: number, clientY: number): number | null {
  const stack =
    typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter(Boolean);
  for (const node of stack) {
    if (!(node instanceof Element)) continue;
    const host = node.closest("[data-verse]");
    if (!(host instanceof HTMLElement)) continue;
    const n = Number(host.dataset.verse);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  return null;
}

/**
 * Tap selects. Moving onto another verse selects that range immediately.
 * A page scroll (the document actually moves) does not select.
 */
function useVerseGesture(opts: {
  onTapVerse: (verse: number) => void;
  onDragSelection: (anchor: number, verse: number) => void;
}) {
  const start = useRef<{
    x: number;
    y: number;
    scrollY: number;
    verse: number;
    pointerId: number;
  } | null>(null);
  const mode = useRef<"pending" | "selecting" | "scrolling">("pending");
  const optsRef = useRef(opts);
  optsRef.current = opts;

  function detach() {
    window.removeEventListener("pointermove", onWinMove);
    window.removeEventListener("pointerup", onWinUp);
    window.removeEventListener("pointercancel", onWinUp);
  }

  function pageScrolled(originScrollY: number): boolean {
    return Math.abs(window.scrollY - originScrollY) > 6;
  }

  function onWinMove(e: PointerEvent) {
    const origin = start.current;
    if (!origin || origin.pointerId !== e.pointerId || e.buttons === 0) return;
    const under = verseFromPoint(e.clientX, e.clientY);
    if (pageScrolled(origin.scrollY)) {
      mode.current = "scrolling";
      return;
    }
    if (under != null && under !== origin.verse) {
      mode.current = "selecting";
      optsRef.current.onDragSelection(origin.verse, under);
      e.preventDefault();
      return;
    }
    if (mode.current === "selecting") {
      if (under != null) optsRef.current.onDragSelection(origin.verse, under);
      e.preventDefault();
    }
  }

  function onWinUp(e: PointerEvent) {
    const origin = start.current;
    if (!origin || origin.pointerId !== e.pointerId) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    const selecting = mode.current === "selecting";
    const scrolling = mode.current === "scrolling" || pageScrolled(origin.scrollY);
    start.current = null;
    mode.current = "pending";
    detach();
    if (!selecting && !scrolling && dx * dx + dy * dy <= 576) {
      optsRef.current.onTapVerse(origin.verse);
    }
  }

  useEffect(() => () => detach(), []);

  function onPointerDown(verse: number, e: ReactPointerEvent) {
    if (e.button !== 0) return;
    detach();
    start.current = {
      x: e.clientX,
      y: e.clientY,
      scrollY: window.scrollY,
      verse,
      pointerId: e.pointerId,
    };
    mode.current = "pending";
    window.addEventListener("pointermove", onWinMove, { passive: false });
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinUp);
  }

  return { onPointerDown };
}


function CompareChapterPane({
  primary,
  peer,
  primaryAbbr,
  peerAbbr,
  fontSize,
  lineHeight,
  fontFamily,
  selection,
  onTapVerse,
  onDragSelection,
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
  onTapVerse: (verse: number) => void;
  onDragSelection: (anchor: number, verse: number) => void;
  highlightByVerse?: Record<number, string>;
}) {
  const press = useVerseGesture({ onTapVerse, onDragSelection });
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
            style={hl ? ({ ["--verse-hl" as string]: hl } as CSSProperties) : undefined}
            data-highlighted={hl ? "1" : "0"}
            data-verse={v.verse}
            role="button"
            tabIndex={0}
            onPointerDown={(e) => press.onPointerDown(v.verse, e)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTapVerse(v.verse);
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
  onTapVerse,
  onDragSelection,
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
  onTapVerse: (verse: number) => void;
  onDragSelection: (anchor: number, verse: number) => void;
  highlightByVerse?: Record<number, string>;
}) {
  const press = useVerseGesture({ onTapVerse, onDragSelection });
  const headingLocale = locale.startsWith("zh") ? "zh" : locale.startsWith("ja") ? "ja" : "en";

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

  const headings = sectionHeadingsFor(chapter.book, chapter.chapter);
  const headingAt = new Map(headings.map((h) => [h.verse, h]));

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
      <div className="bible-prose-body">
        <span className="chapter-lead" aria-hidden="true">
          {chapter.chapter}
        </span>
        {chapter.verses.map((v) => {
          const hl = highlightByVerse?.[v.verse];
          const selected = rangeIncludes(selection, v.verse);
          const heading = headingAt.get(v.verse);
          return (
            <span key={v.verse} className="verse-block">
              {heading ? (
                <span className="verse-section-heading" data-testid={`reader-heading-${v.verse}`}>
                  {heading.title[headingLocale]}
                </span>
              ) : null}
              <span
                className={`verse-inline${selected ? " verse-selected" : ""}${hl ? " verse-highlighted" : ""}`}
                style={hl ? ({ ["--verse-hl" as string]: hl } as CSSProperties) : undefined}
                onPointerDown={(e) => press.onPointerDown(v.verse, e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onTapVerse(v.verse);
                  }
                }}
                role="button"
                tabIndex={0}
                data-verse={v.verse}
                data-selected={selected ? "1" : "0"}
                data-highlighted={hl ? "1" : "0"}
                title={t("reader.longPressSelect")}
              >
                <sup className="verse-num">{v.verse}</sup>
                {displayVerseText(v.text)}{" "}
              </span>
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
  const routeTid =
    params.tid &&
    listTranslations({ offlineCapableOnly: true, availableOnly: true }).some((tr) => tr.id === params.tid)
      ? params.tid
      : "cuvs";
  const routeBookId = bookIdFromSlug(params.bookSlug ?? "john") ?? "John";
  const routeChapter = Math.max(1, Number(params.chapter ?? "1") || 1);
  const routeVerse = (() => {
    const raw = searchParams.get("verse");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  })();
  const fromPlans = searchParams.get("from") === "plans";
  const returnPlanId = searchParams.get("planId");
  const plansBackHref = "/app/plans";
  const plansDoneHref = returnPlanId
    ? `/app/plans?resume=1&planId=${encodeURIComponent(returnPlanId)}`
    : "/app/plans?resume=1";

  const [translationId, setTranslationId] = useState(routeTid);
  const [secondTranslationId, setSecondTranslationId] = useState("web");
  const [dualPane, setDualPane] = useState(false);
  const [tidPickerOpen, setTidPickerOpen] = useState(false);
  const [bookId, setBookId] = useState(routeBookId);
  const [chapterNum, setChapterNum] = useState(routeChapter);
  const [fontSizePt, setFontSizePt] = useState<ReaderFontSizePt>(() => loadReaderFontSizePt());
  const [lineHeight, setLineHeight] = useState(() => loadReaderLineHeight());
  const [fontByLang, setFontByLang] = useState<FontByLang>(() => loadFontByLang());
  const [preset, setPreset] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [readerSkin, setReaderSkin] = useState<ReaderSkinId>(() => loadReaderSkin());
  const [appTheme, setAppTheme] = useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("lh.theme") ?? "day" : "day",
  );
  const skinsEnabled = appThemeAllowsReaderSkins(appTheme);
  const [dockPanel, setDockPanel] = useState<DockPanel>(null);
  const [dockCollapsed, setDockCollapsed] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem("lh.readerDockCollapsed") === "1";
  });
  const [dockToolsOpen, setDockToolsOpen] = useState(false);
  const dragAnchor = useRef<number | null>(null);
  const verseSelectingRef = useRef(false);
  const [chapterBookmarkId, setChapterBookmarkId] = useState<string | null>(null);
  const [panshiError, setPanshiError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  /** Keep URL in WeDevote shape: /app/bible/{tid}/{book}/{chapter}(?verse=) */
  const goToPassage = useCallback(
    (
      tid: string,
      nextBookId: string,
      nextChapter: number,
      replaceOrOpts: boolean | { replace?: boolean; verse?: number } = false,
    ) => {
      const opts =
        typeof replaceOrOpts === "boolean"
          ? { replace: replaceOrOpts }
          : (replaceOrOpts ?? {});
      const book = getBook(nextBookId);
      const capped = Math.min(Math.max(1, nextChapter), book?.chapters ?? 1);
      const verse =
        opts.verse != null && Number.isFinite(opts.verse) && opts.verse >= 1
          ? Math.floor(opts.verse)
          : null;
      const path = `/app/bible/${tid}/${bookSlug(nextBookId)}/${capped}${
        verse != null ? `?verse=${verse}` : ""
      }`;
      // Optimistic clear so the UI doesn't keep showing the previous chapter.
      setChapter(null);
      setSecondChapter(null);
      setSelection(null);
      dragAnchor.current = null;
      setChapterBookmarkId(null);
      setHighlightByVerse({});
      setHighlightIdByVerse({});
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
      }
      navigate(path, { replace: Boolean(opts.replace) });
      setTranslationId(tid);
      setBookId(nextBookId);
      setChapterNum(capped);
      saveReaderPlace({ tid, bookSlug: bookSlug(nextBookId), chapter: capped });
      // Verse focus is applied via routeVerse → focusVerse after prose mounts.
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
    if (params.tid && params.bookSlug && params.chapter) {
      saveReaderPlace({ tid: routeTid, bookSlug: bookSlug(routeBookId), chapter: capped });
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
    compact: {
      fontSizePt: 12 as ReaderFontSizePt,
      lineHeight: 1.65,
      fonts: { zh: "heiti", en: "sourceSerif", ja: "notoSansJp" } as FontByLang,
    },
    comfortable: {
      fontSizePt: 16 as ReaderFontSizePt,
      lineHeight: DEFAULT_LINE_HEIGHT,
      fonts: { zh: "songti", en: "literata", ja: "notoSerifJp" } as FontByLang,
    },
    spacious: {
      fontSizePt: 18 as ReaderFontSizePt,
      lineHeight: 2.15,
      fonts: { zh: "songti", en: "garamond", ja: "shippori" } as FontByLang,
    },
  } as const;

  function applyPreset(id: keyof typeof TYPO_PRESETS) {
    const p = TYPO_PRESETS[id];
    setPreset(id);
    setFontSizePt(p.fontSizePt);
    saveReaderFontSizePt(p.fontSizePt);
    setLineHeight(p.lineHeight);
    saveReaderLineHeight(p.lineHeight);
    setFontByLang(p.fonts);
    for (const group of ["zh", "en", "ja"] as const) {
      saveReaderFontForLang(group, p.fonts[group]);
    }
  }

  function pickFont(group: ReaderFontGroup, id: ReaderFontId) {
    setFontByLang((prev) => ({ ...prev, [group]: id }));
    saveReaderFontForLang(group, id);
  }

  function pickFontSize(pt: ReaderFontSizePt) {
    setFontSizePt(pt);
    saveReaderFontSizePt(pt);
  }

  function pickLineHeight(lh: number) {
    setLineHeight(lh);
    saveReaderLineHeight(lh);
  }

  function toggleDock(panel: Exclude<DockPanel, null>) {
    setDockPanel((cur) => (cur === panel ? null : panel));
    setDockToolsOpen(false);
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
    const onStorage = () => setAppTheme(localStorage.getItem("lh.theme") ?? "day");
    window.addEventListener("storage", onStorage);
    const tick = window.setInterval(() => {
      const next = localStorage.getItem("lh.theme") ?? "day";
      setAppTheme((cur) => (cur === next ? cur : next));
    }, 1200);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (!skinsEnabled) {
      // Night / high-contrast: app theme owns the look; never leave day-pack inlines.
      clearReaderSkinOverrides();
      return;
    }
    applyReaderSkin(readerSkin === "ink" ? "default" : readerSkin);
  }, [readerSkin, skinsEnabled]);

  useEffect(() => {
    localStorage.setItem("lh.readerDockCollapsed", dockCollapsed ? "1" : "0");
  }, [dockCollapsed]);
  const [noteText, setNoteText] = useState("");
  const [chapter, setChapter] = useState<ChapterPayload | null>(null);
  const [secondChapter, setSecondChapter] = useState<ChapterPayload | null>(null);
  const [selection, setSelection] = useState<VerseRange | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const [decryptedNotes, setDecryptedNotes] = useState<DecryptedNote[]>([]);
  const [highlightByVerse, setHighlightByVerse] = useState<Record<number, string>>({});
  const [highlightIdByVerse, setHighlightIdByVerse] = useState<Record<number, string>>({});
  const [bookmarks, setBookmarks] = useState<
    { id: string; label: string; book: string; chapter: number; verse: number }[]
  >([]);
  const [corpusHint, setCorpusHint] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [passagePickerOpen, setPassagePickerOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<"book" | "chapter" | "verse">("book");
  const [pickerTestament, setPickerTestament] = useState<"ot" | "nt">(
    () => getBook(routeBookId)?.testament ?? "nt",
  );
  const [pickerBookId, setPickerBookId] = useState(routeBookId);
  const [pickerChapter, setPickerChapter] = useState(routeChapter);
  const folioRef = useRef<HTMLDivElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);
  const [focusVerse, setFocusVerse] = useState<number | null>(null);
  const [installedByTid, setInstalledByTid] = useState<
    Record<string, InstalledTranslationSummary>
  >({});
  const [downloadingTid, setDownloadingTid] = useState<string | null>(null);
  const translations = listTranslations({ offlineCapableOnly: true, availableOnly: true });
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
  const activeFontGroup = fontGroupForLanguage(getTranslation(translationId)?.language);
  const readerFont = fontStackFor(fontByLang[activeFontGroup]);
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
    void scheduleBiblePreload().then(() => setBootTick((n) => n + 1));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        // Prefer complete local chapters; paint incomplete/demo briefly while refetching.
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
        const stale = await peekLocalChapter(translationId, bookId, chapterNum);
        if (stale && !cancelled) {
          setChapter({
            translationId,
            book: stale.book,
            chapter: stale.chapter,
            verses: densifyChapterVerses(translationId, stale.book, stale.chapter, stale.verses),
            source: "local-db",
          });
        }
        try {
          const data = await api<ChapterPayload>(
            `/v1/bible/chapter?translation=${encodeURIComponent(translationId)}&ref=${encodeURIComponent(ref)}`,
          );
          if (cancelled) return;
          if (data && "verses" in data && Array.isArray(data.verses)) {
            const verses = densifyChapterVerses(translationId, bookId, chapterNum, data.verses);
            setChapter({
              ...data,
              verses,
            });
            void cacheNetworkChapter(
              translationId,
              bookId,
              chapterNum,
              data.verses,
              typeof data.source === "string" ? data.source : undefined,
            );
          } else {
            setChapter(data);
          }
        } catch (netErr) {
          // Licensed R2 / missing corpus must not block book/chapter navigation.
          if (stale) {
            if (!cancelled) setError(null);
            return;
          }
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
        const stale = await peekLocalChapter(secondTranslationId, bookId, chapterNum);
        if (stale && !cancelled) {
          setSecondChapter({
            translationId: secondTranslationId,
            book: bookId,
            chapter: chapterNum,
            verses: densifyChapterVerses(secondTranslationId, bookId, chapterNum, stale.verses),
            source: "local",
          });
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
        if ("verses" in data && Array.isArray(data.verses)) {
          void cacheNetworkChapter(
            secondTranslationId,
            bookId,
            chapterNum,
            data.verses,
            typeof data.source === "string" ? data.source : undefined,
          );
        }
      } catch {
        if (!cancelled) setSecondChapter(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dualPane, secondTranslationId, ref, bookId, chapterNum]);

  const annotationsEpoch = useRef(0);

  const refreshNotes = useCallback(async () => {
    const epoch = ++annotationsEpoch.current;
    const tid = translationId;
    const book = bookId;
    const chapter = chapterNum;
    if (!getToken()) {
      if (epoch !== annotationsEpoch.current) return;
      setDecryptedNotes([]);
      setHighlightByVerse({});
      setHighlightIdByVerse({});
      setBookmarks([]);
      setChapterBookmarkId(null);
      return;
    }
    try {
      const res = await api<{ annotations: AnnotationRow[] }>(
        `/v1/annotations?translation=${encodeURIComponent(tid)}`,
      );
      if (epoch !== annotationsEpoch.current) return;
      const notes: DecryptedNote[] = [];
      const highlights: Record<number, string> = {};
      const highlightIds: Record<number, string> = {};
      const marks: { id: string; label: string; book: string; chapter: number; verse: number }[] =
        [];
      const chapterBookmarkIds: string[] = [];
      const colorMap: Record<string, string> = {
        amber: "#f5d76e",
        mint: "#a8e6cf",
        rose: "#f8b4c4",
        sky: "#a8d8ea",
      };
      for (const row of res.annotations) {
        const sameChapter = row.book === book && row.chapter === chapter;
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
            book: row.book,
            chapter: row.chapter,
            verse: row.verseStart ?? 1,
          });
          if (sameChapter) chapterBookmarkIds.push(row.id);
        }
      }
      if (epoch !== annotationsEpoch.current) return;
      setDecryptedNotes(notes);
      setHighlightByVerse(highlights);
      setHighlightIdByVerse(highlightIds);
      setBookmarks(marks);
      // One chapter bookmark in the UI; keep the oldest and drop extras on toggle.
      setChapterBookmarkId(chapterBookmarkIds[0] ?? null);
    } catch {
      /* listing is optional when offline / unauthenticated */
    }
  }, [translationId, bookId, chapterNum]);

  // Chapter links bypass goToPassage — drop previous chapter paint immediately.
  useEffect(() => {
    annotationsEpoch.current += 1;
    setHighlightByVerse({});
    setHighlightIdByVerse({});
    setChapterBookmarkId(null);
    setSelection(null);
    dragAnchor.current = null;
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
      // Web download = grant corpus access for this account (licensed tids).
      try {
        await api("/v1/bible/entitlements", {
          method: "POST",
          body: JSON.stringify({ translationId: targetTid }),
        });
      } catch {
        /* PD / already granted */
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

  function tapVerse(verse: number) {
    setDockToolsOpen(false);
    setSelection((cur) => {
      const painted =
        cur == null ? rangeForHighlightAt(highlightIdByVerse, verse) : null;
      const next = applyVerseTap(cur, dragAnchor.current, verse, painted);
      dragAnchor.current = next.anchor;
      return next.selection;
    });
  }

  function dragSelection(anchor: number, verse: number) {
    verseSelectingRef.current = true;
    dragAnchor.current = anchor;
    setDockToolsOpen(false);
    setSelection(normalizeVerseRange(anchor, verse));
  }

  async function clearSelectionHighlights() {
    if (!selection) return;
    if (!getToken()) {
      setError("login_required");
      return;
    }
    const ids = highlightIdsInRange(highlightIdByVerse, selection);
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const range = selection;
    setHighlightByVerse((prev) => {
      const next = { ...prev };
      for (const [verse, id] of Object.entries(highlightIdByVerse)) {
        if (id && idSet.has(id)) delete next[Number(verse)];
      }
      for (let v = range.start; v <= range.end; v += 1) delete next[v];
      return next;
    });
    setHighlightIdByVerse((prev) => {
      const next = { ...prev };
      for (const [verse, id] of Object.entries(next)) {
        if (idSet.has(id)) delete next[Number(verse)];
      }
      return next;
    });
    setError(null);
    try {
      for (const id of ids) {
        if (id.startsWith("local-hl-")) continue;
        await api(`/v1/annotations/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
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
    // Wait until the *target* chapter prose is mounted so jumps survive load races.
    if (!chapter || "external" in chapter || !("verses" in chapter)) return;
    if (chapter.book !== bookId || chapter.chapter !== chapterNum) return;
    const prose = document.querySelector('[data-testid="reader-prose"]');
    const el = prose?.querySelector(`[data-verse="${focusVerse}"]`);
    if (focusVerse === 1) {
      // Reset to page top so topbar, chapter lead, and section heading stay visible.
      window.scrollTo({ top: 0, behavior: "smooth" });
      setFocusVerse(null);
      return;
    }
    if (!(el instanceof HTMLElement)) {
      // Prose not painted yet — keep focusVerse until the next paint/load.
      return;
    }
    const block = el.closest(".verse-block");
    const heading = block?.querySelector(".verse-section-heading");
    const target = heading instanceof HTMLElement ? heading : el;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    // Scroll only — do not auto-open selection/highlight chrome on chapter jumps.
    setFocusVerse(null);
  }, [focusVerse, chapter, bookId, chapterNum]);

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

  async function removeBookmark(id: string) {
    if (!getToken()) return;
    try {
      await api(`/v1/annotations/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
    if (chapterBookmarkId === id) setChapterBookmarkId(null);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    await refreshNotes();
  }

  /** Chapter bookmark: at most one per chapter; toggles on/off. */
  async function toggleChapterBookmark() {
    if (!getToken()) {
      setError("login_required");
      return;
    }
    const existing = bookmarks.filter((b) => b.book === bookId && b.chapter === chapterNum);
    if (existing.length > 0 || chapterBookmarkId) {
      const ids = new Set(existing.map((b) => b.id));
      if (chapterBookmarkId) ids.add(chapterBookmarkId);
      setChapterBookmarkId(null);
      setBookmarks((prev) => prev.filter((b) => !(b.book === bookId && b.chapter === chapterNum)));
      setError(null);
      for (const id of ids) {
        if (id.startsWith("local-bm-")) continue;
        try {
          await api(`/v1/annotations/${encodeURIComponent(id)}`, { method: "DELETE" });
        } catch {
          /* ignore */
        }
      }
      await refreshNotes();
      return;
    }
    const verse = selection?.start ?? 1;
    const tempId = `local-bm-${bookId}-${chapterNum}`;
    setChapterBookmarkId(tempId);
    setBookmarks((prev) => [
      ...prev.filter((b) => !(b.book === bookId && b.chapter === chapterNum)),
      {
        id: tempId,
        label: `${bookId} ${chapterNum}:${verse}`,
        book: bookId,
        chapter: chapterNum,
        verse,
      },
    ]);
    setError(null);
    try {
      const { ciphertext, iv } = await encryptJson({ kind: "bookmark" }, "bookmark");
      const res = await api<{ id: string }>("/v1/annotations", {
        method: "POST",
        body: JSON.stringify({
          translationId,
          ref: { book: bookId, chapter: chapterNum, verseStart: verse },
          kind: "bookmark",
          ciphertext,
          iv,
        }),
      });
      setChapterBookmarkId(res.id);
      setBookmarks((prev) =>
        prev.map((b) => (b.id === tempId ? { ...b, id: res.id } : b)),
      );
      setNoteMsg("bookmark_ok");
      await refreshNotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    }
  }

  function panshiAudioSrc(): string {
    return `${getApiBase()}/v1/bible/audio/panshi?book=${encodeURIComponent(bookId)}&chapter=${chapterNum}`;
  }

  function playPanshiChapter() {
    setPanshiError(false);
    stopSpeech();
    const el = audioRef.current;
    if (!el) {
      setPanshiError(true);
      return;
    }
    el.src = panshiAudioSrc();
    void el.play().catch(() => setPanshiError(true));
  }

  function stopPanshi() {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setPanshiError(false);
  }

  async function addHighlight(color: string) {
    if (!getToken()) {
      setError("login_required");
      return;
    }
    if (!selection) return;
    const range = selection;
    const colorMap: Record<string, string> = {
      amber: "#f5d76e",
      mint: "#a8e6cf",
      rose: "#f8b4c4",
      sky: "#a8d8ea",
    };
    const paint = colorMap[color] ?? color;
    // Recolor replaces overlapping annotations so verses don't keep stale ids.
    const overlapping = highlightIdsInRange(highlightIdByVerse, range);
    const overlapSet = new Set(overlapping);
    const tempId = `local-hl-${range.start}-${range.end}-${color}`;
    // Paint immediately so the fill is visible even while the network syncs.
    setHighlightByVerse((prev) => {
      const next = { ...prev };
      for (const [verse, id] of Object.entries(highlightIdByVerse)) {
        if (id && overlapSet.has(id)) delete next[Number(verse)];
      }
      for (let v = range.start; v <= range.end; v += 1) next[v] = paint;
      return next;
    });
    setHighlightIdByVerse((prev) => {
      const next = { ...prev };
      for (const [verse, id] of Object.entries(next)) {
        if (overlapSet.has(id)) delete next[Number(verse)];
      }
      for (let v = range.start; v <= range.end; v += 1) next[v] = tempId;
      return next;
    });
    setError(null);
    try {
      for (const id of overlapping) {
        if (id.startsWith("local-hl-")) continue;
        try {
          await api(`/v1/annotations/${encodeURIComponent(id)}`, { method: "DELETE" });
        } catch {
          /* ignore missing */
        }
      }
      const { ciphertext, iv } = await encryptJson(
        { kind: "highlight", color, verseStart: range.start, verseEnd: range.end },
        "highlight",
      );
      const created = await api<{ id: string }>("/v1/annotations", {
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
      setHighlightIdByVerse((prev) => {
        const next = { ...prev };
        for (let v = range.start; v <= range.end; v += 1) {
          if (next[v] === tempId) next[v] = created.id;
        }
        return next;
      });
      await refreshNotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    }
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

  const selectionHasHighlight =
    selection != null && highlightIdsInRange(highlightIdByVerse, selection).length > 0;

  async function copySelection() {
    const text = selectionPlainText().trim();
    if (!text) return;
    const payload = selectionLabel ? `${selectionLabel}\n${text}` : text;
    try {
      await navigator.clipboard.writeText(payload);
      setCopyFlash(t("reader.copied"));
      window.setTimeout(() => setCopyFlash(null), 1600);
    } catch {
      setCopyFlash(t("reader.copyFailed"));
      window.setTimeout(() => setCopyFlash(null), 2000);
    }
  }

  function openPassagePicker() {
    setPickerBookId(bookId);
    setPickerChapter(chapterNum);
    setPickerTestament(getBook(bookId)?.testament ?? "nt");
    setPickerStep("book");
    setPassagePickerOpen(true);
    setLayoutOpen(false);
    setTidPickerOpen(false);
    setSettingsOpen(false);
  }

  const translationsByLanguage = useMemo(() => {
    const order: Array<"zh" | "en" | "ja"> = ["zh", "en", "ja"];
    const labels: Record<"zh" | "en" | "ja", string> = {
      zh: t("reader.langZh"),
      en: t("reader.langEn"),
      ja: t("reader.langJa"),
    };
    return order
      .map((lang) => ({
        lang,
        label: labels[lang],
        items: translations.filter((tr) => tr.language === lang),
      }))
      .filter((g) => g.items.length > 0);
  }, [translations, t]);

  const groupedBooks = useMemo(
    () => listBooksGrouped({ testament: pickerTestament }),
    [pickerTestament],
  );

  /** Mobile UA: horizontal swipe turns chapter (vertical scroll preserved). */
  useEffect(() => {
    const el = folioRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      swipeStart.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    };
    const onEnd = (e: TouchEvent) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      const touch = e.changedTouches[0];
      if (!start || !touch) return;
      if (verseSelectingRef.current) {
        verseSelectingRef.current = false;
        return;
      }
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
      if (Date.now() - start.t > 800) return;
      if (dx < 0 && nextCursor) {
        goToPassage(translationId, nextCursor.bookId, nextCursor.chapter, { verse: 1 });
      } else if (dx > 0 && prevCursor) {
        goToPassage(translationId, prevCursor.bookId, prevCursor.chapter, { verse: 1 });
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [goToPassage, nextCursor, prevCursor, translationId]);

  useEffect(() => {
    let timer = 0;
    const release = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        verseSelectingRef.current = false;
      }, 80);
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

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
            {chapterBookmarkId ? (
              <span
                className="bible-chapter-bookmark-mark"
                data-testid="reader-chapter-bookmarked"
                title={t("reader.bookmarkOn")}
                aria-hidden="true"
              />
            ) : null}
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
        </div>
      </header>

      {fromPlans && (
        <div className="reader-plans-return" data-testid="reader-plans-return">
          <Link
            className="btn ghost reader-plans-return-back"
            to={plansBackHref}
            data-testid="reader-back-to-plans"
          >
            {t("reader.backToPlans")}
          </Link>
          <Link
            className="btn reader-plans-return-done"
            to={plansDoneHref}
            data-testid="reader-done-return-plans"
          >
            {t("reader.doneReadingReturn")}
          </Link>
        </div>
      )}

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
          <div className="bible-picker-grouped" data-testid="reader-tid-list">
            {translationsByLanguage.map((group) => (
              <div key={group.lang} className="bible-picker-group">
                <p className="bible-picker-group-label">{group.label}</p>
                <ul className="bible-picker-list">
                  {group.items.map((tr) => (
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
                        <strong className="bible-tid-row-abbr">
                          {tr.abbreviation || tr.name[locale]}
                        </strong>
                        <span className="bible-tid-row-name">{tr.name[locale]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
            <>
              <div className="bible-picker-testament" role="tablist" data-testid="reader-picker-testament">
                <button
                  type="button"
                  role="tab"
                  aria-selected={pickerTestament === "ot"}
                  className={`bible-text-btn${pickerTestament === "ot" ? " is-on" : ""}`}
                  onClick={() => setPickerTestament("ot")}
                >
                  {t("reader.testamentOt")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={pickerTestament === "nt"}
                  className={`bible-text-btn${pickerTestament === "nt" ? " is-on" : ""}`}
                  onClick={() => setPickerTestament("nt")}
                >
                  {t("reader.testamentNt")}
                </button>
              </div>
              <div className="bible-picker-grouped" data-testid="reader-picker-books">
                {groupedBooks.map(({ group, books: groupBooks }) => (
                  <div key={group.id} className="bible-picker-group">
                    <p className="bible-picker-group-label">{group.name[bookNameLocale]}</p>
                    <ul className="bible-picker-list">
                      {groupBooks.map((b) => (
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
                  </div>
                ))}
              </div>
            </>
          )}
          {pickerStep === "chapter" && (
            <ul className="bible-picker-grid" data-testid="reader-picker-chapters">
              {pickerChapterOptions.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    className={`bible-picker-item${pickerChapter === n ? " is-on" : ""}`}
                    onClick={() => {
                      // Jump immediately from v1; optional 节 tab for verse targeting.
                      setPickerChapter(n);
                      setPassagePickerOpen(false);
                      goToPassage(translationId, pickerBookId, n, { verse: 1 });
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
                      setPassagePickerOpen(false);
                      if (pickerBookId !== bookId || pickerChapter !== chapterNum) {
                        goToPassage(translationId, pickerBookId, pickerChapter, { verse: n });
                      } else {
                        // Same chapter: keep prose mounted; only update ?verse= + focus.
                        navigate(
                          `/app/bible/${translationId}/${bookSlug(bookId)}/${chapterNum}?verse=${n}`,
                          { replace: true },
                        );
                        setFocusVerse(n);
                      }
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

      {(layoutOpen || dockPanel === "settings") && (
        <div
          className="bible-modal-backdrop"
          role="presentation"
          onClick={() => {
            setLayoutOpen(false);
            if (dockPanel === "settings") setDockPanel(null);
          }}
        >
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
            {skinsEnabled ? (
              <div className="bible-more-actions" data-testid="reader-skin">
                {READER_SKIN_DAY_IDS.map((id) => (
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
            ) : (
              <p className="bible-hint" data-testid="reader-skin-day-only">
                {t("reader.skinDayOnly")}
              </p>
            )}
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
                      className={`bible-text-btn bible-font-chip${fontByLang[group] === f.id ? " is-on" : ""}`}
                      style={{ fontFamily: f.stack }}
                      data-testid={`reader-font-${f.id}`}
                      onClick={() => pickFont(group, f.id)}
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
              min={1.45}
              max={2.4}
              step={0.05}
              value={lineHeight}
              onChange={(e) => pickLineHeight(Number(e.target.value))}
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

      <div className="bible-folio" data-testid="reader-folio" ref={folioRef}>
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
            onTapVerse={tapVerse}
            onDragSelection={dragSelection}
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
            onTapVerse={tapVerse}
            onDragSelection={dragSelection}
            highlightByVerse={highlightByVerse}
          />
        )}
      </div>

      {renderChapterNav("reader-bottom", "bottom")}

      <div
        className={`bible-reading-dock${dockCollapsed && !selection ? " is-collapsed" : ""}${selection ? " is-selecting" : ""}`}
        data-testid="reader-dock"
        role="toolbar"
        aria-label={selection ? t("reader.selectionHighlight") : t("reader.moreTools")}
      >
        {selection ? (
          <div className="bible-dock-highlight-tray" data-testid="reader-selection-bar">
            <span className="bible-hint" data-testid="reader-selection-label">
              {selectionLabel}
            </span>
            <div className="bible-highlight-row" aria-label={t("reader.highlight")}>
              {HIGHLIGHT_COLORS.map((c) => {
                const active =
                  selection != null &&
                  Array.from({ length: selection.end - selection.start + 1 }, (_, i) => selection.start + i).every(
                    (v) => highlightByVerse[v] === c.value,
                  );
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`bible-swatch${active ? " is-on" : ""}`}
                    style={{ background: c.value }}
                    aria-label={`${t("reader.selectionHighlight")} ${c.id}`}
                    aria-pressed={active}
                    data-testid={`reader-highlight-${c.id}`}
                    onClick={() => void addHighlight(c.id)}
                  />
                );
              })}
            </div>
            {selectionHasHighlight && (
              <button
                type="button"
                className="bible-dock-btn bible-dock-btn--danger"
                data-testid="reader-unhighlight"
                onClick={() => void clearSelectionHighlights()}
              >
                {t("reader.clearHighlight")}
              </button>
            )}
            <button
              type="button"
              className="bible-dock-btn"
              data-testid="reader-copy-selection"
              onClick={() => void copySelection()}
            >
              {t("reader.copy")}
            </button>
            <button
              type="button"
              className={`bible-dock-btn${dockPanel === "note" ? " is-on" : ""}`}
              data-testid="reader-dock-note"
              onClick={() => setDockPanel("note")}
            >
              {t("reader.note")}
            </button>
            <button
              type="button"
              className={`bible-dock-btn${chapterBookmarkId ? " is-on" : ""}`}
              data-testid="reader-selection-bookmark"
              aria-pressed={Boolean(chapterBookmarkId)}
              onClick={() => void toggleChapterBookmark()}
            >
              {t("reader.bookmarkChapter")}
            </button>
            <button
              type="button"
              className="bible-dock-btn"
              data-testid="reader-clear-selection"
              onClick={() => {
                setSelection(null);
                dragAnchor.current = null;
              }}
            >
              {t("reader.clearSelection")}
            </button>
            {copyFlash && (
              <span className="bible-hint" data-testid="reader-copy-flash">
                {copyFlash}
              </span>
            )}
          </div>
        ) : dockCollapsed ? (
          <button
            type="button"
            className="bible-dock-edge-tab"
            data-testid="reader-dock-expand"
            aria-label={t("reader.dockExpand")}
            title={t("reader.dockExpand")}
            onClick={() => setDockCollapsed(false)}
          >
            <span className="bible-dock-edge-tab-mark" aria-hidden="true">
              ‹
            </span>
            <span className="bible-dock-edge-tab-label">{t("reader.dockMore")}</span>
          </button>
        ) : (
          <>
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
              className={`bible-dock-btn${dockPanel === "speak" ? " is-on" : ""}`}
              data-testid="reader-dock-speak"
              onClick={() => toggleDock("speak")}
            >
              {t("reader.speak")}
            </button>
            <span className="bible-dock-sep" aria-hidden="true" />
            <button
              type="button"
              className={`bible-dock-btn${chapterBookmarkId ? " is-on" : ""}`}
              data-testid="reader-top-bookmark"
              aria-label={chapterBookmarkId ? t("reader.bookmarkOn") : t("reader.bookmarkOff")}
              aria-pressed={Boolean(chapterBookmarkId)}
              title={t("reader.bookmarkToggle")}
              onClick={() => void toggleChapterBookmark()}
            >
              {t("reader.bookmarkChapter")}
            </button>
            <span className="bible-dock-sep" aria-hidden="true" />
            <button
              type="button"
              className={`bible-dock-btn${dockToolsOpen ? " is-on" : ""}`}
              data-testid="reader-dock-more"
              aria-expanded={dockToolsOpen}
              onClick={() => setDockToolsOpen((open) => !open)}
            >
              {t("reader.dockMore")}
            </button>
            <span className="bible-dock-sep" aria-hidden="true" />
            <button
              type="button"
              className="bible-dock-btn"
              data-testid="reader-dock-collapse"
              aria-label={t("reader.dockCollapse")}
              onClick={() => {
                setDockCollapsed(true);
                setDockToolsOpen(false);
              }}
            >
              ▾
            </button>
            {dockToolsOpen && (
              <div className="bible-dock-highlight-tray" data-testid="reader-dock-tools">
                <button
                  type="button"
                  className={`bible-dock-btn${dockPanel === "search" ? " is-on" : ""}`}
                  data-testid="reader-dock-search"
                  onClick={() => toggleDock("search")}
                >
                  {t("reader.search")}
                </button>
                <button
                  type="button"
                  className={`bible-dock-btn${dockPanel === "settings" || layoutOpen ? " is-on" : ""}`}
                  data-testid="reader-layout-btn"
                  onClick={() => {
                    setLayoutOpen(false);
                    toggleDock("settings");
                  }}
                >
                  {t("reader.settings")}
                </button>
              </div>
            )}
          </>
        )}
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
          {!selection && <p className="bible-hint">{t("reader.selectHint")}</p>}
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
                          goToPassage(translationId, r.bookId!, r.chapter!, {
                            verse: r.verse ?? undefined,
                          });
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
                    navigate(
                      `/app/bible/${translationId}/${bookSlug(bookId)}/${chapterNum}?verse=${v.verse}`,
                      { replace: true },
                    );
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
        <div
          className="bible-modal-backdrop"
          role="presentation"
          onClick={() => {
            setDockPanel(null);
            stopPanshi();
            stopSpeech();
          }}
        >
        <div
          className="bible-dock-panel bible-dock-panel--modal"
          data-testid="reader-speak-panel"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bible-modal-close-row">
            <button
              type="button"
              className="bible-text-btn"
              onClick={() => {
                setDockPanel(null);
                stopPanshi();
                stopSpeech();
              }}
            >
              ✕
            </button>
          </div>
          <h2>{t("reader.speak")}</h2>
          <p className="bible-hint">{t("reader.speakPanshiHint")}</p>
          <div className="toolbar">
            <button
              type="button"
              className="btn"
              data-testid="reader-speak-panshi"
              onClick={() => playPanshiChapter()}
            >
              {t("reader.speakPanshi")}
            </button>
            <button
              type="button"
              className="btn ghost"
              data-testid="reader-speak-stop"
              onClick={() => {
                stopPanshi();
                stopSpeech();
              }}
            >
              {t("reader.speakStop")}
            </button>
          </div>
          <audio
            ref={audioRef}
            key={`${bookId}-${chapterNum}`}
            controls
            className="bible-panshi-player"
            data-testid="reader-panshi-player"
            src={panshiAudioSrc()}
            preload="none"
            onError={() => setPanshiError(true)}
            onPlay={() => {
              setPanshiError(false);
              stopSpeech();
            }}
          />
          {panshiError && (
            <p className="bible-hint">
              {t("reader.speakPanshiError")}{" "}
              <a href={PANSHI_WEB_PLAYER} target="_blank" rel="noreferrer">
                {t("reader.speakPanshiOpen")}
              </a>
            </p>
          )}
          <p className="bible-hint">
            <a href={PANSHI_WEB_PLAYER} target="_blank" rel="noreferrer" data-testid="reader-speak-panshi-web">
              {t("reader.speakPanshiOpen")}
            </a>
          </p>
          <h3>{t("reader.speakBrowser")}</h3>
          <div className="toolbar">
            <button
              type="button"
              className="btn ghost"
              data-testid="reader-speak-chapter"
              onClick={() => {
                stopPanshi();
                speakText(chapterPlainText());
              }}
            >
              {t("reader.speakChapter")}
            </button>
            <button
              type="button"
              className="btn ghost"
              data-testid="reader-speak-selection"
              onClick={() => {
                stopPanshi();
                speakText(selectionPlainText());
              }}
            >
              {t("reader.speakSelection")}
            </button>
          </div>
          {speakNote === "unsupported" && <p className="bible-hint">{t("reader.speakUnsupported")}</p>}
          {speakNote === "empty" && <p className="bible-hint">{t("reader.speakEmpty")}</p>}
        </div>
        </div>
      )}

      {(bookmarks.some((b) => b.book === bookId && b.chapter === chapterNum) ||
        decryptedNotes.some((n) => n.label.startsWith(`${bookId} ${chapterNum}:`))) && (
        <div className="bible-more-body" style={{ marginTop: "1.25rem" }}>
          {bookmarks.some((b) => b.book === bookId && b.chapter === chapterNum) && (
            <div className="bible-side-block" data-testid="reader-bookmark-list">
              <h2>{t("reader.bookmarkChapter")}</h2>
              <ul>
                {bookmarks
                  .filter((b) => b.book === bookId && b.chapter === chapterNum)
                  .map((b) => (
                    <li key={b.id} className="bible-bookmark-row">
                      <button
                        type="button"
                        className="bible-text-btn"
                        onClick={() =>
                          goToPassage(translationId, b.book, b.chapter, { verse: b.verse })
                        }
                      >
                        {passageTitle}:{b.verse}
                      </button>
                      <button
                        type="button"
                        className="bible-text-btn"
                        data-testid={`reader-bookmark-remove-${b.id}`}
                        onClick={() => void removeBookmark(b.id)}
                      >
                        {t("reader.removeBookmark")}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {decryptedNotes.some((n) => n.label.startsWith(`${bookId} ${chapterNum}:`)) && (
            <div className="bible-side-block">
              <h2>{t("reader.notesPanel")}</h2>
              <ul>
                {decryptedNotes
                  .filter((n) => n.label.startsWith(`${bookId} ${chapterNum}:`))
                  .map((n) => (
                    <li key={n.id}>
                      <strong>{n.label}</strong>
                      <p>{n.text}</p>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
