import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  TextInput,
} from "react-native";
import {
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
import { t } from "@logoshome/shared";
import { api, getApiBase, getToken, hydrateToken } from "../../src/api";
import {
  bibleLocalDb,
  ensureBootCorpusSeeded,
  installDownloadedPack,
  readLocalChapter,
} from "../../src/bible-local-db";
import { useLocale } from "../../src/locale";
import { decryptJson, encryptJson } from "../../src/note-crypto";
import {
  loadReaderSkin,
  READER_SKIN_IDS,
  readerSkinPalette,
  saveReaderSkin,
  type ReaderSkinId,
} from "../../src/reader-skins";
import { humanizeStatus } from "../../src/status";

type ChapterPayload = {
  translationId: string;
  book: string;
  chapter: number;
  verses: { verse: number; text: string }[];
  source: string;
};

type ExternalChapter = {
  external: true;
  url: string;
  meta: TranslationMeta;
  sso?: boolean;
};

type ChapterResponse = ChapterPayload | ExternalChapter;

type AnnotationRow = {
  id: string;
  kind: string;
  book: string;
  chapter: number;
  verseStart: number | null;
  color: string | null;
  ciphertext?: string;
  iv?: string;
  notePreview?: string;
};

function bookLocaleKey(lang: string): "zh" | "en" | "ja" {
  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("ja")) return "ja";
  return "en";
}

function isExternalChapter(data: ChapterResponse): data is ExternalChapter {
  return "external" in data && data.external === true;
}

