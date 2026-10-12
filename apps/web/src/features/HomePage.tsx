import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ASSIGNABLE_CHURCH_ROLES,
  OFFICE_ROLES,
  securityOfficerOfficeHint,
  type ChurchRole,
  type ChurchRoleLayer,
  type GroupKind,
  type SecurityMode,
} from "@logoshome/shared";

const SYSTEM_ASSIGNABLE_ROLES = ASSIGNABLE_CHURCH_ROLES.filter((r) => r === "security_officer");
const OFFICE_ASSIGNABLE_ROLES = ASSIGNABLE_CHURCH_ROLES.filter((r) =>
  (OFFICE_ROLES as readonly string[]).includes(r),
);
import { api, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";
import { DadaoPanel } from "./DadaoPanel";
import { SheetPortal } from "../components/SheetPortal";

type Caps = {
  platformAdmin?: boolean;
  createGroup?: boolean;
  verifyMembers?: boolean;
  manageChurch?: boolean;
  isGroupLeader?: boolean;
  ledGroupIds?: string[];
  conveneAssembly?: boolean;
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
  signature?: string | null;
  groupNames?: string[];
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
  viewer: {
    roles: ChurchRole[];
    ledGroupIds: string[];
    roleLayer?: ChurchRoleLayer;
    capabilities: Caps;
  };
  tree: OrgNode[];
  leaders: OrgPerson[];
};

type AssemblyMember = OrgPerson & {
  roleLayer: ChurchRoleLayer;
  assemblyReasons: Array<"elder" | "deacon" | "group_leader" | "coworker">;
};

type AssemblyResponse = {
  churchId: string;
  includeChurchCoworkers: boolean;
  conversationTitle: string;
  members: AssemblyMember[];
  viewer: {
    isMember: boolean;
    canNotify: boolean;
    canOpenChat: boolean;
    roles: ChurchRole[];
    roleLayer: ChurchRoleLayer;
  };
};

type HomeSection = "home" | "forum" | "manage";
type ManageSub = "groups" | "verify" | "roles";
type ManageableGroup = {
  id: string;
  name: string;
  kind: string;
  canManage: boolean;
};
type GroupMemberRow = {
  userId: string;
  uid: string | null;
  nickname: string | null;
  role: string;
};
function personLabel(p: { nickname?: string | null; uid?: string | null; userId: string }): string {
  return p.nickname || p.uid || p.userId.slice(0, 10);
}

function roleLabelKey(role: string): string {
  return role === "security_officer" || role === "admin" ? "securityOfficer" : role;
}

function OrgTreeView({
  nodes,
  depth,
  onPerson,
  t,
  expanded,
  toggle,
}: {
  nodes: OrgNode[];
  depth: number;
  onPerson: (p: OrgPerson) => void;
  t: (k: string) => string;
  expanded: Set<string>;
  toggle: (id: string) => void;
}) {
  if (!nodes.length) return null;
  return (
    <ul className={`org-tree depth-${Math.min(depth, 3)}`} data-testid="org-tree">
      {nodes.map((node) => {
        const open = expanded.has(node.id);
        const hasBody = node.members.length > 0 || node.children.length > 0;
        return (
          <li key={node.id} className="org-tree-node">
            <div className="org-tree-label">
              {hasBody ? (
                <button
                  type="button"
                  className="org-tree-toggle"
                  aria-expanded={open}
                  onClick={() => toggle(node.id)}
                >
                  <span className="org-tree-caret" aria-hidden>
                    {open ? "▾" : "▸"}
                  </span>
                  <strong>{node.name}</strong>
                </button>
              ) : (
                <strong>{node.name}</strong>
              )}
              <span className="muted">
                {" "}
                · {t(node.kind === "department" ? "home.kind.department" : "home.kind.smallGroup")}
              </span>
            </div>
            {open && node.members.length > 0 && (
              <ul className="org-tree-people">
                {node.members.map((p) => (
                  <li key={`${node.id}-${p.userId}`}>
                    <button type="button" className="org-person-btn" onClick={() => onPerson(p)}>
                      <span className="org-person-name">{personLabel(p)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {open && (
              <OrgTreeView
                nodes={node.children}
                depth={depth + 1}
                onPerson={onPerson}
                t={t}
                expanded={expanded}
                toggle={toggle}
              />
            )}
          </li>
        );
      })}
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
  const [manageSub, setManageSub] = useState<ManageSub>("groups");
  const [churches, setChurches] = useState<Church[]>([]);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const [manageGroups, setManageGroups] = useState<ManageableGroup[]>([]);
  const [groupRoster, setGroupRoster] = useState<GroupMemberRow[]>([]);
  const [org, setOrg] = useState<OrgTreeResponse | null>(null);
  const [assembly, setAssembly] = useState<AssemblyResponse | null>(null);
  const [includeChurchCoworkers, setIncludeChurchCoworkers] = useState(true);
  const [assemblyNotifyOpen, setAssemblyNotifyOpen] = useState(false);
  const [assemblyNotifyTitle, setAssemblyNotifyTitle] = useState("");
  const [assemblyNotifyBody, setAssemblyNotifyBody] = useState("");
  const [activePerson, setActivePerson] = useState<OrgPerson | null>(null);
  const [orgExpanded, setOrgExpanded] = useState<Set<string>>(new Set());
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [pendingFriendIds, setPendingFriendIds] = useState<Set<string>>(new Set());
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
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
  // Org tree starts collapsed — person names only after the user expands a node.


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
    // Prefer API list (includes empty groups admins can manage).
    if (manageGroups.length > 0) {
      return manageGroups
        .filter((g) => (canCreateGroup ? true : g.canManage))
        .map((g) => ({ id: g.id, name: g.name, kind: g.kind }));
    }
    const opts: { id: string; name: string; kind: string }[] = [];
    const walk = (nodes: OrgNode[]) => {
      for (const n of nodes) {
        opts.push({ id: n.id, name: n.name, kind: n.kind });
        walk(n.children);
      }
    };
    if (org) walk(org.tree);
    if (canCreateGroup) return opts;
    const prefer = new Set(ledGroupIds);
    return opts.filter((o) => prefer.has(o.id));
  }, [manageGroups, org, ledGroupIds, canCreateGroup]);

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

  const loadAssembly = useCallback(async () => {
    if (!getToken() || !selectedChurchId) {
      setAssembly(null);
      return;
    }
    try {
      const qs = includeChurchCoworkers ? "" : "?includeCoworkers=0";
      const r = await api<AssemblyResponse>(
        `/v1/home/${encodeURIComponent(selectedChurchId)}/coworker-assembly${qs}`,
      );
      setAssembly(r);
    } catch {
      setAssembly(null);
    }
  }, [selectedChurchId, includeChurchCoworkers]);

  const loadMembers = useCallback(async () => {
    if (!getToken() || !selectedChurchId || !(canVerify || isGroupLeader || canCreateGroup)) {
      setMembers([]);
      return;
    }
    const r = await api<{ members: ChurchMember[] }>(
      `/v1/home/${encodeURIComponent(selectedChurchId)}/members`,
    );
    setMembers(r.members ?? []);
  }, [selectedChurchId, canVerify, isGroupLeader, canCreateGroup]);

  const loadManageGroups = useCallback(async () => {
    if (!getToken() || !selectedChurchId) {
      setManageGroups([]);
      return;
    }
    const r = await api<{ groups: ManageableGroup[] }>(
      `/v1/home/${encodeURIComponent(selectedChurchId)}/groups`,
    );
    setManageGroups(r.groups ?? []);
  }, [selectedChurchId]);

  const loadGroupRoster = useCallback(async () => {
    if (!getToken() || !manageGroupId) {
      setGroupRoster([]);
      return;
    }
    try {
      const r = await api<{ members: GroupMemberRow[] }>(
        `/v1/home/groups/${encodeURIComponent(manageGroupId)}/members`,
      );
      setGroupRoster(r.members ?? []);
    } catch {
      setGroupRoster([]);
    }
  }, [manageGroupId]);

  useEffect(() => {
    void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [refresh]);

  const refreshFriendState = useCallback(async () => {
    if (!getToken()) return;
    const [me, fr, reqs] = await Promise.all([
      api<{ id?: string; userId?: string }>("/v1/me").catch(
        (): { id?: string; userId?: string } => ({}),
      ),
      api<{ friends: { user: { id: string } }[] }>("/v1/friends").catch(() => ({ friends: [] })),
      api<{
        outgoing: { user: { id: string } }[];
      }>("/v1/friends/requests").catch(() => ({ outgoing: [] })),
    ]);
    const sid = me.id ?? me.userId ?? null;
    if (sid) setSelfUserId(sid);
    setFriendIds(new Set(fr.friends.map((f) => f.user.id)));
    setPendingFriendIds(new Set(reqs.outgoing.map((r) => r.user.id)));
  }, []);

  useEffect(() => {
    void refreshFriendState().catch(() => {
      /* optional for card CTAs */
    });
  }, [refreshFriendState]);

  // Defer heavy org-tree decrypt until manage tab (or shortly after home paint).
  useEffect(() => {
    if (homeSection === "manage") {
      void loadOrg().catch((e) => setNote(e instanceof Error ? e.message : "error"));
      void loadMembers().catch((e) => setNote(e instanceof Error ? e.message : "error"));
      return;
    }
    const timer = window.setTimeout(() => {
      void loadOrg().catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [homeSection, loadOrg, loadMembers]);

  useEffect(() => {
    // Assembly is a group chat — only need viewer.canOpenChat, load lazily.
    if (!selectedChurchId) return;
    const t = window.setTimeout(() => {
      void loadAssembly().catch(() => setAssembly(null));
    }, 400);
    return () => window.clearTimeout(t);
  }, [loadAssembly, selectedChurchId]);

  useEffect(() => {
    if (homeSection !== "manage") return;
    void loadManageGroups().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [homeSection, loadManageGroups]);

  useEffect(() => {
    if (homeSection !== "manage" || manageSub !== "groups") return;
    void loadGroupRoster().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [homeSection, manageSub, loadGroupRoster]);

  useEffect(() => {
    // Wait until churches have loaded — otherwise caps are still empty and we'd
    // bounce #manage → home before admin capabilities arrive.
    if (homeSection === "manage" && !showManageTab && churches.length > 0) {
      setHomeSection("home");
    }
  }, [homeSection, showManageTab, churches.length]);

  useEffect(() => {
    const onHash = () => {
      const raw = window.location.hash.replace(/^#/, "");
      if (raw === "forum" || raw === "manage" || raw === "home") {
        setHomeSection(raw);
      }
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

  useEffect(() => {
    const available: ManageSub[] = [];
    if (isGroupLeader || canCreateGroup) available.push("groups");
    if (canVerify) available.push("verify");
    if (canCreateGroup) available.push("roles");
    const first = available[0];
    if (first && !available.includes(manageSub)) {
      setManageSub(first);
    }
  }, [isGroupLeader, canCreateGroup, canVerify, manageSub]);

  useEffect(() => {
    setManageGroupId("");
  }, [selectedChurchId]);

  useEffect(() => {
    if (!manageGroupId && groupOptions.length > 0) {
      const firstManageable =
        groupOptions.find((g) => manageGroups.find((m) => m.id === g.id)?.canManage) ??
        groupOptions[0];
      if (firstManageable) setManageGroupId(firstManageable.id);
    } else if (
      manageGroupId &&
      groupOptions.length > 0 &&
      !groupOptions.some((g) => g.id === manageGroupId)
    ) {
      setManageGroupId(groupOptions[0]?.id ?? "");
    }
  }, [groupOptions, manageGroupId, manageGroups]);

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
      await loadManageGroups();
      setManageSub("groups");
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
      await loadGroupRoster();
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
      await loadGroupRoster();
      await loadOrg();
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function setGroupLeader(userId: string, role: "leader" | "member") {
    if (!manageGroupId) return;
    setBusy(true);
    try {
      await api(`/v1/home/groups/${encodeURIComponent(manageGroupId)}/members`, {
        method: "POST",
        body: JSON.stringify({ userId, role }),
      });
      setNote("saved");
      await loadGroupRoster();
      await loadOrg();
      await loadAssembly();
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
      await loadAssembly();
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function addFriendFromCard(p: OrgPerson) {
    if (friendIds.has(p.userId) || pendingFriendIds.has(p.userId)) return;
    if (selfUserId && p.userId === selfUserId) return;
    setFriendBusy(true);
    try {
      await api("/v1/friends/request", {
        method: "POST",
        body: JSON.stringify({ userId: p.userId }),
      });
      setPendingFriendIds((prev) => new Set([...prev, p.userId]));
      setNote("friend_request_sent");
      await refreshFriendState().catch(() => {});
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setFriendBusy(false);
    }
  }

  async function sendAssemblyNotify() {
    if (!selectedChurchId || !assemblyNotifyTitle.trim()) return;
    setBusy(true);
    try {
      await api(`/v1/home/${encodeURIComponent(selectedChurchId)}/coworker-assembly/notify`, {
        method: "POST",
        body: JSON.stringify({
          title: assemblyNotifyTitle.trim(),
          body: assemblyNotifyBody.trim(),
        }),
      });
      setAssemblyNotifyOpen(false);
      setAssemblyNotifyTitle("");
      setAssemblyNotifyBody("");
      setNote("assembly_notify_sent");
      setHomeSection("forum");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function openAssemblyChat() {
    if (!selectedChurchId) return;
    setBusy(true);
    try {
      const r = await api<{ conversationId: string }>(
        `/v1/home/${encodeURIComponent(selectedChurchId)}/coworker-assembly/chat`,
        { method: "POST", body: "{}" },
      );
      navigate(`/app/chat?conversation=${encodeURIComponent(r.conversationId)}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  const roleHint = securityOfficerOfficeHint(roleDraft);

  const sectionTabs = (
    [
      ["home", t("home.tabHome")],
      ["forum", t("home.tabForum")],
      ...(showManageTab ? ([["manage", t("home.tabManage")]] as const) : []),
    ] as const
  );

  return (
    <section className="fade-up home-page app-folio" data-testid="home-page">
      <div className="home-atmosphere" aria-hidden="true" />
      {note && <p className="muted home-note">{humanizeStatus(t, note)}</p>}

      <header className="home-hub-header">
        <div className="home-hub-kicker">{t("nav.community")}</div>
        <p className="home-hub-support">{t("home.communityHint")}</p>
      </header>

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
          <div className="home-church-hub" data-testid="home-church-panel">
            <div className="home-church-switcher" role="list" aria-label={t("home.myHomes")}>
              {churches.length === 0 && <p className="muted">{t("home.noHomes")}</p>}
              {churches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="listitem"
                  className={`home-church-chip${selectedChurchId === c.id ? " is-selected" : ""}`}
                  onClick={() => setSelectedChurchId(c.id)}
                >
                  <span className="home-church-chip-name">{c.name}</span>
                  <span className="home-church-chip-meta">
                    {c.slug ? c.slug : (c.roles ?? [c.role])[0]}
                    {c.securityMode === "hostile"
                      ? ` · ${t("home.securityMode.hostileBadge")}`
                      : ""}
                  </span>
                </button>
              ))}
            </div>

            <details className="home-join-block" open={churches.length === 0}>
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
              <details className="home-join-block">
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
            <div className="home-current" data-testid="home-info-panel">
              <div className="home-current-identity">
                <h2 className="home-current-name">{org.church.name}</h2>
                <p className="home-current-meta">
                  {org.church.slug}
                  {" · "}
                  {org.church.securityMode === "hostile"
                    ? t("home.securityMode.hostileBadge")
                    : t("home.securityMode.standardBadge")}
                  {" · "}
                  {(org.viewer.roles ?? [])
                    .map((r) => t(`home.role.${roleLabelKey(r)}`))
                    .join(" · ")}
                  {org.viewer.roleLayer
                    ? ` · ${t(`home.roleLayer.${org.viewer.roleLayer}`)}`
                    : ""}
                </p>
              </div>
              <div className="home-org-block">
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
                    expanded={orgExpanded}
                    toggle={(id) =>
                      setOrgExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                  />
                )}
              </div>
            </div>
          )}

          {selectedChurch && assembly?.viewer.canOpenChat && (
            <div className="home-assembly" data-testid="home-assembly">
              <div className="home-assembly-copy">
                <h2>{t("home.assembly.title")}</h2>
                <p className="muted">{t("home.assembly.openChatOnly")}</p>
              </div>
              <button
                type="button"
                className="btn"
                disabled={busy}
                data-testid="home-assembly-chat-btn"
                onClick={() => void openAssemblyChat()}
              >
                {t("home.assembly.openChat")}
              </button>
            </div>
          )}

          {activePerson && (
            <SheetPortal>
            <div
              className="sheet-backdrop"
              role="presentation"
              data-testid="home-person-sheet"
              onClick={() => setActivePerson(null)}
            >
              <div
                className="sheet-panel person-card-sheet"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sheet-handle" aria-hidden />
                <div className="chat-sheet-head">
                  <h3 style={{ margin: 0 }}>{personLabel(activePerson)}</h3>
                  <button type="button" className="btn ghost" onClick={() => setActivePerson(null)}>
                    ✕
                  </button>
                </div>
                <dl className="person-card-meta">
                  <div>
                    <dt>{t("home.card.nickname")}</dt>
                    <dd>{activePerson.nickname || t("home.card.noNickname")}</dd>
                  </div>
                  <div>
                    <dt>{t("home.card.groups")}</dt>
                    <dd>
                      {(activePerson.groupNames && activePerson.groupNames.length
                        ? activePerson.groupNames.join(" · ")
                        : t("home.card.noGroup"))}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("home.card.signature")}</dt>
                    <dd>{activePerson.signature?.trim() || t("home.card.noSignature")}</dd>
                  </div>
                  <div>
                    <dt>{t("home.card.roles")}</dt>
                    <dd>
                      {activePerson.roles.length
                        ? activePerson.roles
                            .map((r) => t(`home.role.${roleLabelKey(r)}`))
                            .join(" · ")
                        : t("home.role.member")}
                    </dd>
                  </div>
                </dl>
                {(() => {
                  const isSelf = Boolean(selfUserId && activePerson.userId === selfUserId);
                  const isFriend = friendIds.has(activePerson.userId);
                  const isPending = pendingFriendIds.has(activePerson.userId);
                  return (
                    <div className="sheet-actions person-card-actions" data-testid="home-person-actions">
                      {isSelf ? (
                        <p className="muted" style={{ margin: 0 }} data-testid="home-person-self">
                          {t("home.card.self")}
                        </p>
                      ) : isFriend ? (
                        <Link
                          className="btn"
                          data-testid="home-open-chat"
                          to={`/app/chat?peer=${encodeURIComponent(activePerson.userId)}`}
                        >
                          {t("comms.openChat")}
                        </Link>
                      ) : isPending ? (
                        <button
                          type="button"
                          className="btn"
                          data-testid="home-friend-pending"
                          disabled
                        >
                          {t("home.friendRequestSent")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          data-testid="home-add-friend"
                          disabled={friendBusy}
                          onClick={() => void addFriendFromCard(activePerson)}
                        >
                          {t("home.addFriend")}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            </SheetPortal>
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

          <div className="manage-subtabs" role="tablist" data-testid="manage-subtabs">
            {(
              [
                ...(isGroupLeader || canCreateGroup
                  ? ([["groups", t("home.manageSub.groups")]] as const)
                  : []),
                ...(canVerify ? ([["verify", t("home.manageSub.verify")]] as const) : []),
                ...(canCreateGroup ? ([["roles", t("home.manageSub.roles")]] as const) : []),
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={manageSub === id}
                className={`manage-subtab${manageSub === id ? " is-active" : ""}`}
                data-testid={`manage-sub-${id}`}
                onClick={() => setManageSub(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {manageSub === "groups" && (isGroupLeader || canCreateGroup) && (
            <div data-testid="manage-group-members">
              <div className="manage-groups-split">
                <div>
                  <h3>{t("admin.groupList")}</h3>
                  <ul className="list manage-group-cards">
                    {groupOptions.length === 0 && (
                      <li className="muted">{t("home.noGroups")}</li>
                    )}
                    {groupOptions.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          className={`church-row${manageGroupId === g.id ? " is-selected" : ""}`}
                          onClick={() => setManageGroupId(g.id)}
                        >
                          <div className="church-row-title">{g.name}</div>
                          <div className="muted">
                            {g.kind === "department"
                              ? t("home.kind.department")
                              : t("home.kind.smallGroup")}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>

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
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void createGroup()}
                      >
                        {t("home.createGroup")}
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  {manageGroupId ? (
                    <>
                      <h3>
                        {groupOptions.find((g) => g.id === manageGroupId)?.name ??
                          t("home.manageGroupMembers")}
                      </h3>
                      <p className="muted" style={{ marginTop: 0 }}>
                        {t("home.manageGroupMembers")}
                      </p>
                      <ul className="list">
                        {groupRoster.length === 0 && (
                          <li className="muted">{t("home.noGroupMembers")}</li>
                        )}
                        {groupRoster.map((p) => (
                          <li key={p.userId}>
                            <strong>{p.nickname || p.uid || p.userId}</strong>
                            <div className="muted">
                              {p.role === "leader"
                                ? t("home.role.groupLeader")
                                : t("home.role.member")}
                            </div>
                            <div className="toolbar" style={{ marginTop: "0.35rem" }}>
                              {p.role !== "leader" ? (
                                <button
                                  type="button"
                                  className="btn ghost"
                                  disabled={busy}
                                  onClick={() => void setGroupLeader(p.userId, "leader")}
                                >
                                  {t("home.makeLeader")}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn ghost"
                                  disabled={busy}
                                  onClick={() => void setGroupLeader(p.userId, "member")}
                                >
                                  {t("home.removeLeader")}
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn danger"
                                disabled={busy}
                                onClick={() => void removeGroupMember(manageGroupId, p.userId)}
                              >
                                {t("home.removeGroupMember")}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>

                      <h3 style={{ marginTop: "1rem" }}>{t("home.addGroupMember")}</h3>
                      <div className="field">
                        <label>{t("home.pickMember")}</label>
                        <select
                          value={manageMemberUserId}
                          onChange={(e) => setManageMemberUserId(e.target.value)}
                          data-testid="manage-member-picker"
                        >
                          <option value="">{t("home.pickMember")}</option>
                          {directoryPeople
                            .filter((p) => !groupRoster.some((g) => g.userId === p.userId))
                            .map((p) => (
                              <option key={p.userId} value={p.userId}>
                                {p.label}
                              </option>
                            ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy || !manageMemberUserId}
                        onClick={() => void addGroupMember()}
                      >
                        {t("home.addGroupMember")}
                      </button>
                    </>
                  ) : (
                    <p className="muted">{t("admin.pickGroupHint")}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {manageSub === "verify" && canVerify && (
            <div data-testid="manage-verify">
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

          {manageSub === "roles" && canCreateGroup && (
            <div data-testid="manage-roles">
              <h3>{t("home.assignRoles")}</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {t("home.assignRolesHint")}
              </p>
              <div className="field">
                <label>{t("home.pickMember")}</label>
                <select
                  value={roleTargetUserId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setRoleTargetUserId(id);
                    const hit = directoryPeople.find((p) => p.userId === id);
                    if (hit?.roles.length) {
                      setRoleDraft(
                        hit.roles.filter((r): r is ChurchRole =>
                          (ASSIGNABLE_CHURCH_ROLES as readonly string[]).includes(r) ||
                          r === "admin",
                        ).map((r) => (r === "admin" ? "security_officer" : r)),
                      );
                    }
                  }}
                  data-testid="manage-role-picker"
                >
                  <option value="">{t("home.pickMember")}</option>
                  {directoryPeople.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.label}
                      {p.roles.length
                        ? ` · ${p.roles.map((r) => t(`home.role.${roleLabelKey(r)}`)).join(" · ")}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="role-group">
                <legend>{t("home.roleGroup.system")}</legend>
                <div className="role-check-grid">
                  {SYSTEM_ASSIGNABLE_ROLES.map((r) => (
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
                      {t(`home.role.${roleLabelKey(r)}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="role-group">
                <legend>{t("home.roleGroup.office")}</legend>
                <div className="role-check-grid">
                  {OFFICE_ASSIGNABLE_ROLES.map((r) => (
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
                      {t(`home.role.${roleLabelKey(r)}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              {roleHint.missingElder && (
                <p className="muted" data-testid="security-officer-hint">
                  {t("home.roleHint.securityOfficer")}
                </p>
              )}
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
              <Link className="btn ghost" to="/app/admin#groups">
                {t("admin.openGroups")}
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
