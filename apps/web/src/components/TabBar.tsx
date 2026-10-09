import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../lib/api";

export function TabBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!getToken()) {
        if (!cancelled) setShowAdmin(false);
        return;
      }
      try {
        const me = await api<{ canAccessAdminConsole?: boolean }>("/v1/me");
        if (!cancelled) setShowAdmin(Boolean(me.canAccessAdminConsole));
      } catch {
        if (!cancelled) setShowAdmin(false);
      }
    }
    void check();
    const onFocus = () => void check();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "lh.token") void check();
    };
    // Same-tab login updates localStorage without a StorageEvent — poll briefly.
    const id = window.setInterval(() => void check(), 4000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, [location.pathname]);

  const tabs = [
    { to: "/app/bible/cuvs/john/1", label: t("nav.bible"), end: false },
    { to: "/app/plans", label: t("nav.plans") },
    { to: "/app/home", label: t("nav.home") },
    ...(showAdmin ? [{ to: "/app/admin", label: t("nav.admin") }] : []),
    { to: "/app/me", label: t("nav.me") },
  ];

  return (
    <nav
      className="tab-bar"
      aria-label="Primary"
      data-tabs={tabs.length}
      data-testid="tab-bar"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => {
            const bibleActive =
              tab.to.startsWith("/app/bible") && location.pathname.startsWith("/app/bible");
            return isActive || bibleActive ? "active" : "";
          }}
          data-testid={tab.to === "/app/admin" ? "nav-admin" : undefined}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
