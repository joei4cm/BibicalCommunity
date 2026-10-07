import { Text, View, StyleSheet, Pressable } from "react-native";
import { Link } from "expo-router";
import { t } from "@logoshome/shared";

const locale = "zh-CN" as const;

export default function HomeScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.brand}>{t(locale, "app.name")}</Text>
      <Text style={styles.tag}>{t(locale, "app.tagline")}</Text>
      <View style={styles.nav}>
        <Link href="/bible" asChild>
          <Pressable style={styles.btn}>
            <Text style={styles.btnText}>{t(locale, "nav.bible")}</Text>
          </Pressable>
        </Link>
        <Link href="/plans" asChild>
          <Pressable style={styles.btn}>
            <Text style={styles.btnText}>{t(locale, "nav.plans")}</Text>
          </Pressable>
        </Link>
        <Link href="/home" asChild>
          <Pressable style={styles.btn}>
            <Text style={styles.btnText}>{t(locale, "nav.home")}</Text>
          </Pressable>
        </Link>
        <Link href="/me" asChild>
          <Pressable style={styles.btn}>
            <Text style={styles.btnText}>{t(locale, "nav.me")}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f3efe6",
    padding: 24,
    justifyContent: "center",
  },
  brand: {
    fontSize: 36,
    fontWeight: "700",
    color: "#1c2b2a",
  },
  tag: {
    marginTop: 8,
    color: "#5a6a68",
    fontSize: 16,
  },
  nav: {
    marginTop: 32,
    gap: 12,
  },
  btn: {
    backgroundColor: "#0f6b5c",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  btnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
});
