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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
