import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

/** Primary consumer tabs only — ops console lives at /app/admin (no TabBar). */
export function TabBar() {
  const { t } = useTranslation();
  const location = useLocation();

  const tabs = [
    { to: "/app/bible/cuvs/john/1", label: t("nav.bible"), end: false },
    { to: "/app/plans", label: t("nav.plans") },
    { to: "/app/chat", label: t("nav.chat"), end: false },
    { to: "/app/home", label: t("nav.community") },
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
            const chatActive =
              tab.to.startsWith("/app/chat") && location.pathname.startsWith("/app/chat");
            return isActive || bibleActive || chatActive ? "active" : "";
          }}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
