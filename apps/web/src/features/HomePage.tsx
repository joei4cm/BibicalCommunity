import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../lib/api";
import { ChatPanel } from "./ChatPanel";

type Church = {
  id: string;
  name: string;
  slug?: string;
  role: string;
  verified: boolean;
};

export function HomePage() {
  const { t } = useTranslation();
  const [churches, setChurches] = useState<Church[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const r = await api<{ churches: Church[] }>("/v1/home/churches");
    setChurches(r.churches);
    setNote(null);
  }, []);

  useEffect(() => {
    void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [refresh]);

  async function createChurch() {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      await api("/v1/home/churches", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });
      setName("");
      setSlug("");
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="fade-up">
      <h1 className="brand">{t("nav.home")}</h1>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("home.forum")}</h2>
        {note && <p className="muted">{note}</p>}
        <ul className="list">
          {churches.length === 0 && <li className="muted">{t("home.noChurches")}</li>}
          {churches.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              <div className="muted">
                {c.role}
                {c.slug ? ` · ${c.slug}` : ""}
                {c.verified ? ` · ${t("me.verified")}` : ""}
              </div>
            </li>
          ))}
        </ul>
        <div className="field" style={{ marginTop: "1rem" }}>
          <label>{t("home.createChurch")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("home.churchName")}
          />
        </div>
        <div className="field">
          <label>{t("home.churchSlug")}</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-church"
          />
        </div>
        <button type="button" className="btn" disabled={busy} onClick={() => void createChurch()}>
          {t("home.createChurch")}
        </button>
      </div>
      <ChatPanel />
    </section>
  );
}
