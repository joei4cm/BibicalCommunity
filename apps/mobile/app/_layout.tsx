import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { hydrateToken } from "../src/api";
import { LocaleProvider } from "../src/locale";

export default function RootLayout() {
  useEffect(() => {
    void hydrateToken();
  }, []);

  return (
    <LocaleProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </LocaleProvider>
  );
}
