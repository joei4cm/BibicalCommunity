import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCommsBadges } from "../hooks/useCommsBadges";
import { formatBadgeCount } from "../lib/comms-badges";
import { readerHomePath } from "../lib/reader-place";

/** Primary consumer tabs only — ops console lives at /app/admin (no TabBar). */
export function TabBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { badges } = useCommsBadges();
  const chatBadge = formatBadgeCount(badges.total);

  const tabs = [
    { to: readerHomePath(), label: t("nav.bible"), end: false, badge: "" },
    { to: "/app/plans", label: t("nav.plans"), badge: "" },
    { to: "/app/chat", label: t("nav.chat"), end: false, badge: chatBadge },
    { to: "/app/home", label: t("nav.community"), badge: "" },
    { to: "/app/me", label: t("nav.me"), badge: "" },
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
          aria-label={
            tab.badge
              ? `${tab.label} (${tab.badge} ${t("comms.badgePending")})`
              : tab.label
          }
        >
          <span className="tab-bar-label">{tab.label}</span>
          {tab.badge ? (
            <span className="nav-badge" data-testid="tab-chat-badge">
              {tab.badge}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}
