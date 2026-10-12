import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { THEME_IDS, type ThemeId } from "@logoshome/shared";
import { applyTheme } from "@logoshome/ui";
import { BrandMark } from "../components/BrandMark";

const LOCALES = [
  { id: "zh-CN", label: "中文" },
  { id: "en", label: "EN" },
  { id: "ja", label: "日本語" },
] as const;

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<ThemeId>(
    () => (localStorage.getItem("lh.theme") as ThemeId) ?? "day",
  );
  const signedIn = Boolean(localStorage.getItem("lh.token"));

  function setLocale(lng: string) {
    localStorage.setItem("lh.locale", lng);
    void i18n.changeLanguage(lng);
  }

  function cycleTheme() {
    const idx = THEME_IDS.indexOf(theme);
    const next = THEME_IDS[(idx + 1) % THEME_IDS.length] ?? "day";
    localStorage.setItem("lh.theme", next);
    applyTheme(next);
    setTheme(next);
  }

  return (
    <div className="landing" data-testid="landing-page">
      <div className="landing-hero-plane" aria-hidden="true">
        <div className="landing-atmosphere" />
        <div className="landing-hero-art">
          <BrandMark className="landing-hero-mark" title="" />
        </div>
      </div>

      <header className="landing-chrome">
        <div className="landing-lang" role="group" aria-label="Language">
          {LOCALES.map((loc) => (
            <button
              key={loc.id}
              type="button"
              className={`landing-chip${i18n.language === loc.id ? " active" : ""}`}
              onClick={() => setLocale(loc.id)}
            >
              {loc.label}
            </button>
          ))}
        </div>
        <button type="button" className="landing-chip" onClick={cycleTheme} aria-label="Theme">
          {t("landing.theme")}: {theme}
        </button>
      </header>

      <section className="landing-hero">
        <p className="landing-brand" data-testid="landing-brand">
          <BrandMark className="landing-brand-mark" />
          <span className="landing-brand-name">{t("app.name")}</span>
        </p>
        <h1 className="landing-headline">{t("landing.headline")}</h1>
        <p className="landing-support">{t("landing.support")}</p>
        <div className="landing-cta">
          <Link
            className="btn landing-cta-btn"
            to={signedIn ? "/app/bible/cuvs/john/1" : "/app/login"}
            data-testid="landing-cta"
          >
            {signedIn ? t("landing.ctaOpen") : t("landing.cta")}
          </Link>
        </div>
      </section>
    </div>
  );
}
