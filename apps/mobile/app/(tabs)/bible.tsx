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
  listStudyMaterials,
  listTranslations,
  WEB_JOHN_1,
  type TranslationMeta,
} from "@logoshome/bible";
import { t } from "@logoshome/shared";
import { api, getApiBase, getToken, hydrateToken } from "../../src/api";
import { useLocale } from "../../src/locale";
import { encryptJson } from "../../src/note-crypto";
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
  const [verses, setVerses] = useState(WEB_JOHN_1);
  const [chapterLabel, setChapterLabel] = useState("John 1");
  const [external, setExternal] = useState<ExternalChapter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [annMsg, setAnnMsg] = useState<string | null>(null);
  const [annBusy, setAnnBusy] = useState(false);
  const [annotations, setAnnotations] = useState<AnnotationRow[]>([]);
  const [highlightByVerse, setHighlightByVerse] = useState<Record<number, string>>({});
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
      setAnnotations(rows);
      const colorMap: Record<string, string> = {
        amber: "#f5d76e",
        mint: "#a8e6cf",
        rose: "#f8b4c4",
        sky: "#a8d8ea",
      };
      const highlights: Record<number, string> = {};
      for (const row of rows) {
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
      setHighlightByVerse(highlights);
    } catch {
      setAnnotations([]);
    }
  }, [translationId, bookId, chapterNum]);

  useEffect(() => {
    void refreshAnnotations();
  }, [refreshAnnotations]);

  useEffect(() => {
    if (!apiBase) {
      setVerses(WEB_JOHN_1);
      setChapterLabel("John 1 (WEB)");
      setExternal(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
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
          setVerses(WEB_JOHN_1);
          setChapterLabel("John 1 (WEB fallback)");
          setError(e instanceof Error ? e.message : "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
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

  async function addHighlight() {
    setAnnBusy(true);
    setAnnMsg(null);
    try {
      if (!(await requireAuth())) return;
      const verse = selectedVerse ?? 1;
      const color = "amber";
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
                selected && styles.verseSelected,
                hl ? { backgroundColor: hl } : null,
              ]}
            >
              <Text style={styles.verse}>
                <Text style={styles.num}>{v.verse} </Text>
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
              style={[styles.btn, styles.btnGhost, annBusy && styles.btnDisabled]}
              disabled={annBusy}
              onPress={() => void addHighlight()}
            >
              <Text style={styles.btnGhostText}>{t(locale, "reader.highlight")}</Text>
            </Pressable>
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
                <Text key={a.id} style={styles.annItem}>
                  {a.kind} · {a.book} {a.chapter}:{a.verseStart ?? "?"}
                </Text>
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
  annItem: { color: "#5a6a68", marginTop: 4, fontSize: 13 },
  studyItem: { marginTop: 10 },
  studyTitle: { color: "#0f6b5c", fontWeight: "600", fontSize: 16 },
});
