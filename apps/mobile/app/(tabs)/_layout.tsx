import { Tabs } from "expo-router";
import { t } from "@logoshome/shared";
import { useLocale } from "../../src/locale";

export default function TabsLayout() {
  const { locale } = useLocale();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#f3efe6" },
        headerTitleStyle: { fontWeight: "700", color: "#1c2b2a" },
        tabBarActiveTintColor: "#0f6b5c",
        tabBarInactiveTintColor: "#5a6a68",
        tabBarStyle: { backgroundColor: "#f7f3ea" },
      }}
    >
      <Tabs.Screen name="bible" options={{ title: t(locale, "nav.bible") }} />
      <Tabs.Screen name="plans" options={{ title: t(locale, "nav.plans") }} />
      <Tabs.Screen name="home" options={{ title: t(locale, "nav.home") }} />
      <Tabs.Screen name="me" options={{ title: t(locale, "nav.me") }} />
    </Tabs>
  );
}
