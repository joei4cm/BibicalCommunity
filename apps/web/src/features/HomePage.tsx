import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ChurchRole, GroupKind, SecurityMode } from "@logoshome/shared";
import { api, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";
import { DadaoPanel } from "./DadaoPanel";

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

type HomeSection = "home" | "forum" | "manage";
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
  const [homeSection, setHomeSection] = useState<HomeSection>(() => {
    if (typeof window === "undefined") return "home";
    const raw = window.location.hash.replace(/^#/, "");
    return raw === "forum" || raw === "manage" || raw === "home" ? raw : "home";
  });
  const [churches, setChurches] = useState<Church[]>([]);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgTreeResponse | null>(null);
  const [activePerson, setActivePerson] = useState<OrgPerson | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [joinSlug, setJoinSlug] = useState("");
  const [securityMode, setSecurityMode] = useState<SecurityMode>("standard");
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
    void loadMembers().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadMembers]);

  useEffect(() => {
    if (homeSection === "manage" && !showManageTab && churches.length > 0) {
      setHomeSection("home");
    }
  }, [homeSection, showManageTab, churches.length]);

  useEffect(() => {
    const onHash = () => {
      const raw = window.location.hash.replace(/^#/, "");
      if (raw === "forum" || raw === "manage" || raw === "home") setHomeSection(raw);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = `#${homeSection}`;
    if (window.location.hash !== next) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${next}`,
      );
    }
  }, [homeSection]);

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

      {homeSection === "forum" && (
        <DadaoPanel
          churchId={selectedChurchId}
          churches={churches.map((c) => ({ id: c.id, name: c.name }))}
          onSelectChurch={setSelectedChurchId}
          membershipGroups={membershipGroups}
          onNeedHome={() => setHomeSection("home")}
        />
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
