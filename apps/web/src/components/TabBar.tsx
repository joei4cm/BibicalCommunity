import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function TabBar() {
  const { t } = useTranslation();
  const tabs = [
    { to: "/", label: t("nav.bible"), end: true },
    { to: "/plans", label: t("nav.plans") },
    { to: "/home", label: t("nav.home") },
    { to: "/me", label: t("nav.me") },
  ];
  return (
    <nav className="tab-bar" aria-label="Primary">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => (isActive ? "active" : "")}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
