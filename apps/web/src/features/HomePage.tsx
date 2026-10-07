import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SecurityMode } from "@logoshome/shared";
import { api, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";
import { ChatPanel } from "./ChatPanel";
import { ExternalMedia } from "./media";

type Church = {
  id: string;
  name: string;
  slug?: string;
  role: string;
  verified: boolean;
  securityMode?: SecurityMode;
  groups?: string[];
};

function isChurchAdmin(role: string): boolean {
  return role === "admin" || role === "security_officer";
}

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

type ChurchMember = {
  userId: string;
  uid: string | null;
  role: string;
  verified: boolean;
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
  const [securityMode, setSecurityMode] = useState<SecurityMode>("standard");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyUserId, setVerifyUserId] = useState("");
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [groupName, setGroupName] = useState("");
  const [wipeUserId, setWipeUserId] = useState("");
  const [wipeDeviceId, setWipeDeviceId] = useState("");

  const selectedChurch = churches.find((c) => c.id === selectedChurchId) ?? null;
  const canAdmin = selectedChurch ? isChurchAdmin(selectedChurch.role) : false;
  const membershipGroups = selectedChurch?.groups ?? [];
  const isAnyAdmin = churches.some((c) => isChurchAdmin(c.role));
  const pendingMembers = members.filter((m) => !m.verified);

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

  const loadMembers = useCallback(async () => {
    if (!getToken() || !selectedChurchId || !canAdmin) {
      setMembers([]);
      return;
    }
    const r = await api<{ members: ChurchMember[] }>(
      `/v1/home/${encodeURIComponent(selectedChurchId)}/members`,
    );
    setMembers(r.members ?? []);
  }, [selectedChurchId, canAdmin]);

  useEffect(() => {
    void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [refresh]);

  useEffect(() => {
    void loadPosts().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadPosts]);

  useEffect(() => {
    void loadMembers().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadMembers]);

  async function createChurch() {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      const created = await api<{ id: string }>("/v1/home/churches", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          securityMode,
        }),
      });
      setName("");
      setSlug("");
      setSecurityMode("standard");
      setSelectedChurchId(created.id);
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function switchSecurityMode(mode: SecurityMode) {
    if (!getToken() || !selectedChurchId || !canAdmin) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      await api(`/v1/home/churches/${encodeURIComponent(selectedChurchId)}/security`, {
        method: "PATCH",
        body: JSON.stringify({ securityMode: mode }),
      });
      setNote(mode === "hostile" ? "hostile_enabled" : "standard_enabled");
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function adminWipe() {
    if (!getToken() || !wipeUserId.trim()) {
      setNote("login_required");
      return;
    }
    if (!window.confirm(t("security.adminWipeConfirm"))) return;
    setBusy(true);
    try {
      const payload: Record<string, string> = {
        userId: wipeUserId.trim(),
        reasonCode: "admin",
      };
      if (wipeDeviceId.trim()) payload.deviceId = wipeDeviceId.trim();
      await api("/v1/admin/wipe", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setWipeUserId("");
      setWipeDeviceId("");
      setNote("admin_wipe_issued");
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

  async function verifyMember(userId?: string) {
    const target = (userId ?? verifyUserId).trim();
    if (!getToken() || !selectedChurchId || !target) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      await api("/v1/home/members/verify", {
        method: "POST",
        body: JSON.stringify({ churchId: selectedChurchId, userId: target }),
      });
      setVerifyUserId("");
      setNote("member_verified");
      await refresh();
      await loadMembers();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    if (!getToken() || !selectedChurchId || !groupName.trim()) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      await api("/v1/home/groups", {
        method: "POST",
        body: JSON.stringify({ churchId: selectedChurchId, name: groupName.trim() }),
      });
      setGroupName("");
      setNote("group_created");
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
        {note && <p className="muted">{humanizeStatus(t, note)}</p>}
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
                {c.securityMode === "hostile" ? (
                  <span className="badge-hostile"> · {t("home.securityMode.hostileBadge")}</span>
                ) : (
                  <span> · {t("home.securityMode.standardBadge")}</span>
                )}
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
        <div className="field">
          <label>{t("home.securityMode")}</label>
          <select
            value={securityMode}
            onChange={(e) => setSecurityMode(e.target.value as SecurityMode)}
          >
            <option value="standard">{t("home.securityMode.standard")}</option>
            <option value="hostile">{t("home.securityMode.hostile")}</option>
          </select>
        </div>
        <button type="button" className="btn" disabled={busy} onClick={() => void createChurch()}>
          {t("home.createChurch")}
        </button>
      </div>

      {selectedChurchId && canAdmin && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("home.securityMode")}</h2>
          <p className="muted">
            {selectedChurch?.securityMode === "hostile"
              ? t("home.securityMode.hostileHint")
              : t("home.securityMode.standardHint")}
          </p>
          <div className="toolbar">
            <button
              type="button"
              className={`btn ghost${selectedChurch?.securityMode === "standard" ? " active-toggle" : ""}`}
              disabled={busy || selectedChurch?.securityMode === "standard"}
              onClick={() => void switchSecurityMode("standard")}
            >
              {t("home.securityMode.standard")}
            </button>
            <button
              type="button"
              className={`btn ghost${selectedChurch?.securityMode === "hostile" ? " active-toggle" : ""}`}
              disabled={busy || selectedChurch?.securityMode === "hostile"}
              onClick={() => void switchSecurityMode("hostile")}
            >
              {t("home.securityMode.hostile")}
            </button>
          </div>
        </div>
      )}

      {selectedChurchId && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("home.groups")}</h2>
          <ul className="list">
            {membershipGroups.length === 0 && <li className="muted">{t("home.noGroups")}</li>}
            {membershipGroups.map((g) => (
              <li key={g}>
                <code>{g}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedChurchId && canAdmin && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("home.verifyMember")}</h2>
          <p className="muted">{t("home.membersPending")}</p>
          <ul className="list">
            {pendingMembers.length === 0 && <li className="muted">{t("home.membersNonePending")}</li>}
            {pendingMembers.map((m) => (
              <li key={m.userId}>
                <strong>{m.uid ?? m.userId}</strong>
                <div className="muted">
                  {m.role} · {m.userId}
                </div>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void verifyMember(m.userId)}
                >
                  {t("home.verify")}
                </button>
              </li>
            ))}
          </ul>
          <div className="field" style={{ marginTop: "1rem" }}>
            <label>{t("home.verifyUserId")}</label>
            <input
              value={verifyUserId}
              onChange={(e) => setVerifyUserId(e.target.value)}
              placeholder="usr_…"
            />
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => void verifyMember()}>
            {t("home.verify")}
          </button>

          <h3 style={{ marginTop: "1.25rem" }}>{t("home.createGroup")}</h3>
          <div className="field">
            <label>{t("home.groupName")}</label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t("home.groupName")}
            />
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => void createGroup()}>
            {t("home.createGroup")}
          </button>
        </div>
      )}

      {isAnyAdmin && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("security.adminWipe")}</h2>
          <p className="muted">{t("security.adminWipeHint")}</p>
          <div className="field">
            <label>{t("security.adminWipeUserId")}</label>
            <input
              value={wipeUserId}
              onChange={(e) => setWipeUserId(e.target.value)}
              placeholder="usr_…"
            />
          </div>
          <div className="field">
            <label>{t("security.adminWipeDeviceId")}</label>
            <input
              value={wipeDeviceId}
              onChange={(e) => setWipeDeviceId(e.target.value)}
              placeholder="dev_… (optional)"
            />
          </div>
          <button type="button" className="btn danger" disabled={busy} onClick={() => void adminWipe()}>
            {t("security.adminWipe")}
          </button>
        </div>
      )}

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
