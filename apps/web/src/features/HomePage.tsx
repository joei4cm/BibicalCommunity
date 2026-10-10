import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ChurchRole, GroupKind, SecurityMode } from "@logoshome/shared";
import { api, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";
import { ExternalMedia } from "./media";

type Caps = {
  platformAdmin?: boolean;
  createGroup?: boolean;
  verifyMembers?: boolean;
  manageChurch?: boolean;
  isGroupLeader?: boolean;
  ledGroupIds?: string[];
};

type Church = {
  id: string;
  name: string;
  slug?: string;
  role: string;
  roles?: ChurchRole[];
  verified: boolean;
  securityMode?: SecurityMode;
  groups?: string[];
  capabilities?: Caps;
};

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
  nickname?: string | null;
  role: string;
  roles?: ChurchRole[];
  verified: boolean;
};

type OrgPerson = {
  userId: string;
  uid: string | null;
  nickname: string | null;
  roles: ChurchRole[];
  groupRoles: { groupId: string; role: string }[];
  verified: boolean;
};

type OrgNode = {
  id: string;
  name: string;
  kind: GroupKind;
  parentId: string | null;
  sortOrder: number;
  members: OrgPerson[];
  children: OrgNode[];
};

type OrgTreeResponse = {
  church: { id: string; name: string; slug: string; securityMode: string };
  viewer: { roles: ChurchRole[]; ledGroupIds: string[]; capabilities: Caps };
  tree: OrgNode[];
  leaders: OrgPerson[];
};

type BoardInfo = { id: Board; postCount: number; latestAt: number | null };

type HomeSection = "home" | "forum" | "manage";
const BOARDS: Board[] = ["notice", "general", "group"];
const ASSIGNABLE_ROLES: ChurchRole[] = [
  "admin",
  "elder",
  "deacon",
  "coworker",
  "security_officer",
  "member",
];

function personLabel(p: { nickname?: string | null; uid?: string | null; userId: string }): string {
  return p.nickname || p.uid || p.userId.slice(0, 10);
}

