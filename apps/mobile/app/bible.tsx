import { Text, View, StyleSheet, ScrollView } from "react-native";
import { WEB_JOHN_1 } from "@logoshome/bible";
import { t } from "@logoshome/shared";

export default function BibleScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>{t("zh-CN", "nav.bible")}</Text>
      <Text style={styles.chapter}>John 1 (WEB)</Text>
      {WEB_JOHN_1.map((v) => (
        <Text key={v.verse} style={styles.verse}>
          <Text style={styles.num}>{v.verse} </Text>
          {v.text}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f3ea" },
  title: { fontSize: 28, fontWeight: "700", color: "#1c2b2a" },
  chapter: { marginVertical: 12, color: "#0f6b5c", fontWeight: "600" },
  verse: { fontSize: 18, lineHeight: 30, marginBottom: 12, color: "#1c2b2a" },
  num: { color: "#0f6b5c", fontSize: 12 },
});
