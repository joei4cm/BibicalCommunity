import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../lib/api";

type Church = {
  id: string;
  name: string;
  role: string;
  verified: boolean;
};

export function HomePage() {
  const { t } = useTranslation();
  const [churches, setChurches] = useState<Church[]>([]);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    void api<{ churches: Church[] }>("/v1/home/churches")
      .then((r) => setChurches(r.churches))
      .catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, []);

  return (
    <section className="fade-up">
      <h1 className="brand">{t("nav.home")}</h1>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("home.forum")}</h2>
        {note && <p className="muted">{note}</p>}
        <ul className="list">
          {churches.length === 0 && <li className="muted">No church homes yet</li>}
          {churches.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              <div className="muted">
                {c.role}
                {c.verified ? ` · ${t("me.verified")}` : ""}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("home.messages")}</h2>
        <p className="muted">E2EE DM / groups · {t("chat.disappearing")} · {t("chat.call")}</p>
        <div className="toolbar">
          <button type="button" className="btn ghost">
            {t("chat.call")}
          </button>
          <button type="button" className="btn ghost">
            {t("chat.screenShare")}
          </button>
        </div>
      </div>
    </section>
  );
}