function OrgTreeView({
  nodes,
  depth,
  onPerson,
  t,
}: {
  nodes: OrgNode[];
  depth: number;
  onPerson: (p: OrgPerson) => void;
  t: (k: string) => string;
}) {
  if (!nodes.length) return null;
  return (
    <ul className={`org-tree depth-${Math.min(depth, 3)}`} data-testid="org-tree">
      {nodes.map((node) => (
        <li key={node.id} className="org-tree-node">
          <div className="org-tree-label">
            <strong>{node.name}</strong>
            <span className="muted">
              {" "}
              · {t(node.kind === "department" ? "home.kind.department" : "home.kind.smallGroup")}
            </span>
          </div>
          {node.members.length > 0 && (
            <ul className="org-tree-people">
              {node.members.map((p) => (
                <li key={`${node.id}-${p.userId}`}>
                  <button type="button" className="org-person-btn" onClick={() => onPerson(p)}>
                    <span className="org-person-name">{personLabel(p)}</span>
                    <span className="muted org-person-roles">
                      {p.roles.filter((r) => r !== "member").join(" · ") ||
                        (p.groupRoles.some((g) => g.groupId === node.id && g.role === "leader")
                          ? t("home.role.groupLeader")
                          : t("home.role.member"))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <OrgTreeView nodes={node.children} depth={depth + 1} onPerson={onPerson} t={t} />
        </li>
      ))}
    </ul>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [homeSection, setHomeSection] = useState<HomeSection>("home");
  const [churches, setChurches] = useState<Church[]>([]);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [org, setOrg] = useState<OrgTreeResponse | null>(null);
  const [activePerson, setActivePerson] = useState<OrgPerson | null>(null);
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
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupKind, setGroupKind] = useState<GroupKind>("small_group");
  const [manageGroupId, setManageGroupId] = useState("");
  const [manageMemberUserId, setManageMemberUserId] = useState("");
  const [roleTargetUserId, setRoleTargetUserId] = useState("");
  const [roleDraft, setRoleDraft] = useState<ChurchRole[]>(["member"]);

  const selectedChurch = churches.find((c) => c.id === selectedChurchId) ?? null;
  const caps = selectedChurch?.capabilities ?? org?.viewer.capabilities ?? {};
  const canCreateGroup = Boolean(caps.createGroup);
  const canVerify = Boolean(caps.verifyMembers);
  const canManageChurch = Boolean(caps.manageChurch || platformAdmin);
  const isGroupLeader = Boolean(caps.isGroupLeader);
  const ledGroupIds = caps.ledGroupIds ?? org?.viewer.ledGroupIds ?? [];
  const membershipGroups = useMemo(() => {
    const fromOrg = org
      ? (() => {
          const ids: string[] = [];
          const walk = (nodes: OrgNode[]) => {
            for (const n of nodes) {
              if (n.members.some((m) => m.userId && selectedChurch)) ids.push(n.id);
              walk(n.children);
            }
          };
          walk(org.tree);
          return ids;
        })()
      : [];
    return selectedChurch?.groups?.length ? selectedChurch.groups : fromOrg;
  }, [org, selectedChurch]);
  const showManageTab = canCreateGroup || canVerify || isGroupLeader;
  const pendingMembers = members.filter((m) => !m.verified);

  const directoryPeople = useMemo(() => {
    const map = new Map<string, { userId: string; label: string; roles: string[] }>();
    for (const m of members) {
      map.set(m.userId, {
        userId: m.userId,
        label: m.nickname || m.uid || m.userId,
        roles: m.roles ?? [m.role],
      });
    }
    const walk = (nodes: OrgNode[]) => {
      for (const n of nodes) {
        for (const p of n.members) {
          if (!map.has(p.userId)) {
            map.set(p.userId, {
              userId: p.userId,
              label: personLabel(p),
              roles: p.roles,
            });
          }
        }
        walk(n.children);
      }
    };
    if (org) {
      walk(org.tree);
      for (const p of org.leaders) {
        if (!map.has(p.userId)) {
          map.set(p.userId, { userId: p.userId, label: personLabel(p), roles: p.roles });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [members, org]);

  const groupOptions = useMemo(() => {
    const opts: { id: string; name: string }[] = [];
    const walk = (nodes: OrgNode[]) => {
      for (const n of nodes) {
        opts.push({ id: n.id, name: n.name });
        walk(n.children);
      }
    };
    if (org) walk(org.tree);
    const prefer = ledGroupIds.length ? new Set(ledGroupIds) : null;
    return prefer ? opts.filter((o) => prefer.has(o.id)) : opts;
  }, [org, ledGroupIds]);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const r = await api<{ churches: Church[]; platformAdmin?: boolean }>("/v1/home/churches");
    setChurches(r.churches);
    setPlatformAdmin(Boolean(r.platformAdmin));
    setNote(null);
    setSelectedChurchId((prev) => prev ?? r.churches[0]?.id ?? null);
  }, []);

  const loadOrg = useCallback(async () => {
    if (!getToken() || !selectedChurchId) {
      setOrg(null);
      return;
    }
    const r = await api<OrgTreeResponse>(
      `/v1/home/${encodeURIComponent(selectedChurchId)}/org-tree`,
    );
    setOrg(r);
  }, [selectedChurchId]);

  const loadBoards = useCallback(async () => {
    if (!getToken() || !selectedChurchId) {
      setBoards([]);
      return;
    }
    const r = await api<{ boards: BoardInfo[] }>(
      `/v1/home/${encodeURIComponent(selectedChurchId)}/boards`,
    );
    setBoards(r.boards ?? []);
  }, [selectedChurchId]);

  const loadPosts = useCallback(async () => {
    if (!getToken() || !selectedChurchId || !board) {
      setPosts([]);
      return;
    }
    const r = await api<{ posts: ForumPost[] }>(
      `/v1/home/${encodeURIComponent(selectedChurchId)}/posts?board=${encodeURIComponent(board)}`,
    );
    setPosts(r.posts);
  }, [selectedChurchId, board]);

  const loadMembers = useCallback(async () => {
    if (!getToken() || !selectedChurchId || !canVerify) {
      setMembers([]);
      return;
    }
    const r = await api<{ members: ChurchMember[] }>(
      `/v1/home/${encodeURIComponent(selectedChurchId)}/members`,
    );
    setMembers(r.members ?? []);
  }, [selectedChurchId, canVerify]);

  useEffect(() => {
    void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [refresh]);

  useEffect(() => {
    void loadOrg().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadOrg]);

  useEffect(() => {
    void loadBoards().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadBoards]);

  useEffect(() => {
    void loadPosts().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadPosts]);

  useEffect(() => {
    void loadMembers().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadMembers]);

  useEffect(() => {
    if (homeSection === "manage" && !showManageTab) setHomeSection("home");
  }, [homeSection, showManageTab]);

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
      setNote("home_created");
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
      setHomeSection("home");
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
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    }
  }

  async function composePost() {
    if (!getToken() || !selectedChurchId || !board) {
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
      await loadBoards();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function verifyMember(userId: string) {
    const target = userId.trim();
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
        body: JSON.stringify({
          churchId: selectedChurchId,
          name: groupName.trim(),
          kind: groupKind,
        }),
      });
      setGroupName("");
      setNote("group_created");
      await refresh();
      await loadOrg();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function addGroupMember() {
    if (!manageGroupId || !manageMemberUserId.trim()) return;
    setBusy(true);
    try {
      await api(`/v1/home/groups/${encodeURIComponent(manageGroupId)}/members`, {
        method: "POST",
        body: JSON.stringify({ userId: manageMemberUserId.trim(), role: "member" }),
      });
      setManageMemberUserId("");
      setNote("group_member_added");
      await loadOrg();
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeGroupMember(groupId: string, userId: string) {
    setBusy(true);
    try {
      await api(
        `/v1/home/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      setNote("group_member_removed");
      await loadOrg();
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveRoles() {
    if (!selectedChurchId || !roleTargetUserId.trim() || roleDraft.length === 0) return;
    setBusy(true);
    try {
      await api("/v1/home/members/roles", {
        method: "POST",
        body: JSON.stringify({
          churchId: selectedChurchId,
          userId: roleTargetUserId.trim(),
          roles: roleDraft,
        }),
      });
      setNote("roles_updated");
      await loadMembers();
      await loadOrg();
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  function greetPerson(p: OrgPerson) {
    navigate(`/app/chat?peer=${encodeURIComponent(p.userId)}`);
  }

  const sectionTabs = (
    [
      ["home", t("home.tabHome")],
      ["forum", t("home.tabForum")],
      ...(showManageTab ? ([["manage", t("home.tabManage")]] as const) : []),
    ] as const
  );

  return (
    <section className="fade-up home-page app-folio" data-testid="home-page">
      <h1 className="page-title">{t("nav.community")}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {t("home.communityHint")}
      </p>
      {note && <p className="muted">{humanizeStatus(t, note)}</p>}

      <div className="plans-tabs home-section-tabs" role="tablist" data-testid="home-section-tabs">
        {sectionTabs.map(([id, label]) => (
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

      {homeSection === "home" && (
        <>
          <div className="panel" data-testid="home-church-panel">
            <h2>{t("home.myHomes")}</h2>
            <ul className="list">
              {churches.length === 0 && <li className="muted">{t("home.noHomes")}</li>}
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
                      {(c.roles ?? [c.role]).join(" · ")}
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

            <details className="plans-advanced" style={{ marginTop: "1rem" }} open={churches.length === 0}>
              <summary>{t("home.joinHome")}</summary>
              <div className="field" style={{ marginTop: "0.75rem" }}>
                <label>{t("home.joinSlug")}</label>
                <input
                  value={joinSlug}
                  onChange={(e) => setJoinSlug(e.target.value)}
                  placeholder={t("home.slugPlaceholder")}
                />
              </div>
              <button type="button" className="btn" disabled={busy} onClick={() => void joinBySlug()}>
                {t("home.joinHome")}
              </button>
            </details>

            {platformAdmin && (
              <details className="plans-advanced" style={{ marginTop: "0.75rem" }}>
                <summary>{t("home.createHome")}</summary>
                <p className="muted">{t("home.createHomeHint")}</p>
                <div className="field" style={{ marginTop: "0.75rem" }}>
                  <label>{t("home.homeName")}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label>{t("home.homeSlug")}</label>
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
                  {t("home.createHome")}
                </button>
              </details>
            )}
          </div>

          {selectedChurch && org && (
            <div className="panel" data-testid="home-info-panel">
              <h2>{t("home.currentHome")}</h2>
              <div className="folio-hero">
                <div className="folio-hero-name">{org.church.name}</div>
                <div className="folio-hero-meta">
                  {org.church.slug}
                  {" · "}
                  {org.church.securityMode === "hostile"
                    ? t("home.securityMode.hostileBadge")
                    : t("home.securityMode.standardBadge")}
                  {" · "}
                  {(org.viewer.roles ?? []).join(" · ")}
                </div>
              </div>
              <h3>{t("home.orgTree")}</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {t("home.orgTreeHint")}
              </p>
              {org.tree.length === 0 ? (
                <p className="muted">{t("home.noGroups")}</p>
              ) : (
                <OrgTreeView
                  nodes={org.tree}
                  depth={0}
                  onPerson={setActivePerson}
                  t={t}
                />
              )}
              {org.leaders.length > 0 && (
                <>
                  <h3>{t("home.leaders")}</h3>
                  <ul className="org-tree-people">
                    {org.leaders.map((p) => (
                      <li key={`leader-${p.userId}`}>
                        <button type="button" className="org-person-btn" onClick={() => setActivePerson(p)}>
                          <span className="org-person-name">{personLabel(p)}</span>
                          <span className="muted org-person-roles">
                            {p.roles.filter((r) => r !== "member").join(" · ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {activePerson && (
            <div className="panel person-sheet" data-testid="home-person-sheet">
              <h3>{personLabel(activePerson)}</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {activePerson.roles.join(" · ")}
                {activePerson.uid ? ` · ${activePerson.uid}` : ""}
              </p>
              <div className="toolbar">
                <button type="button" className="btn" onClick={() => greetPerson(activePerson)}>
                  {t("home.greet")}
                </button>
                <Link className="btn ghost" to={`/app/chat?peer=${encodeURIComponent(activePerson.userId)}`}>
                  {t("home.addFriendChat")}
                </Link>
                <button type="button" className="btn ghost" onClick={() => setActivePerson(null)}>
                  {t("admin.cancel")}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {homeSection === "forum" && selectedChurchId && (
        <div className="panel" data-testid="home-forum-panel">
          {churches.length > 1 && (
            <div className="field">
              <label>{t("home.pickHome")}</label>
              <select
                value={selectedChurchId}
                onChange={(e) => {
                  setSelectedChurchId(e.target.value);
                  setBoard(null);
                }}
                data-testid="home-forum-church-select"
              >
                {churches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!board ? (
            <>
              <h2>{t("home.boards")}</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                {t("home.boardsHint")}
              </p>
              <ul className="board-card-list" data-testid="home-board-list">
                {BOARDS.map((b) => {
                  const info = boards.find((x) => x.id === b);
                  return (
                    <li key={b}>
                      <button
                        type="button"
                        className="board-card"
                        onClick={() => setBoard(b)}
                        data-testid={`home-board-${b}`}
                      >
                        <div className="board-card-title">{t(`home.board.${b}`)}</div>
                        <div className="muted">
                          {t("home.boardPostCount", { count: info?.postCount ?? 0 })}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
                <button type="button" className="btn ghost" onClick={() => setBoard(null)}>
                  {t("home.backBoards")}
                </button>
              </div>
              <h2>{t(`home.board.${board}`)}</h2>
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
            </>
          )}
        </div>
      )}

      {homeSection === "forum" && !selectedChurchId && (
        <div className="panel" data-testid="home-forum-empty">
          <p className="muted" style={{ marginTop: 0 }}>
            {t("home.forumNeedHome")}
          </p>
          <button type="button" className="btn" onClick={() => setHomeSection("home")}>
            {t("home.goHome")}
          </button>
        </div>
      )}

      {homeSection === "manage" && selectedChurchId && (
        <div className="panel" data-testid="home-manage-panel">
          <h2>{t("home.tabManage")}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {t("home.manageMobileHint")}
          </p>

          {canVerify && (
            <div className="manage-block" data-testid="manage-verify">
              <h3>{t("home.verifyMember")}</h3>
              <ul className="list">
                {pendingMembers.length === 0 && (
                  <li className="muted">{t("home.membersNonePending")}</li>
                )}
                {pendingMembers.map((m) => (
                  <li key={m.userId}>
                    <strong>{m.nickname || m.uid || m.userId}</strong>
                    <div className="muted">{(m.roles ?? [m.role]).join(" · ")}</div>
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
            </div>
          )}

          {canCreateGroup && (
            <div className="manage-block" data-testid="manage-create-group">
              <h3>{t("home.createGroup")}</h3>
              <div className="field">
                <label>{t("home.groupName")}</label>
                <input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              </div>
              <div className="field">
                <label>{t("home.groupKind")}</label>
                <select
                  value={groupKind}
                  onChange={(e) => setGroupKind(e.target.value as GroupKind)}
                >
                  <option value="small_group">{t("home.kind.smallGroup")}</option>
                  <option value="department">{t("home.kind.department")}</option>
                </select>
              </div>
              <button type="button" className="btn" disabled={busy} onClick={() => void createGroup()}>
                {t("home.createGroup")}
              </button>
            </div>
          )}

          {(isGroupLeader || canCreateGroup) && (
            <div className="manage-block" data-testid="manage-group-members">
              <h3>{t("home.manageGroupMembers")}</h3>
              <div className="field">
                <label>{t("home.selectGroup")}</label>
                <select value={manageGroupId} onChange={(e) => setManageGroupId(e.target.value)}>
                  <option value="">{t("home.selectGroup")}</option>
                  {groupOptions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("home.pickMember")}</label>
                <select
                  value={manageMemberUserId}
                  onChange={(e) => setManageMemberUserId(e.target.value)}
                  data-testid="manage-member-picker"
                >
                  <option value="">{t("home.pickMember")}</option>
                  {directoryPeople.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn" disabled={busy} onClick={() => void addGroupMember()}>
                {t("home.addGroupMember")}
              </button>
              {manageGroupId && org && (
                <ul className="list" style={{ marginTop: "0.75rem" }}>
                  {(() => {
                    const find = (nodes: OrgNode[]): OrgNode | null => {
                      for (const n of nodes) {
                        if (n.id === manageGroupId) return n;
                        const c = find(n.children);
                        if (c) return c;
                      }
                      return null;
                    };
                    const node = find(org.tree);
                    return (node?.members ?? []).map((p) => (
                      <li key={p.userId}>
                        {personLabel(p)}
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ marginLeft: "0.5rem" }}
                          disabled={busy}
                          onClick={() => void removeGroupMember(manageGroupId, p.userId)}
                        >
                          {t("home.removeGroupMember")}
                        </button>
                      </li>
                    ));
                  })()}
                </ul>
              )}
            </div>
          )}

          {canCreateGroup && (
            <div className="manage-block" data-testid="manage-roles">
              <h3>{t("home.assignRoles")}</h3>
              <div className="field">
                <label>{t("home.pickMember")}</label>
                <select
                  value={roleTargetUserId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setRoleTargetUserId(id);
                    const hit = directoryPeople.find((p) => p.userId === id);
                    if (hit?.roles.length) {
                      setRoleDraft(hit.roles.filter((r): r is ChurchRole =>
                        (ASSIGNABLE_ROLES as readonly string[]).includes(r),
                      ));
                    }
                  }}
                  data-testid="manage-role-picker"
                >
                  <option value="">{t("home.pickMember")}</option>
                  {directoryPeople.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.label} · {p.roles.join(",")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="role-check-grid">
                {ASSIGNABLE_ROLES.map((r) => (
                  <label key={r} className="role-check">
                    <input
                      type="checkbox"
                      checked={roleDraft.includes(r)}
                      onChange={(e) => {
                        setRoleDraft((prev) =>
                          e.target.checked ? [...prev, r] : prev.filter((x) => x !== r),
                        );
                      }}
                    />
                    {t(`home.role.${r === "security_officer" ? "securityOfficer" : r}`)}
                  </label>
                ))}
              </div>
              <button type="button" className="btn" disabled={busy} onClick={() => void saveRoles()}>
                {t("home.saveRoles")}
              </button>
            </div>
          )}

          {(canManageChurch || canVerify) && (
            <div className="manage-block" data-testid="manage-advanced-link">
              <h3>{t("admin.title")}</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {t("home.manageAdvancedHint")}
              </p>
              <Link className="btn ghost" to="/app/admin">
                {t("admin.open")}
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
