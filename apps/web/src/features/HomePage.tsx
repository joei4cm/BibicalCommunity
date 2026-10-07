import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../lib/api";
import { ChatPanel } from "./ChatPanel";
import { ExternalMedia } from "./media";

type Church = {
  id: string;
  name: string;
  slug?: string;
  role: string;
  verified: boolean;
};

type Board = "notice" | "general" | "group";

type ForumPost = {
  id: string;
  churchId: string;
  board: Board;
  title: string;
  body: string;
  externalMediaUrl?: string | null;
  createdAt: number;
};

const BOARDS: Board[] = ["notice", "general", "group"];

export function HomePage() {
  const { t } = useTranslation();
  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board>("notice");
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const r = await api<{ churches: Church[] }>("/v1/home/churches");
    setChurches(r.churches);
    setNote(null);
    setSelectedChurchId((prev) => prev ?? r.churches[0]?.id ?? null);
  }, []);

  const loadPosts = useCallback(async () => {
    if (!getToken() || !selectedChurchId) {
      setPosts([]);
      return;
    }
    const r = await api<{ posts: ForumPost[] }>(
      `/v1/home/${encodeURIComponent(selectedChurchId)}/posts?board=${encodeURIComponent(board)}`,
    );
    setPosts(r.posts);
  }, [selectedChurchId, board]);

  useEffect(() => {
    void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [refresh]);

  useEffect(() => {
    void loadPosts().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadPosts]);

  async function createChurch() {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      const created = await api<{ id: string }>("/v1/home/churches", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });
      setName("");
      setSlug("");
      setSelectedChurchId(created.id);
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function composePost() {
    if (!getToken() || !selectedChurchId) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, string> = {
        churchId: selectedChurchId,
        board,
        title: title.trim(),
        body: body.trim(),
      };
      if (mediaUrl.trim()) payload.externalMediaUrl = mediaUrl.trim();
      await api("/v1/home/posts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTitle("");
      setBody("");
      setMediaUrl("");
      await loadPosts();
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
              <button type="button" className="linkish" onClick={() => setSelectedChurchId(c.id)}>
                <strong>{c.name}</strong>
                {selectedChurchId === c.id ? ` · ${t("home.selected")}` : ""}
              </button>
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

      {selectedChurchId && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("home.boards")}</h2>
          <div className="toolbar board-tabs" role="tablist">
            {BOARDS.map((b) => (
              <button
                key={b}
                type="button"
                role="tab"
                aria-selected={board === b}
                className={`btn ghost${board === b ? " active-toggle" : ""}`}
                onClick={() => setBoard(b)}
              >
                {t(`home.board.${b}`)}
              </button>
            ))}
          </div>

          <ul className="list">
            {posts.length === 0 && <li className="muted">{t("home.noPosts")}</li>}
            {posts.map((p) => (
              <li key={p.id}>
                <strong>{p.title}</strong>
                <p style={{ margin: "0.35rem 0 0" }}>{p.body}</p>
                {p.externalMediaUrl ? <ExternalMedia url={p.externalMediaUrl} /> : null}
              </li>
            ))}
          </ul>

          <h3 style={{ marginTop: "1.25rem" }}>{t("home.compose")}</h3>
          <div className="field">
            <label>{t("home.postTitle")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>{t("home.postBody")}</label>
            <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="field">
            <label>{t("home.mediaUrl")}</label>
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => void composePost()}>
            {t("home.post")}
          </button>
        </div>
      )}

      <ChatPanel />
    </section>
  );
}
