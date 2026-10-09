import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { getBook, parsePlanCsv, parseRef } from "@logoshome/bible";
import { t } from "@logoshome/shared";
import {
  DEVOTION_STEPS,
  devotionProgress,
  nextStep,
  type DevotionStep,
} from "../../src/devotion";
import { api, getApiBase, getToken, hydrateToken } from "../../src/api";
import { useLocale } from "../../src/locale";
import { humanizeStatus } from "../../src/status";

type PlanRow = {
  id: string;
  title: string;
  visibility?: string;
  dayCount?: number;
};

type PlanDay = { day: number; ref: string; title?: string; note?: string };

type Subscription = {
  subscriptionId?: string;
  planId: string;
  title?: string;
  progressDay: number;
  devotionStep?: DevotionStep;
  devotionMaterialId?: string | null;
  days?: PlanDay[];
};

export default function PlansScreen() {
  const { locale } = useLocale();
  const router = useRouter();
  const [csv, setCsv] = useState("day,ref,title,note\n1,John.1,Word,Begin\n2,John.2,Wedding,");
  const [step, setStep] = useState<DevotionStep>("pause");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<PlanRow[]>([]);
  const [publicPlans, setPublicPlans] = useState<PlanRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const progress = devotionProgress(step);
  const apiConfigured = Boolean(getApiBase());
  const activeSub = subscriptions[0] ?? null;
  const todayDay = useMemo(() => {
    if (!activeSub) return null;
    const dayNum = (activeSub.progressDay ?? 0) + 1;
    return (activeSub.days ?? []).find((d) => d.day === dayNum) ?? null;
  }, [activeSub]);

  function openTodayReading() {
    if (!todayDay) return;
    const parsed = parseRef(todayDay.ref);
    if (!parsed) return;
    const book = getBook(parsed.book);
    const bookId = book?.id ?? parsed.book;
    router.push({
      pathname: "/(tabs)/bible",
      params: {
        book: bookId,
        chapter: String(parsed.chapter),
        ...(parsed.verseStart ? { verse: String(parsed.verseStart) } : {}),
      },
    });
  }

  const refreshLists = useCallback(async () => {
    await hydrateToken();
    if (!getApiBase() || !getToken()) {
      setMine([]);
      setPublicPlans([]);
      setSubscriptions([]);
      return;
    }
    try {
      const owned = await api<{ plans: PlanRow[] }>("/v1/plans");
      setMine(owned.plans ?? []);
    } catch {
      setMine([]);
    }
    try {
      const pub = await api<{ plans: PlanRow[] }>("/v1/plans/public");
      setPublicPlans(pub.plans ?? []);
    } catch {
      setPublicPlans([]);
    }
    try {
      const subs = await api<{ subscriptions: Subscription[] }>("/v1/plans/subscriptions");
      setSubscriptions(subs.subscriptions ?? []);
    } catch {
      setSubscriptions([]);
    }
  }, []);

  useEffect(() => {
    void refreshLists().catch(() => undefined);
  }, [refreshLists]);

  useEffect(() => {
    const sub = subscriptions[0];
    if (sub?.devotionStep && DEVOTION_STEPS.includes(sub.devotionStep)) {
      setStep(sub.devotionStep);
    }
  }, [subscriptions]);

  async function persistDevotion(next: DevotionStep) {
    setStep(next);
    const planId = subscriptions[0]?.planId;
    if (!planId || !getToken()) return;
    try {
      await api(`/v1/plans/${planId}/devotion`, {
        method: "POST",
        body: JSON.stringify({ step: next }),
      });
      setSubscriptions((prev) =>
        prev.map((s) => (s.planId === planId ? { ...s, devotionStep: next } : s)),
      );
    } catch {
      // Keep local step; list refresh will reconcile.
    }
  }

  function advance() {
    const next = nextStep(step);
    if (next) void persistDevotion(next);
  }

  async function importCsv() {
    setBusy(true);
    setMessage(null);
    try {
      await hydrateToken();
      if (!getApiBase()) {
        setMessage("api_base_required");
        return;
      }
      if (!getToken()) {
        setMessage("login_required");
        return;
      }
      const days = parsePlanCsv(csv);
      const res = await api<{ id: string }>("/v1/plans", {
        method: "POST",
        body: JSON.stringify({
          title: "CSV Plan",
          visibility: "private",
          days,
        }),
      });
      setMessage(`created:${res.id} (${days.length} days)`);
      await refreshLists();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function subscribe(planId: string) {
    setBusy(true);
    setMessage(null);
    try {
      await hydrateToken();
      if (!getToken()) {
        setMessage("login_required");
        return;
      }
      await api(`/v1/plans/${planId}/subscribe`, { method: "POST", body: "{}" });
      setMessage("saved");
      await refreshLists();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function advancePlanDay(planId: string, currentDay: number) {
    setBusy(true);
    setMessage(null);
    try {
      await hydrateToken();
      if (!getToken()) {
        setMessage("login_required");
        return;
      }
      const next = currentDay + 1;
      await api(`/v1/plans/${planId}/progress`, {
        method: "POST",
        body: JSON.stringify({ day: next }),
      });
      setMessage(`progress:day ${next}`);
      await refreshLists();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t(locale, "nav.plans")}</Text>

      <Text style={styles.section}>{t(locale, "plans.owned")}</Text>
      {mine.length === 0 && <Text style={styles.muted}>—</Text>}
      {mine.map((p) => (
        <View key={p.id} style={styles.card}>
          <Text style={styles.cardTitle}>{p.title}</Text>
          <Text style={styles.muted}>{p.id}</Text>
        </View>
      ))}

      <Text style={styles.section}>{t(locale, "plans.public")}</Text>
      {publicPlans.length === 0 && <Text style={styles.muted}>—</Text>}
      {publicPlans.map((p) => (
        <View key={p.id} style={styles.card}>
          <Text style={styles.cardTitle}>{p.title}</Text>
          <Pressable
            style={[styles.btn, { marginTop: 8 }, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void subscribe(p.id)}
          >
            <Text style={styles.btnText}>{t(locale, "plans.subscribe")}</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.section}>{t(locale, "plans.subscriptions")}</Text>
      {todayDay && (
        <Pressable
          style={styles.todayCard}
          onPress={openTodayReading}
          testID="plans-today-ref-link"
        >
          <Text style={styles.muted}>{t(locale, "plans.todayReading")}</Text>
          <Text style={styles.todayRef}>
            {todayDay.ref}
            {todayDay.title ? ` · ${todayDay.title}` : ""}
          </Text>
        </Pressable>
      )}
      {subscriptions.length === 0 && <Text style={styles.muted}>—</Text>}
      {subscriptions.map((s) => (
        <View key={s.subscriptionId ?? s.planId} style={styles.card}>
          <Text style={styles.cardTitle}>{s.title ?? s.planId}</Text>
          <Text style={styles.muted}>
            {s.planId} · day {s.progressDay}
          </Text>
          <Pressable
            style={[styles.btn, { marginTop: 8 }, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void advancePlanDay(s.planId, s.progressDay)}
          >
            <Text style={styles.btnText}>{t(locale, "plans.advanceDay")}</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.section}>{t(locale, "plans.importCsv")}</Text>
      <TextInput
        style={styles.input}
        multiline
        value={csv}
        onChangeText={setCsv}
        placeholder="day,ref,title,note"
        textAlignVertical="top"
      />
      {apiConfigured ? (
        <Pressable
          style={[styles.btn, { marginTop: 12 }, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => void importCsv()}
        >
          <Text style={styles.btnText}>{t(locale, "plans.create")}</Text>
        </Pressable>
      ) : (
        <Text style={styles.muted}>CSV paste stub — set server URL on Me to create via API.</Text>
      )}
      {message && <Text style={styles.muted}>{humanizeStatus(locale, message)}</Text>}

      <Text style={[styles.section, { marginTop: 24 }]}>Devotion</Text>
      <Text style={styles.muted}>
        {progress.index + 1} / {progress.total}
        {progress.done ? " · done" : ""}
      </Text>
      <View style={styles.steps}>
        {DEVOTION_STEPS.map((s, i) => {
          const state = i < progress.index ? "done" : i === progress.index ? "current" : "todo";
          return (
            <Pressable
              key={s}
              style={[
                styles.step,
                state === "current" && styles.stepCurrent,
                state === "done" && styles.stepDone,
              ]}
              onPress={() => void persistDevotion(s)}
            >
              <Text style={styles.stepText}>
                {i + 1}. {t(locale, `devotion.${s}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={advance} disabled={progress.done}>
          <Text style={styles.btnText}>{progress.done ? "✓" : "→"}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnGhost]}
          onPress={() => void persistDevotion("pause")}
        >
          <Text style={[styles.btnText, styles.btnGhostText]}>Reset</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3efe6" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", color: "#1c2b2a" },
  section: { marginTop: 16, fontSize: 18, fontWeight: "600", color: "#1c2b2a" },
  muted: { marginTop: 8, color: "#5a6a68", lineHeight: 22 },
  card: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cfc6b4",
    backgroundColor: "#fffdf8",
  },
  cardTitle: { fontWeight: "700", color: "#1c2b2a" },
  todayCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0f6b5c",
    backgroundColor: "#fffdf8",
  },
  todayRef: { marginTop: 4, fontWeight: "700", color: "#0f6b5c", fontSize: 16 },
  input: {
    marginTop: 10,
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#cfc6b4",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    color: "#1c2b2a",
    fontSize: 14,
  },
  steps: { marginTop: 12, gap: 8 },
  step: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#e8e2d4",
  },
  stepCurrent: { backgroundColor: "#0f6b5c" },
  stepDone: { backgroundColor: "#9bb8b2" },
  stepText: { color: "#1c2b2a", fontWeight: "600" },
  row: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: {
    backgroundColor: "#0f6b5c",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#0f6b5c" },
  btnText: { color: "#fff", fontWeight: "600" },
  btnGhostText: { color: "#0f6b5c" },
});
