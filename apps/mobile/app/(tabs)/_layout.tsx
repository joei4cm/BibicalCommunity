import { Tabs } from "expo-router";
import { t } from "@logoshome/shared";
import { useLocale } from "../../src/locale";

export default function TabsLayout() {
  const { locale } = useLocale();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#e4e8ee" },
        headerTitleStyle: { fontWeight: "700", color: "#18232b" },
        tabBarActiveTintColor: "#1c3d48",
        tabBarInactiveTintColor: "#5f6d78",
        tabBarStyle: { backgroundColor: "#f7f5f1" },
      }}
    >
      <Tabs.Screen name="bible" options={{ title: t(locale, "nav.bible") }} />
      <Tabs.Screen name="plans" options={{ title: t(locale, "nav.plans") }} />
      <Tabs.Screen name="home" options={{ title: t(locale, "nav.home") }} />
      <Tabs.Screen name="me" options={{ title: t(locale, "nav.me") }} />
    </Tabs>
  );
}
