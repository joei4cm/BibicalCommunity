import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { applyTheme, type ThemeId } from "@logoshome/ui";
import "./i18n";
import "./styles/global.css";
import "./pwa-update";
import { App } from "./App";

const theme = (localStorage.getItem("lh.theme") as ThemeId) ?? "day";
applyTheme(theme);

/** Capacitor / Electron / installed PWA — tighten overscroll & zoom chrome. */
function markNativeShell() {
  try {
    const w = window as Window & {
      Capacitor?: { getPlatform?: () => string };
      electronAPI?: unknown;
    };
    const proto = window.location.protocol;
    const packaged =
      proto === "file:" ||
      proto === "capacitor:" ||
      proto === "ionic:" ||
      Boolean(w.Capacitor) ||
      Boolean(w.electronAPI) ||
      /Electron/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (packaged || standalone) {
      document.documentElement.classList.add("lh-native");
    }
    // Android Capacitor already insets the WebView via adjustMarginsForEdgeToEdge.
    // Extra CSS safe-area padding creates empty scrollable voids under the status bar.
    if (w.Capacitor?.getPlatform?.() === "android") {
      document.documentElement.classList.add("lh-native-android");
    }
  } catch {
    /* ignore */
  }
}
markNativeShell();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