export default function BibleScreen() {
  const { locale } = useLocale();
  const translations = listTranslations();
  const books = useMemo(() => listBooks(), []);
  const [translationId, setTranslationId] = useState("web");
  const [bookId, setBookId] = useState("John");
  const [chapterNum, setChapterNum] = useState(1);
  const [verses, setVerses] = useState<{ verse: number; text: string }[]>([]);
  const [chapterLabel, setChapterLabel] = useState("John 1");
  const [external, setExternal] = useState<ExternalChapter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [annMsg, setAnnMsg] = useState<string | null>(null);
  const [annBusy, setAnnBusy] = useState(false);
  const [annotations, setAnnotations] = useState<AnnotationRow[]>([]);
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.65);
  const [serif, setSerif] = useState(true);
  const [preset, setPreset] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [readerSkin, setReaderSkin] = useState<ReaderSkinId>("default");
  const [highlightByVerse, setHighlightByVerse] = useState<Record<number, string>>({});
  const [corpusHint, setCorpusHint] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [installedByTid, setInstalledByTid] = useState<
    Record<string, InstalledTranslationSummary>
  >({});
  const [downloadingTid, setDownloadingTid] = useState<string | null>(null);
  const corpusCatalog = useMemo(() => listDownloadableCorpusCatalog(), []);
  const skinPalette = readerSkinPalette(readerSkin);

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
    void loadReaderSkin().then(setReaderSkin);
  }, []);

  function applyPreset(id: "compact" | "comfortable" | "spacious") {
    const presets = {
      compact: { fontSize: 15, lineHeight: 1.35, serif: false },
      comfortable: { fontSize: 18, lineHeight: 1.65, serif: true },
      spacious: { fontSize: 22, lineHeight: 2.0, serif: true },
    } as const;
    const p = presets[id];
    setPreset(id);
    setFontSize(p.fontSize);
    setLineHeight(p.lineHeight);
    setSerif(p.serif);
  }
  const apiBase = getApiBase();
  const studyLang = bookLocaleKey(locale);
  const bookNameLocale = studyLang;
  const studyMaterials = useMemo(
    () => listStudyMaterials({ language: studyLang }),
    [studyLang],
  );
  const currentBook = getBook(bookId) ?? books.find((b) => b.id === "John") ?? books[0];
  const chapterOptions = useMemo(
    () => Array.from({ length: currentBook?.chapters ?? 1 }, (_, i) => i + 1),
    [currentBook?.chapters],
  );
  const ref = `${bookId}.${chapterNum}`;

  const refreshAnnotations = useCallback(async () => {
    await hydrateToken();
    if (!getApiBase() || !getToken()) {
      setAnnotations([]);
      setHighlightByVerse({});
      return;
    }
    try {
      const res = await api<{ annotations: AnnotationRow[] }>(
        `/v1/annotations?translation=${encodeURIComponent(translationId)}`,
      );
      const rows = res.annotations ?? [];
      const colorMap: Record<string, string> = {
        amber: "#f5d76e",
        mint: "#a8e6cf",
        rose: "#f8b4c4",
        sky: "#a8d8ea",
      };
      const highlights: Record<number, string> = {};
      const enriched: AnnotationRow[] = [];
      for (const row of rows) {
        let notePreview: string | undefined;
        if (row.kind === "note" && row.ciphertext && row.iv) {
          try {
            const payload = await decryptJson<{ text?: string }>(
              row.ciphertext,
              row.iv,
              "note",
            );
            notePreview = payload.text?.trim() || undefined;
          } catch {
            notePreview = undefined;
          }
        }
        enriched.push({ ...row, notePreview });
        if (
          row.kind === "highlight" &&
          row.book === bookId &&
          row.chapter === chapterNum &&
          row.verseStart != null
        ) {
          const raw = row.color ?? "amber";
          highlights[row.verseStart] = colorMap[raw] ?? (raw.startsWith("#") ? raw : "#f5d76e");
        }
      }
      setAnnotations(enriched);
      setHighlightByVerse(highlights);
    } catch {
      setAnnotations([]);
    }
  }, [translationId, bookId, chapterNum]);

  useEffect(() => {
    void refreshAnnotations();
  }, [refreshAnnotations]);

  useEffect(() => {
    if (!apiBase) return;
    void ensureBootCorpusSeeded(async (tid) => {
      try {
        // Boot must stay slim (teaching-set), even when R2 holds full PD WEB.
        const pack = await api<{
          chapters: { book: string; chapter: number; verses: { verse: number; text: string }[] }[];
          source?: string;
        }>(`/v1/bible/corpus-download/${encodeURIComponent(tid)}?scope=boot`);
        return { chapters: pack.chapters, source: pack.source };
      } catch {
        return null;
      }
    });
  }, [apiBase]);

  useEffect(() => {
    if (!apiBase) {
      setVerses([]);
      setChapterLabel("John 1");
      setExternal(null);
      setError("API offline — install a corpus pack or connect");
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const local = await readLocalChapter(translationId, bookId, chapterNum);
        if (local && !cancelled) {
          setExternal(null);
          setVerses(local.verses);
          setChapterLabel(`${local.book} ${local.chapter} (local-db)`);
          setError(null);
          setLoading(false);
          return;
        }
        const data = await api<ChapterResponse>(
          `/v1/bible/chapter?translation=${encodeURIComponent(translationId)}&ref=${encodeURIComponent(ref)}`,
        );
        if (cancelled) return;
        if (isExternalChapter(data)) {
          setExternal(data);
          setVerses([]);
          setChapterLabel(data.meta.name[locale] ?? data.meta.abbreviation);
          setError(null);
        } else if ("verses" in data) {
          setExternal(null);
          setVerses(data.verses);
          setChapterLabel(`${data.book} ${data.chapter}`);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setExternal(null);
          setVerses([]);
          setChapterLabel(`${bookId} ${chapterNum}`);
          setError(e instanceof Error ? e.message : "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBase, translationId, ref, locale, bookId, chapterNum]);

  useEffect(() => {
    if (!apiBase) {
      setCorpusHint(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const installed = await bibleLocalDb.listInstalled();
        const localRow = installed.find((r) => r.translationId === translationId);
        if (cancelled) return;
        if (localRow) {
          const hasChapter = localRow.chapterRefs.includes(ref);
          setCorpusHint(
            hasChapter
              ? `${t(locale, "reader.corpusLocalDb")} · ${localRow.chapterCount}`
              : `${t(locale, "reader.corpusPartial")} · ${localRow.chapterCount}`,
          );
          return;
        }
        const res = await api<{
          catalog?: Array<{
            translationId: string;
            installMode: "boot" | "download" | "external";
            chapterRefs: string[];
          }>;
        }>("/v1/bible/corpus-catalog");
        if (cancelled) return;
        const entry = res.catalog?.find((p) => p.translationId === translationId);
        if (entry?.installMode === "download") {
          setCorpusHint(t(locale, "reader.corpusDownloadable"));
        } else if (entry?.installMode === "external") {
          setCorpusHint(t(locale, "reader.corpusExternal"));
        } else if (entry?.installMode === "boot") {
          setCorpusHint(t(locale, "reader.corpusBootPending"));
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
  }, [apiBase, translationId, ref, locale]);

  function openExternalPartner() {
    if (!external) return;
    const partner = external.meta.ssoFlag;
    const href =
      partner && isPartnerId(partner)
        ? buildPartnerAuthUrl(partner, {
            ref,
            ssoEnabled: Boolean(external.sso) || external.url.includes("sso=1"),
          })
        : external.url;
    void Linking.openURL(href);
  }

  async function requireAuth(): Promise<boolean> {
    await hydrateToken();
    if (!getApiBase()) {
      setAnnMsg("EXPO_PUBLIC_API_BASE not set");
      return false;
    }
    if (!getToken()) {
      setAnnMsg("login_required");
      return false;
    }
    return true;
  }

  async function addBookmark() {
    setAnnBusy(true);
    setAnnMsg(null);
    try {
      if (!(await requireAuth())) return;
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
      setAnnMsg("saved");
      await refreshAnnotations();
    } catch (e) {
      setAnnMsg(e instanceof Error ? e.message : "error");
    } finally {
      setAnnBusy(false);
    }
  }

  async function addHighlight(color: string) {
    setAnnBusy(true);
    setAnnMsg(null);
    try {
      if (!(await requireAuth())) return;
      const verse = selectedVerse ?? 1;
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
      setAnnMsg("saved");
      await refreshAnnotations();
    } catch (e) {
      setAnnMsg(e instanceof Error ? e.message : "error");
    } finally {
      setAnnBusy(false);
    }
  }

  async function saveNote() {
    setAnnBusy(true);
    setAnnMsg(null);
    try {
      if (!(await requireAuth())) return;
      if (selectedVerse == null || !noteText.trim()) return;
      const { ciphertext, iv } = await encryptJson({ text: noteText.trim() }, "note");
      await api("/v1/annotations", {
        method: "POST",
        body: JSON.stringify({
          translationId,
          ref: {
            book: bookId,
            chapter: chapterNum,
            verseStart: selectedVerse,
            verseEnd: selectedVerse,
          },
          kind: "note",
          ciphertext,
          iv,
        }),
      });
      setNoteText("");
      setAnnMsg("saved");
      await refreshAnnotations();
    } catch (e) {
      setAnnMsg(e instanceof Error ? e.message : "error");
    } finally {
      setAnnBusy(false);
    }
  }

  async function deleteAnnotation(id: string) {
    setAnnBusy(true);
    setAnnMsg(null);
    try {
      if (!(await requireAuth())) return;
      await api(`/v1/annotations/${id}`, { method: "DELETE" });
      setAnnMsg("deleted");
      await refreshAnnotations();
    } catch (e) {
      setAnnMsg(e instanceof Error ? e.message : "error");
    } finally {
      setAnnBusy(false);
    }
  }

  async function downloadCorpusPack(targetTid = translationId) {
    if (!apiBase) {
      setAnnMsg("EXPO_PUBLIC_API_BASE not set");
      return;
    }
    setAnnBusy(true);
    setDownloadingTid(targetTid);
    setAnnMsg(null);
    try {
      let after: string | null = null;
      let installedTotal = 0;
      let pages = 0;
      let finished = false;
      while (!finished) {
        const qs =
          "scope=full&limit=100" + (after ? `&after=${encodeURIComponent(after)}` : "");
        type PackPage = {
          chapters: { book: string; chapter: number; verses: { verse: number; text: string }[] }[];
          source?: string;
          done?: boolean;
          nextAfter?: string | null;
          totalChapterKeys?: number;
        };
        const pack: PackPage = await api(
          `/v1/bible/corpus-download/${encodeURIComponent(targetTid)}?${qs}`,
        );
        if (!pack.chapters?.length && pages === 0) {
          setAnnMsg("corpus_download_empty");
          return;
        }
        if (pack.chapters?.length) {
          const { installed } = await installDownloadedPack(targetTid, pack.chapters);
          installedTotal += installed;
        }
        pages += 1;
        setAnnMsg(
          `corpus_installed:${installedTotal}${pack.totalChapterKeys ? `/${pack.totalChapterKeys}` : ""}`,
        );
        if (pack.done !== false || !pack.nextAfter) {
          finished = true;
        } else {
          after = pack.nextAfter;
        }
      }
      await refreshInstalledCorpus();
      if (targetTid === translationId) {
        setCorpusHint(`${t(locale, "reader.corpusLocalDb")} · ${installedTotal}`);
        const local = await readLocalChapter(translationId, bookId, chapterNum);
        if (local) {
          setExternal(null);
          setVerses(local.verses);
          setChapterLabel(`${local.book} ${local.chapter} (local-db)`);
        }
      }
    } catch (e) {
      setAnnMsg(e instanceof Error ? e.message : "error");
    } finally {
      setAnnBusy(false);
      setDownloadingTid(null);
    }
  }

  function catalogModeLabel(mode: DownloadableCorpusPack["installMode"]): string {
    if (mode === "boot") return t(locale, "reader.corpusCatalogBoot");
    if (mode === "download") return t(locale, "reader.corpusCatalogDownload");
    return t(locale, "reader.corpusCatalogExternal");
  }

  const externalLabel =
    external?.meta.ssoFlag === "endao"
      ? t(locale, "reader.external.endao")
      : t(locale, "reader.external.weread");

  const chapterAnnotations = annotations.filter(
    (a) => a.book === bookId && a.chapter === chapterNum,
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t(locale, "nav.bible")}</Text>
      <Text style={styles.muted}>{t(locale, "app.tagline")}</Text>

      <Text style={styles.label}>{t(locale, "reader.translations")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
        {translations.map((tr) => {
          const active = tr.id === translationId;
          return (
            <Pressable
              key={tr.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setTranslationId(tr.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {tr.name[locale] ?? tr.abbreviation}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {corpusHint ? (
        <Text style={styles.muted} testID="reader-corpus-hint">
          {corpusHint}
        </Text>
      ) : null}
      <View style={styles.annActions}>
        <Pressable
          style={[styles.btn, styles.btnGhost, showCatalog && styles.chipActive]}
          testID="reader-corpus-catalog-toggle"
          onPress={() => setShowCatalog((v) => !v)}
        >
          <Text style={[styles.btnGhostText, showCatalog && styles.chipTextActive]}>
            {t(locale, "reader.corpusCatalog")}
          </Text>
        </Pressable>
      </View>
      {showCatalog ? (
        <View style={styles.catalogPanel} testID="reader-corpus-catalog">
          <Text style={styles.section}>{t(locale, "reader.corpusCatalog")}</Text>
          <Text style={styles.muted}>{t(locale, "reader.corpusCatalogHint")}</Text>
          {corpusCatalog.map((pack) => {
            const installed = installedByTid[pack.translationId];
            const busy = downloadingTid === pack.translationId;
            const active = pack.translationId === translationId;
            return (
              <View
                key={pack.translationId}
                style={styles.catalogRow}
                testID={`corpus-catalog-row-${pack.translationId}`}
              >
                <View style={styles.catalogMeta}>
                  <Text style={styles.catalogTitle}>
                    {pack.name[locale] ?? pack.translationId}
                    {active ? " · ★" : ""}
                  </Text>
                  <Text style={styles.muted}>
                    {catalogModeLabel(pack.installMode)}
                    {installed
                      ? ` · ${t(locale, "reader.corpusCatalogInstalled")} ${installed.chapterCount} ${t(locale, "reader.corpusCatalogChapters")}`
                      : pack.installMode !== "external"
                        ? ` · ${pack.chapterRefs.length} ${t(locale, "reader.corpusCatalogChapters")}`
                        : ""}
                    {pack.fullPackAvailable && pack.fullPackChapterCount
                      ? ` · ${t(locale, "reader.corpusCatalogFullPack")} ${pack.fullPackChapterCount}`
                      : ""}
                  </Text>
                </View>
                <View style={styles.catalogActions}>
                  {pack.installMode !== "external" ? (
                    <Pressable
                      style={[styles.btn, styles.btnGhost, (busy || annBusy) && styles.btnDisabled]}
                      disabled={busy || annBusy}
                      testID={`corpus-catalog-download-${pack.translationId}`}
                      onPress={() => void downloadCorpusPack(pack.translationId)}
                    >
                      <Text style={styles.btnGhostText}>
                        {busy
                          ? t(locale, "reader.corpusCatalogDownloading")
                          : pack.fullPackAvailable
                            ? t(locale, "reader.corpusDownloadFull")
                            : t(locale, "reader.corpusDownload")}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[styles.btn, styles.btnGhost]}
                    testID={`corpus-catalog-open-${pack.translationId}`}
                    onPress={() => {
                      setTranslationId(pack.translationId);
                      setShowCatalog(false);
                    }}
                  >
                    <Text style={styles.btnGhostText}>
                      {t(locale, "reader.corpusCatalogOpen")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.label}>{t(locale, "reader.book")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
        {books
          .filter((b) => b.testament === "nt")
          .map((b) => {
            const active = b.id === bookId;
            return (
              <Pressable
                key={b.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  setBookId(b.id);
                  setChapterNum(1);
                  setSelectedVerse(null);
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {b.name[bookNameLocale]}
                </Text>
              </Pressable>
            );
          })}
      </ScrollView>

      <Text style={styles.label}>{t(locale, "reader.chapter")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
        {chapterOptions.slice(0, 28).map((n) => {
          const active = n === chapterNum;
          return (
            <Pressable
              key={n}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setChapterNum(n);
                setSelectedVerse(null);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.chapter}>{chapterLabel}</Text>
      <Text style={styles.label}>{t(locale, "reader.typography")}</Text>
      <View style={styles.annActions}>
        {(
          [
            ["compact", "reader.presetCompact"],
            ["comfortable", "reader.presetComfortable"],
            ["spacious", "reader.presetSpacious"],
          ] as const
        ).map(([id, key]) => (
          <Pressable
            key={id}
            style={[styles.btn, styles.btnGhost, preset === id && styles.chipActive]}
            onPress={() => applyPreset(id)}
          >
            <Text style={[styles.btnGhostText, preset === id && styles.chipTextActive]}>
              {t(locale, key)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.annActions}>
        <Pressable
          style={[styles.btn, styles.btnGhost]}
          onPress={() => setFontSize((s) => Math.max(14, s - 2))}
        >
          <Text style={styles.btnGhostText}>A−</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnGhost]}
          onPress={() => setFontSize((s) => Math.min(28, s + 2))}
        >
          <Text style={styles.btnGhostText}>A+</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnGhost, serif && styles.chipActive]}
          onPress={() => setSerif(true)}
        >
          <Text style={[styles.btnGhostText, serif && styles.chipTextActive]}>
            {t(locale, "reader.serif")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnGhost, !serif && styles.chipActive]}
          onPress={() => setSerif(false)}
        >
          <Text style={[styles.btnGhostText, !serif && styles.chipTextActive]}>
            {t(locale, "reader.sans")}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.label}>{t(locale, "reader.skin")}</Text>
      <View style={styles.annActions}>
        {READER_SKIN_IDS.map((id) => (
          <Pressable
            key={id}
            style={[styles.btn, styles.btnGhost, readerSkin === id && styles.chipActive]}
            onPress={() => {
              setReaderSkin(id);
              void saveReaderSkin(id);
            }}
          >
            <Text style={[styles.btnGhostText, readerSkin === id && styles.chipTextActive]}>
              {t(locale, `reader.skin.${id}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>
        {t(locale, "reader.lineHeight")}: {lineHeight.toFixed(2)}
      </Text>
      <View style={styles.annActions}>
        <Pressable
          style={[styles.btn, styles.btnGhost]}
          onPress={() => setLineHeight((h) => Math.max(1.2, Math.round((h - 0.1) * 100) / 100))}
        >
          <Text style={styles.btnGhostText}>LH−</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnGhost]}
          onPress={() => setLineHeight((h) => Math.min(2.4, Math.round((h + 0.1) * 100) / 100))}
        >
          <Text style={styles.btnGhostText}>LH+</Text>
        </Pressable>
      </View>
      {loading && <ActivityIndicator color="#0f6b5c" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {external ? (
        <View style={styles.externalBlock}>
          <Text style={styles.muted}>{external.meta.name[locale] ?? external.meta.abbreviation}</Text>
          <Pressable style={[styles.btn, { marginTop: 12 }]} onPress={openExternalPartner}>
            <Text style={styles.btnText}>{externalLabel}</Text>
          </Pressable>
        </View>
      ) : (
        verses.map((v) => {
          const selected = selectedVerse === v.verse;
          const hl = highlightByVerse[v.verse];
          return (
            <Pressable
              key={v.verse}
              onPress={() => setSelectedVerse(v.verse)}
              style={[
                styles.verseRow,
                { backgroundColor: skinPalette.readerBg },
                selected && styles.verseSelected,
                hl ? { backgroundColor: hl } : null,
              ]}
            >
              <Text
                style={[
                  styles.verse,
                  {
                    fontSize,
                    lineHeight: fontSize * lineHeight,
                    fontFamily: serif ? "Georgia" : "Helvetica Neue",
                    color: skinPalette.verseColor,
                  },
                ]}
              >
                <Text style={[styles.num, { color: skinPalette.verseNum }]}>{v.verse} </Text>
                {v.text}
              </Text>
            </Pressable>
          );
        })
      )}

      {!external && (
        <View style={styles.annBlock}>
          <Text style={styles.section}>{t(locale, "reader.notesPanel")}</Text>
          <Text style={styles.muted}>
            {selectedVerse != null
              ? `${bookId} ${chapterNum}:${selectedVerse}`
              : t(locale, "reader.note")}
          </Text>
          <View style={styles.annActions}>
            <Pressable
              style={[styles.btn, styles.btnGhost, annBusy && styles.btnDisabled]}
              disabled={annBusy}
              onPress={() => void addBookmark()}
            >
              <Text style={styles.btnGhostText}>{t(locale, "reader.bookmark")}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.btnGhost,
                (annBusy || downloadingTid === translationId) && styles.btnDisabled,
              ]}
              disabled={annBusy || downloadingTid === translationId}
              testID="reader-corpus-download"
              onPress={() => void downloadCorpusPack()}
            >
              <Text style={styles.btnGhostText}>
                {downloadingTid === translationId
                  ? t(locale, "reader.corpusCatalogDownloading")
                  : t(locale, "reader.corpusDownload")}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.label}>{t(locale, "reader.highlight")}</Text>
          <View style={styles.annActions}>
            {(
              [
                { id: "amber", value: "#f5d76e" },
                { id: "mint", value: "#a8e6cf" },
                { id: "rose", value: "#f8b4c4" },
                { id: "sky", value: "#a8d8ea" },
              ] as const
            ).map((c) => (
              <Pressable
                key={c.id}
                style={[
                  styles.swatch,
                  { backgroundColor: c.value },
                  annBusy && styles.btnDisabled,
                ]}
                disabled={annBusy}
                onPress={() => void addHighlight(c.id)}
                accessibilityLabel={`${t(locale, "reader.highlight")} ${c.id}`}
              />
            ))}
          </View>
          {selectedVerse != null && (
            <>
              <TextInput
                style={styles.noteInput}
                multiline
                value={noteText}
                onChangeText={setNoteText}
                placeholder={t(locale, "reader.note")}
                placeholderTextColor="#8a9a98"
              />
              <Pressable
                style={[styles.btn, { marginTop: 8 }, annBusy && styles.btnDisabled]}
                disabled={annBusy || !noteText.trim()}
                onPress={() => void saveNote()}
              >
                <Text style={styles.btnText}>{t(locale, "reader.saveNote")}</Text>
              </Pressable>
            </>
          )}
          {annMsg && (
            <Text style={styles.annStatus}>{humanizeStatus(locale, annMsg) ?? annMsg}</Text>
          )}
          {chapterAnnotations.length > 0 && (
            <View style={{ marginTop: 12 }}>
              {chapterAnnotations.map((a) => (
                <View key={a.id} style={styles.annItemRow}>
                  <Text style={styles.annItem}>
                    {a.kind} · {a.book} {a.chapter}:{a.verseStart ?? "?"}
                    {a.notePreview ? ` — ${a.notePreview}` : ""}
                  </Text>
                  <Pressable
                    style={[styles.btn, styles.btnGhost, styles.btnDelete, annBusy && styles.btnDisabled]}
                    disabled={annBusy}
                    onPress={() => void deleteAnnotation(a.id)}
                  >
                    <Text style={styles.btnGhostText}>
                      {locale.startsWith("zh") ? "删除" : locale.startsWith("ja") ? "削除" : "Delete"}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <Text style={[styles.section, { marginTop: 28 }]}>{t(locale, "reader.study")}</Text>
      {studyMaterials.map((m) => (
        <Pressable key={m.id} style={styles.studyItem} onPress={() => void Linking.openURL(m.url)}>
          <Text style={styles.studyTitle}>{m.title}</Text>
          <Text style={styles.muted}>{m.license}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f3ea" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", color: "#1c2b2a" },
  muted: { marginTop: 4, color: "#5a6a68", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#5a6a68", marginBottom: 8 },
  section: { fontSize: 18, fontWeight: "600", color: "#1c2b2a", marginBottom: 8 },
  pickerRow: { marginBottom: 12, maxHeight: 44 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#e8e2d4",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#0f6b5c" },
  chipText: { color: "#1c2b2a", fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  chapter: { marginVertical: 12, color: "#0f6b5c", fontWeight: "600" },
  error: { color: "#a33", marginBottom: 8 },
  verseRow: { marginBottom: 4, borderRadius: 4, paddingHorizontal: 4 },
  verseSelected: { backgroundColor: "#dceee9" },
  verse: { fontSize: 18, lineHeight: 30, marginBottom: 8, color: "#1c2b2a" },
  num: { color: "#0f6b5c", fontSize: 12 },
  externalBlock: { marginBottom: 12 },
  btn: {
    backgroundColor: "#0f6b5c",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  btnGhost: {
    backgroundColor: "#e8e2d4",
    marginRight: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  btnGhostText: { color: "#1c2b2a", fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600" },
  annBlock: { marginTop: 20 },
  annActions: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  noteInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: "#cfc7b6",
    borderRadius: 8,
    padding: 10,
    color: "#1c2b2a",
    backgroundColor: "#fff",
    textAlignVertical: "top",
  },
  annStatus: { marginTop: 8, color: "#0f6b5c", fontWeight: "600" },
  annItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
  },
  annItem: { flex: 1, color: "#5a6a68", fontSize: 13 },
  btnDelete: { marginRight: 0, paddingVertical: 6, paddingHorizontal: 10 },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#cfc7b6",
  },
  studyItem: { marginTop: 10 },
  studyTitle: { color: "#0f6b5c", fontWeight: "600", fontSize: 16 },
  catalogPanel: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#efe9db",
  },
  catalogRow: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#cfc7b6",
  },
  catalogMeta: { marginBottom: 8 },
  catalogTitle: { color: "#1c2b2a", fontWeight: "700", fontSize: 15 },
  catalogActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
