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
  groupId?: string | null;
  board: Board;
  title: string;
  body: string;
  externalMediaUrl?: string | null;
  mediaKey?: string | null;
  createdAt: number;
};

type ChurchMember = {
  userId: string;
  uid: string | null;
  role: string;
  verified: boolean;
};

const BOARDS: Board[] = ["notice", "general", "group"];
type HomeSection = "church" | "forum" | "chat";

export function HomePage() {
  const { t } = useTranslation();
  const [homeSection, setHomeSection] = useState<HomeSection>("forum");
  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board>("notice");
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [joinSlug, setJoinSlug] = useState("");
  const [securityMode, setSecurityMode] = useState<SecurityMode>("standard");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaKey, setMediaKey] = useState<string | null>(null);
  const [composeGroupId, setComposeGroupId] = useState("");
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

  async function joinBySlug() {
    if (!getToken() || !joinSlug.trim()) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      const joined = await api<{ churchId: string; alreadyMember?: boolean }>(
        "/v1/home/churches/join",
        {
          method: "POST",
          body: JSON.stringify({ slug: joinSlug.trim().toLowerCase() }),
        },
      );
      setJoinSlug("");
      setNote(joined.alreadyMember ? "already_member" : "joined_church");
      await refresh();
      setSelectedChurchId(joined.churchId);
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

  async function uploadAttachment(file: File) {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      const minted = await api<{ key: string; putUrl: string }>("/v1/media/upload-url", {
        method: "POST",
      });
      const putRes = await fetch(minted.putUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!putRes.ok) throw new Error("media_upload_failed");
      setMediaKey(minted.key);
      setNote("media_uploaded");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  /** Media GET requires Bearer — open via authenticated fetch + blob URL. */
  async function openAttachment(key: string) {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    try {
      const res = await fetch(`/v1/media/${key}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("media_fetch_failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // Revoke after the tab has a chance to load.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    }
  }

  async function composePost() {
    if (!getToken() || !selectedChurchId) {
      setNote("login_required");
      return;
    }
    if (board === "group" && !composeGroupId) {
      setNote("group_required");
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
      if (board === "group" && composeGroupId) payload.groupId = composeGroupId;
      if (mediaUrl.trim()) payload.externalMediaUrl = mediaUrl.trim();
      if (mediaKey) payload.mediaKey = mediaKey;
      await api("/v1/home/posts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTitle("");
      setBody("");
      setMediaUrl("");
      setMediaKey(null);
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
    <section className="fade-up home-page app-folio" data-testid="home-page">
      <h1 className="page-title">{t("nav.home")}</h1>
      {note && <p className="muted">{humanizeStatus(t, note)}</p>}
      <div className="plans-tabs home-section-tabs" role="tablist" data-testid="home-section-tabs">
        {(
          [
            ["church", t("home.tabChurch")],
            ["forum", t("home.tabForum")],
            ["chat", t("home.tabChat")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={homeSection === id}
            className={`plans-tab${homeSection === id ? " is-active" : ""}`}
            data-testid={`home-tab-${id}`}
            onClick={() => setHomeSection(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {homeSection === "church" && (
      <div className="panel" data-testid="home-church-panel">
        <h2>{t("home.myChurches")}</h2>
        <ul className="list">
          {churches.length === 0 && <li className="muted">{t("home.noChurches")}</li>}
          {churches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`church-row${selectedChurchId === c.id ? " is-selected" : ""}`}
                onClick={() => setSelectedChurchId(c.id)}
              >
                <div className="church-row-title">
                  {c.name}
                  {selectedChurchId === c.id ? ` · ${t("home.selected")}` : ""}
                </div>
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
              </button>
            </li>
          ))}
        </ul>

        <details className="plans-advanced" style={{ marginTop: "1rem" }}>
          <summary>{t("home.createChurch")}</summary>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label>{t("home.churchName")}</label>
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
              placeholder={t("home.slugPlaceholder")}
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
        </details>

        <details className="plans-advanced" style={{ marginTop: "0.75rem" }}>
          <summary>{t("home.joinChurch")}</summary>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label>{t("home.joinSlug")}</label>
            <input
              value={joinSlug}
              onChange={(e) => setJoinSlug(e.target.value)}
              placeholder={t("home.slugPlaceholder")}
            />
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => void joinBySlug()}>
            {t("home.joinChurch")}
          </button>
        </details>
      </div>
      )}

      {homeSection === "church" && selectedChurchId && (
        <div className="panel">
          <h2>{t("home.groups")}</h2>
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

      {homeSection === "church" && selectedChurchId && canAdmin && (
        <div className="panel" data-testid="home-admin-panel">
          <details className="plans-advanced" open={pendingMembers.length > 0}>
            <summary>{t("home.verifyMember")}</summary>
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
            <h3>{t("home.createGroup")}</h3>
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
          </details>

          <details className="plans-advanced" style={{ marginTop: "0.85rem" }}>
            <summary>{t("home.securityMode")}</summary>
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
          </details>

          {isAnyAdmin && (
            <details className="plans-advanced" style={{ marginTop: "0.85rem" }}>
              <summary>{t("security.adminWipe")}</summary>
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
            </details>
          )}
        </div>
      )}

      {homeSection === "forum" && selectedChurchId && (
        <div className="panel" data-testid="home-forum-panel">
          <h2>{t("home.forumFeed")}</h2>
          {selectedChurch && (
            <p className="muted" style={{ marginTop: 0 }}>
              {selectedChurch.name}
              {selectedChurch.slug ? ` · ${selectedChurch.slug}` : ""}
            </p>
          )}
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
                <article className="post-row">
                  <div className="post-row-title">{p.title}</div>
                  <p className="post-row-body">{p.body}</p>
                  <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
                    {t("home.postedAt")} · {new Date(p.createdAt).toLocaleString()}
                  </p>
                  {p.externalMediaUrl ? <ExternalMedia url={p.externalMediaUrl} /> : null}
                  {p.mediaKey ? (
                    <p className="muted">
                      <button
                        type="button"
                        className="linkish"
                        data-testid="home-open-attachment"
                        onClick={() => void openAttachment(p.mediaKey!)}
                      >
                        {t("home.attachment")}
                      </button>
                    </p>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>

          <h3>{t("home.compose")}</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            {t("home.composeHint")}
          </p>
          {board === "group" && (
            <div className="field">
              <label>{t("home.board.group")}</label>
              <select
                value={composeGroupId}
                onChange={(e) => setComposeGroupId(e.target.value)}
              >
                <option value="">{t("home.selectGroup")}</option>
                {membershipGroups.map((gid) => (
                  <option key={gid} value={gid}>
                    {gid}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>{t("home.postTitle")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>{t("home.postBody")}</label>
            <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <details className="plans-advanced">
            <summary>{t("home.mediaUrl")}</summary>
            <div className="field" style={{ marginTop: "0.65rem" }}>
              <label>{t("home.mediaUrl")}</label>
              <input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
              />
            </div>
            <div className="field">
              <label>{t("home.attachment")}</label>
              <input
                type="file"
                accept="image/*,audio/*,video/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAttachment(f);
                }}
              />
              {mediaKey ? <p className="muted">{mediaKey}</p> : null}
            </div>
          </details>
          <button type="button" className="btn" disabled={busy} onClick={() => void composePost()}>
            {t("home.post")}
          </button>
        </div>
      )}

      {homeSection === "forum" && !selectedChurchId && (
        <div className="panel">
          <p className="muted">{t("home.noChurches")}</p>
        </div>
      )}

      {homeSection === "chat" && <ChatPanel />}
    </section>
  );
}
