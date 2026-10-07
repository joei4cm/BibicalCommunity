import { Text, View, StyleSheet } from "react-native";
import { t } from "@logoshome/shared";

export default function PlansScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t("zh-CN", "nav.plans")}</Text>
      <Text style={styles.body}>CSV import & devotion steps share @logoshome/bible with web.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3efe6", padding: 20 },
  title: { fontSize: 28, fontWeight: "700" },
  body: { marginTop: 12, color: "#5a6a68", lineHeight: 22 },
});
