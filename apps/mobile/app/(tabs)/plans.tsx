import { useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { t } from "@logoshome/shared";
import {
  DEVOTION_STEPS,
  devotionProgress,
  nextStep,
  type DevotionStep,
} from "../../src/devotion";
import { useLocale } from "../../src/locale";

export default function PlansScreen() {
  const { locale } = useLocale();
  const [csv, setCsv] = useState("day,ref,title,note\n1,John.1,Word,Begin\n2,John.2,Wedding,");
  const [step, setStep] = useState<DevotionStep>("pause");
  const progress = devotionProgress(step);

  function advance() {
    const next = nextStep(step);
    if (next) setStep(next);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t(locale, "nav.plans")}</Text>

      <Text style={styles.section}>{t(locale, "plans.importCsv")}</Text>
      <TextInput
        style={styles.input}
        multiline
        value={csv}
        onChangeText={setCsv}
        placeholder="day,ref,title,note"
        textAlignVertical="top"
      />
      <Text style={styles.muted}>CSV paste stub — wire import when API base is configured.</Text>

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
              onPress={() => setStep(s)}
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
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setStep("pause")}>
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
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#0f6b5c" },
  btnText: { color: "#fff", fontWeight: "600" },
  btnGhostText: { color: "#0f6b5c" },
});
