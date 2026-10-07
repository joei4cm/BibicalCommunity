import { useEffect, useMemo, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import {
  buildPartnerAuthUrl,
  isPartnerId,
  listStudyMaterials,
  listTranslations,
  WEB_JOHN_1,
  type TranslationMeta,
} from "@logoshome/bible";
import { t } from "@logoshome/shared";
import { api, getApiBase } from "../../src/api";
import { useLocale } from "../../src/locale";

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
  const [translationId, setTranslationId] = useState("web");
  const [verses, setVerses] = useState(WEB_JOHN_1);
  const [chapterLabel, setChapterLabel] = useState("John 1");
  const [external, setExternal] = useState<ExternalChapter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = getApiBase();
  const studyLang = bookLocaleKey(locale);
  const studyMaterials = useMemo(
    () => listStudyMaterials({ language: studyLang }),
    [studyLang],
  );

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
          `/v1/bible/chapter?translation=${encodeURIComponent(translationId)}&ref=${encodeURIComponent("John.1")}`,
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
  }, [apiBase, translationId, locale]);

  function openExternalPartner() {
    if (!external) return;
    const partner = external.meta.ssoFlag;
    const href =
      partner && isPartnerId(partner)
        ? buildPartnerAuthUrl(partner, {
            ref: external.meta.id,
            ssoEnabled: Boolean(external.sso) || external.url.includes("sso=1"),
          })
        : external.url;
    void Linking.openURL(href);
  }

  const externalLabel =
    external?.meta.ssoFlag === "endao"
      ? t(locale, "reader.external.endao")
      : t(locale, "reader.external.weread");

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
        verses.map((v) => (
          <Text key={v.verse} style={styles.verse}>
            <Text style={styles.num}>{v.verse} </Text>
            {v.text}
          </Text>
        ))
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
  verse: { fontSize: 18, lineHeight: 30, marginBottom: 12, color: "#1c2b2a" },
  num: { color: "#0f6b5c", fontSize: 12 },
  externalBlock: { marginBottom: 12 },
  btn: {
    backgroundColor: "#0f6b5c",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  studyItem: { marginTop: 10 },
  studyTitle: { color: "#0f6b5c", fontWeight: "600", fontSize: 16 },
});
