import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SecurityMode } from "@logoshome/shared";
import { api, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";

function adminRoleLabelKey(role: string): string {
  return role === "security_officer" || role === "admin" ? "securityOfficer" : role;
}

function normalizeAdminSelectRole(role: string): string {
  return role === "admin" ? "security_officer" : role;
}

type AdminAccess = {
  platformAdmin: boolean;
  canAccessConsole: boolean;
  churches: Array<{
    churchId: string;
    name: string;
    slug: string;
    role: string;
    securityMode: string;
  }>;
};

type AdminChurch = {
  id: string;
  name: string;
  slug: string;
  securityMode: string;
  memberCount: number;
  groupCount: number;
  role: string;
};

type AdminMember = {
  membershipId: string;
  userId: string;
  uid: string | null;
  role: string;
  verified: boolean;
  tombstoned: boolean;
  platformRole: string | null;
  groups: string[];
  createdAt: number;
};

type AdminGroup = {
  id: string;
  churchId: string;
  name: string;
  kind?: string;
  parentId?: string | null;
  createdAt: number;
};

type GroupMemberRow = {
  userId: string;
  uid: string | null;
  nickname: string | null;
  role: string;
};

type AdminUser = {
  userId: string;
  uid: string | null;
  tombstoned: boolean;
  platformRole: string | null;
  createdAt: number;
  memberships: Array<{ churchId: string; role: string; verified: boolean }>;
};

type WipeCommand = {
  id: string;
  userId: string;
  deviceId: string | null;
  issuedBy: string;
  reasonCode: string;
  status: string;
  issuedAt: number;
  expiresAt: number;
};

type Section = "homes" | "users" | "groups" | "wipe" | "corpus";

const SECTION_IDS: Section[] = ["homes", "users", "groups", "wipe", "corpus"];

const PD_CORPUS_TIDS = ["web", "kjv", "asv", "cuvs"] as const;

type PdCorpusStatus = {
  tid: string;
  objectCount: number;
  fullPackLikely: boolean;
  sampleKeys: string[];
};

function sectionFromHash(): Section {
  if (typeof window === "undefined") return "homes";
  const raw = window.location.hash.replace(/^#/, "");
  return SECTION_IDS.includes(raw as Section) ? (raw as Section) : "homes";
}

export function AdminConsole() {
  const { t } = useTranslation();
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [churches, setChurches] = useState<AdminChurch[]>([]);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [wipes, setWipes] = useState<WipeCommand[]>([]);
  const [section, setSection] = useState<Section>(() => sectionFromHash());
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupKind, setGroupKind] = useState<"small_group" | "department">("small_group");
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMemberRow[]>([]);
  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [addMemberAsLeader, setAddMemberAsLeader] = useState(false);
  const [churchName, setChurchName] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [churchFilter, setChurchFilter] = useState("");
  const [pdTid, setPdTid] = useState<(typeof PD_CORPUS_TIDS)[number]>("web");
  const [pdBookNr, setPdBookNr] = useState(43);
  const [pdStatuses, setPdStatuses] = useState<PdCorpusStatus[]>([]);
  const [pdProgress, setPdProgress] = useState<string | null>(null);

  const selected = churches.find((c) => c.id === churchId) ?? null;
  const filterQ = churchFilter.trim().toLowerCase();
  const filteredChurches = filterQ
    ? churches.filter(
        (c) =>
          c.name.toLowerCase().includes(filterQ) ||
          c.slug.toLowerCase().includes(filterQ) ||
          c.id.toLowerCase().includes(filterQ),
      )
    : churches;
  /** Keep the select short unless the admin is actively filtering. */
  const pickerChurches = (() => {
    if (filterQ) {
      if (filteredChurches.length > 0) return filteredChurches.slice(0, 40);
      return selected ? [selected] : churches.slice(0, 1);
    }
    if (churches.length <= 8) return churches;
    const head = selected ? [selected] : [];
    const rest = churches.filter((c) => c.id !== selected?.id).slice(0, 7);
    return [...head, ...rest];
  })();

  const loadAccess = useCallback(async () => {
    if (!getToken()) {
      setAccess(null);
      setNote("login_required");
      return;
    }
    const a = await api<AdminAccess>("/v1/admin/access");
    setAccess(a);
    if (!a.canAccessConsole) {
      setNote("admin.forbidden");
    }
  }, []);

  const loadChurches = useCallback(async () => {
    if (!getToken()) return;
    const r = await api<{ churches: AdminChurch[]; platformAdmin: boolean }>("/v1/admin/churches");
    setChurches(r.churches);
    setChurchId((prev) => prev ?? r.churches[0]?.id ?? null);
  }, []);

  const loadMembers = useCallback(async () => {
    if (!getToken() || !churchId) {
      setMembers([]);
      return;
    }
    const r = await api<{ members: AdminMember[] }>(
      `/v1/admin/churches/${encodeURIComponent(churchId)}/members`,
    );
    setMembers(r.members);
  }, [churchId]);

  const loadGroups = useCallback(async () => {
    if (!getToken() || !churchId) {
      setGroups([]);
      setActiveGroupId(null);
      setGroupMembers([]);
      return;
    }
    const r = await api<{ groups: AdminGroup[] }>(
      `/v1/admin/churches/${encodeURIComponent(churchId)}/groups`,
    );
    setGroups(r.groups);
    setActiveGroupId((prev) =>
      prev && r.groups.some((g) => g.id === prev) ? prev : (r.groups[0]?.id ?? null),
    );
  }, [churchId]);

  const loadGroupMembers = useCallback(async () => {
    if (!getToken() || !activeGroupId) {
      setGroupMembers([]);
      return;
    }
    const r = await api<{ members: GroupMemberRow[] }>(
      `/v1/home/groups/${encodeURIComponent(activeGroupId)}/members`,
    );
    setGroupMembers(r.members ?? []);
  }, [activeGroupId]);

  const loadUsers = useCallback(async () => {
    if (!getToken()) return;
    const q = churchId ? `?churchId=${encodeURIComponent(churchId)}` : "";
    const r = await api<{ users: AdminUser[] }>(`/v1/admin/users${q}`);
    setUsers(r.users);
  }, [churchId]);

  const loadWipes = useCallback(async () => {
    if (!getToken()) return;
    const r = await api<{ commands: WipeCommand[] }>("/v1/admin/wipe/commands");
    setWipes(r.commands);
  }, []);

  useEffect(() => {
    void loadAccess()
      .then(() => loadChurches())
      .catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadAccess, loadChurches]);

  useEffect(() => {
    if (!access?.canAccessConsole) return;
    void Promise.all([loadMembers(), loadGroups(), loadUsers(), loadWipes()]).catch((e) =>
      setNote(e instanceof Error ? e.message : "error"),
    );
  }, [access, loadMembers, loadGroups, loadUsers, loadWipes]);

  useEffect(() => {
    if (!access?.canAccessConsole || section !== "groups") return;
    void loadGroupMembers()
      .then(() => setNote((n) => (n === "forbidden" ? null : n)))
      .catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [access, section, loadGroupMembers]);

  useEffect(() => {
    if (selected) setChurchName(selected.name);
  }, [selected]);

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (section !== "corpus" || !access?.platformAdmin) return;
    void loadPdStatuses().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [section, access?.platformAdmin]);

  function goSection(id: Section) {
    setSection(id);
    if (typeof window !== "undefined") {
      const next = `#${id}`;
      if (window.location.hash !== next) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${next}`);
      }
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNote(null);
    try {
      await action();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveChurch() {
    if (!churchId) return;
    await run(async () => {
      await api(`/v1/admin/churches/${encodeURIComponent(churchId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: churchName.trim() || undefined }),
      });
      setNote("saved");
      await loadChurches();
    });
  }

  async function setSecurityMode(mode: SecurityMode) {
    if (!churchId) return;
    await run(async () => {
      await api(`/v1/admin/churches/${encodeURIComponent(churchId)}`, {
        method: "PATCH",
        body: JSON.stringify({ securityMode: mode }),
      });
      setNote("saved");
      await loadChurches();
    });
  }

  async function patchMember(userId: string, body: Record<string, unknown>) {
    if (!churchId) return;
    await run(async () => {
      await api(
        `/v1/admin/churches/${encodeURIComponent(churchId)}/members/${encodeURIComponent(userId)}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      setNote("saved");
      await loadMembers();
      await loadUsers();
    });
  }

  async function removeMember(userId: string) {
    if (!churchId) return;
    if (!window.confirm(t("admin.removeMemberConfirm"))) return;
    await run(async () => {
      await api(
        `/v1/admin/churches/${encodeURIComponent(churchId)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      setNote("saved");
      await loadMembers();
      await loadUsers();
      await loadChurches();
    });
  }

  async function createGroup() {
    if (!churchId || !groupName.trim()) return;
    await run(async () => {
      const created = await api<{ id: string }>(
        `/v1/admin/churches/${encodeURIComponent(churchId)}/groups`,
        {
          method: "POST",
          body: JSON.stringify({ name: groupName.trim(), kind: groupKind }),
        },
      );
      setGroupName("");
      setNote("group_created");
      await loadGroups();
      await loadChurches();
      if (created.id) setActiveGroupId(created.id);
    });
  }

  async function addToGroup() {
    if (!activeGroupId || !addMemberUserId) return;
    await run(async () => {
      await api(`/v1/home/groups/${encodeURIComponent(activeGroupId)}/members`, {
        method: "POST",
        body: JSON.stringify({
          userId: addMemberUserId,
          role: addMemberAsLeader ? "leader" : "member",
        }),
      });
      setAddMemberUserId("");
      setAddMemberAsLeader(false);
      setNote("group_member_added");
      await loadGroupMembers();
      await loadMembers();
    });
  }

  async function removeFromGroup(userId: string) {
    if (!activeGroupId) return;
    await run(async () => {
      await api(
        `/v1/home/groups/${encodeURIComponent(activeGroupId)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      setNote("group_member_removed");
      await loadGroupMembers();
    });
  }

  async function setGroupMemberRole(userId: string, role: "leader" | "member") {
    if (!activeGroupId) return;
    await run(async () => {
      await api(`/v1/home/groups/${encodeURIComponent(activeGroupId)}/members`, {
        method: "POST",
        body: JSON.stringify({ userId, role }),
      });
      setNote("saved");
      await loadGroupMembers();
    });
  }

  async function renameGroup() {
    if (!renameGroupId || !renameValue.trim()) return;
    await run(async () => {
      await api(`/v1/admin/groups/${encodeURIComponent(renameGroupId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      setRenameGroupId(null);
      setRenameValue("");
      setNote("saved");
      await loadGroups();
    });
  }

  async function deleteGroup(groupId: string) {
    if (!window.confirm(t("admin.deleteGroupConfirm"))) return;
    await run(async () => {
      await api(`/v1/admin/groups/${encodeURIComponent(groupId)}`, { method: "DELETE" });
      setNote("saved");
      await loadGroups();
      await loadMembers();
      await loadChurches();
    });
  }

  async function remoteWipe(userId: string) {
    if (!window.confirm(t("security.adminWipeConfirm"))) return;
    await run(async () => {
      await api("/v1/admin/wipe", {
        method: "POST",
        body: JSON.stringify({ userId, reasonCode: "admin" }),
      });
      setNote("admin_wipe_issued");
      await loadUsers();
      await loadMembers();
      await loadWipes();
    });
  }

  async function bootstrapPlatform() {
    await run(async () => {
      await api("/v1/admin/platform/bootstrap", {
        method: "POST",
        body: JSON.stringify({ secret: bootstrapSecret }),
      });
      setBootstrapSecret("");
      setNote("admin.bootstrapOk");
      await loadAccess();
      await loadChurches();
      await loadUsers();
    });
  }

  async function loadPdStatuses() {
    const rows: PdCorpusStatus[] = [];
    for (const tid of PD_CORPUS_TIDS) {
      const r = await api<PdCorpusStatus>(`/v1/admin/corpus/pd-status/${tid}`);
      rows.push(r);
    }
    setPdStatuses(rows);
  }

  async function seedPdBook(tid: string, bookNr: number) {
    return api<{
      ok: boolean;
      book: string;
      chaptersPut: number;
      nextBookNr: number | null;
      done: boolean;
    }>("/v1/admin/corpus/pd-seed", {
      method: "POST",
      body: JSON.stringify({ tid, bookNr }),
    });
  }

  async function seedOnePdBook() {
    await run(async () => {
      setPdProgress(`${pdTid} #${pdBookNr}`);
      const r = await seedPdBook(pdTid, pdBookNr);
      setPdProgress(`${r.book} · ${r.chaptersPut}`);
      setNote("admin.corpusSeedOk");
      await loadPdStatuses();
    });
  }

  async function seedFullPdCanon() {
    if (!window.confirm(t("admin.corpusSeedAll"))) return;
    await run(async () => {
      let bookNr = 1;
      let total = 0;
      while (bookNr <= 66) {
        setPdProgress(`${pdTid} #${bookNr}/66`);
        const r = await seedPdBook(pdTid, bookNr);
        total += r.chaptersPut;
        if (r.done || r.nextBookNr == null) break;
        bookNr = r.nextBookNr;
      }
      setPdProgress(`${pdTid} · ${total}`);
      setNote("admin.corpusSeedOk");
      await loadPdStatuses();
    });
  }

  if (!getToken()) {
    return (
      <section className="fade-up" data-testid="admin-console">
        <h1 className="brand">{t("admin.title")}</h1>
        <p className="muted">{t("auth.loginRequired")}</p>
        <Link className="btn" to="/app/me">
          {t("nav.me")}
        </Link>
      </section>
    );
  }

  if (access && !access.canAccessConsole) {
    return (
      <section className="fade-up" data-testid="admin-console">
        <h1 className="brand">{t("admin.title")}</h1>
        <p className="muted" role="status">
          {t("admin.forbidden")}
        </p>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("admin.bootstrap")}</h2>
          <p className="muted">{t("admin.bootstrapHint")}</p>
          <div className="field">
            <label>{t("admin.bootstrapSecret")}</label>
            <input
              type="password"
              value={bootstrapSecret}
              onChange={(e) => setBootstrapSecret(e.target.value)}
              data-testid="admin-bootstrap-secret"
            />
          </div>
          <button
            type="button"
            className="btn"
            disabled={busy || !bootstrapSecret}
            data-testid="admin-bootstrap"
            onClick={() => void bootstrapPlatform()}
          >
            {t("admin.bootstrap")}
          </button>
        </div>
        {note ? <p className="muted">{humanizeStatus(t, note)}</p> : null}
      </section>
    );
  }

  const sections: Array<{ id: Section; label: string }> = [
    { id: "homes", label: t("admin.sectionHomes") },
    { id: "users", label: t("admin.sectionUsers") },
    { id: "groups", label: t("admin.sectionGroups") },
    { id: "wipe", label: t("admin.sectionWipe") },
    ...(access?.platformAdmin
      ? [{ id: "corpus" as const, label: t("admin.sectionCorpus") }]
      : []),
  ];

  return (
    <section className="admin-console fade-up" data-testid="admin-console">
      <aside className="admin-sidebar" aria-label={t("admin.title")}>
        <div className="admin-sidebar-brand">
          <h1 className="brand">{t("admin.title")}</h1>
          <p className="muted admin-sidebar-role">
            {access?.platformAdmin ? t("admin.platformAdmin") : t("admin.churchAdmin")}
          </p>
        </div>
        <nav className="admin-nav" role="tablist">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={section === s.id}
              className={`admin-nav-item${section === s.id ? " is-active" : ""}`}
              data-testid={`admin-tab-${s.id}`}
              onClick={() => goSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <p className="muted" style={{ fontSize: "0.82rem" }}>
            {t("admin.desktopHint")}
          </p>
          <Link className="btn ghost" to="/app/home" data-testid="admin-back-app">
            {t("admin.backToApp")}
          </Link>
        </div>
      </aside>

      <div className="admin-main">
        {note ? <p className="muted admin-banner">{humanizeStatus(t, note)}</p> : null}

      <div className="panel" data-testid="admin-church-picker">
        <h2 style={{ marginTop: 0 }}>{t("admin.selectHome")}</h2>
        {churches.length === 0 ? (
          <p className="muted">—</p>
        ) : (
          <>
            {churches.length > 8 ? (
              <div className="field">
                <label htmlFor="admin-church-filter">{t("admin.selectHome")}</label>
                <input
                  id="admin-church-filter"
                  data-testid="admin-church-filter"
                  value={churchFilter}
                  onChange={(e) => setChurchFilter(e.target.value)}
                  placeholder={t("me.search")}
                />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="admin-church-select">{t("admin.selectHome")}</label>
              <select
                id="admin-church-select"
                data-testid="admin-church-select"
                value={churchId ?? ""}
                onChange={(e) => setChurchId(e.target.value || null)}
              >
                {pickerChurches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.securityMode === "hostile" ? ` (${t("home.securityMode.hostileBadge")})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {selected ? (
              <p className="muted" data-testid="admin-church-meta">
                {selected.role} · {selected.memberCount} {t("admin.members")} ·{" "}
                {selected.groupCount} {t("admin.groups")}
                {selected.securityMode === "hostile" ? (
                  <span className="badge-hostile"> · {t("home.securityMode.hostileBadge")}</span>
                ) : null}
              </p>
            ) : null}
            {section === "homes" && pickerChurches.length > 1 ? (
              <ul className="list" data-testid="admin-church-list">
                {pickerChurches.slice(0, 40).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`btn ghost${churchId === c.id ? " active-toggle" : ""}`}
                      onClick={() => setChurchId(c.id)}
                    >
                      {c.name}
                      {churchId === c.id ? ` · ${t("home.selected")}` : ""}
                    </button>
                    <div className="muted">
                      {c.role} · {c.memberCount} {t("admin.members")} · {c.groupCount}{" "}
                      {t("admin.groups")}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>

      {section === "homes" && (
        <div className="panel" data-testid="admin-homes-panel">
          <h2 style={{ marginTop: 0 }}>{t("admin.sectionHomes")}</h2>
          {!selected ? (
            <p className="muted">—</p>
          ) : (
            <>
              <div className="field">
                <label>{t("home.churchName")}</label>
                <input
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  data-testid="admin-church-name"
                />
              </div>
              <button type="button" className="btn" disabled={busy} onClick={() => void saveChurch()}>
                {t("me.save")}
              </button>
              <h3 style={{ marginTop: "1.25rem" }}>{t("home.securityMode")}</h3>
              <div className="toolbar">
                <button
                  type="button"
                  className={`btn ghost${selected.securityMode === "standard" ? " active-toggle" : ""}`}
                  disabled={busy || selected.securityMode === "standard"}
                  onClick={() => void setSecurityMode("standard")}
                >
                  {t("home.securityMode.standard")}
                </button>
                <button
                  type="button"
                  className={`btn ghost${selected.securityMode === "hostile" ? " active-toggle" : ""}`}
                  disabled={busy || selected.securityMode === "hostile"}
                  onClick={() => void setSecurityMode("hostile")}
                >
                  {t("home.securityMode.hostile")}
                </button>
              </div>

              <h3 style={{ marginTop: "1.25rem" }}>{t("admin.members")}</h3>
              <ul className="list" data-testid="admin-member-list">
                {members.map((m) => (
                  <li key={m.userId}>
                    <strong>{m.uid ?? m.userId}</strong>
                    <div className="muted">
                      {t(`home.role.${adminRoleLabelKey(m.role)}`)}
                      {m.verified ? ` · ${t("me.verified")}` : ` · ${t("me.pendingVerify")}`}
                      {m.tombstoned ? ` · ${t("admin.tombstoned")}` : ""}
                    </div>
                    <div className="toolbar" style={{ marginTop: "0.5rem" }}>
                      <select
                        value={normalizeAdminSelectRole(m.role)}
                        disabled={busy}
                        aria-label={t("admin.memberRole")}
                        onChange={(e) => void patchMember(m.userId, { role: e.target.value })}
                      >
                        <option value="member">{t("home.role.member")}</option>
                        <option value="elder">{t("home.role.elder")}</option>
                        <option value="deacon">{t("home.role.deacon")}</option>
                        <option value="coworker">{t("home.role.coworker")}</option>
                        <option value="security_officer">{t("home.role.securityOfficer")}</option>
                      </select>
                      {!m.verified && (
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => void patchMember(m.userId, { verified: true })}
                        >
                          {t("home.verify")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn danger"
                        disabled={busy}
                        onClick={() => void removeMember(m.userId)}
                      >
                        {t("admin.removeMember")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {section === "users" && (
        <div className="panel" data-testid="admin-users-panel">
          <h2 style={{ marginTop: 0 }}>{t("admin.sectionUsers")}</h2>
          <ul className="list" data-testid="admin-user-list">
            {users.length === 0 && <li className="muted">—</li>}
            {users.map((u) => (
              <li key={u.userId}>
                <strong>{u.uid ?? u.userId}</strong>
                <div className="muted">
                  {u.userId}
                  {u.platformRole ? ` · ${u.platformRole}` : ""}
                  {u.tombstoned ? ` · ${t("admin.tombstoned")}` : ""}
                </div>
                <div className="muted">
                  {u.memberships
                    .map((m) => `${m.role}${m.verified ? "" : " (pending)"}`)
                    .join(" · ") || t("admin.noMembership")}
                </div>
                {!u.tombstoned && (
                  <button
                    type="button"
                    className="btn danger"
                    disabled={busy}
                    data-testid={`admin-wipe-${u.userId}`}
                    onClick={() => void remoteWipe(u.userId)}
                  >
                    {t("security.adminWipe")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {section === "groups" && churchId && (
        <div className="panel" data-testid="admin-groups-panel">
          <h2 style={{ marginTop: 0 }}>{t("admin.sectionGroups")}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {t("admin.groupsHint")}
          </p>

          <div className="admin-groups-layout">
            <div className="admin-groups-list" data-testid="admin-group-list">
              <h3>{t("admin.groupList")}</h3>
              {groups.length === 0 && <p className="muted">{t("home.noGroups")}</p>}
              <ul className="list">
                {groups.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className={`church-row${activeGroupId === g.id ? " is-selected" : ""}`}
                      onClick={() => setActiveGroupId(g.id)}
                      data-testid={`admin-group-${g.id}`}
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

              <h3 style={{ marginTop: "1.25rem" }}>{t("home.createGroup")}</h3>
              <div className="field">
                <label>{t("home.groupName")}</label>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  data-testid="admin-group-name"
                />
              </div>
              <div className="field">
                <label>{t("home.groupKind")}</label>
                <select
                  value={groupKind}
                  onChange={(e) => setGroupKind(e.target.value as "small_group" | "department")}
                >
                  <option value="small_group">{t("home.kind.smallGroup")}</option>
                  <option value="department">{t("home.kind.department")}</option>
                </select>
              </div>
              <button
                type="button"
                className="btn"
                disabled={busy || !groupName.trim()}
                data-testid="admin-create-group"
                onClick={() => void createGroup()}
              >
                {t("home.createGroup")}
              </button>
            </div>

            <div className="admin-group-detail" data-testid="admin-group-members">
              {activeGroupId ? (
                <>
                  <h3>
                    {groups.find((g) => g.id === activeGroupId)?.name ?? t("home.manageGroupMembers")}
                  </h3>
                  <p className="muted" style={{ marginTop: 0 }}>
                    {t("home.manageGroupMembers")}
                  </p>

                  <ul className="list">
                    {groupMembers.length === 0 && (
                      <li className="muted">{t("home.noGroupMembers")}</li>
                    )}
                    {groupMembers.map((m) => (
                      <li key={m.userId}>
                        <strong>{m.nickname || m.uid || m.userId}</strong>
                        <div className="muted">
                          {m.role === "leader" ? t("home.role.groupLeader") : t("home.role.member")}
                        </div>
                        <div className="toolbar" style={{ marginTop: "0.4rem" }}>
                          {m.role !== "leader" ? (
                            <button
                              type="button"
                              className="btn ghost"
                              disabled={busy}
                              onClick={() => void setGroupMemberRole(m.userId, "leader")}
                            >
                              {t("home.makeLeader")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn ghost"
                              disabled={busy}
                              onClick={() => void setGroupMemberRole(m.userId, "member")}
                            >
                              {t("home.removeLeader")}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn danger"
                            disabled={busy}
                            onClick={() => void removeFromGroup(m.userId)}
                          >
                            {t("home.removeGroupMember")}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <h3 style={{ marginTop: "1.1rem" }}>{t("home.addGroupMember")}</h3>
                  <div className="field">
                    <label>{t("home.pickMember")}</label>
                    <select
                      value={addMemberUserId}
                      onChange={(e) => setAddMemberUserId(e.target.value)}
                      data-testid="admin-add-group-member"
                    >
                      <option value="">{t("home.pickMember")}</option>
                      {members
                        .filter((m) => !groupMembers.some((gm) => gm.userId === m.userId))
                        .map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.uid ?? m.userId}
                            {m.verified ? "" : ` (${t("me.pendingVerify")})`}
                          </option>
                        ))}
                    </select>
                  </div>
                  <label className="role-check" style={{ marginBottom: "0.65rem" }}>
                    <input
                      type="checkbox"
                      checked={addMemberAsLeader}
                      onChange={(e) => setAddMemberAsLeader(e.target.checked)}
                    />
                    {t("home.addAsLeader")}
                  </label>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !addMemberUserId}
                    onClick={() => void addToGroup()}
                  >
                    {t("home.addGroupMember")}
                  </button>

                  <details className="plans-advanced" style={{ marginTop: "1.25rem" }}>
                    <summary>{t("admin.groupSettings")}</summary>
                    {renameGroupId === activeGroupId ? (
                      <div className="toolbar" style={{ marginTop: "0.65rem" }}>
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          aria-label={t("home.groupName")}
                        />
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => void renameGroup()}
                        >
                          {t("me.save")}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setRenameGroupId(null);
                            setRenameValue("");
                          }}
                        >
                          {t("admin.cancel")}
                        </button>
                      </div>
                    ) : (
                      <div className="toolbar" style={{ marginTop: "0.65rem" }}>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={busy}
                          onClick={() => {
                            setRenameGroupId(activeGroupId);
                            setRenameValue(groups.find((g) => g.id === activeGroupId)?.name ?? "");
                          }}
                        >
                          {t("admin.renameGroup")}
                        </button>
                        <button
                          type="button"
                          className="btn danger"
                          disabled={busy}
                          onClick={() => void deleteGroup(activeGroupId)}
                        >
                          {t("admin.deleteGroup")}
                        </button>
                      </div>
                    )}
                  </details>
                </>
              ) : (
                <p className="muted">{t("admin.pickGroupHint")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {section === "wipe" && (
        <div className="panel" data-testid="admin-wipe-panel">
          <h2 style={{ marginTop: 0 }}>{t("admin.sectionWipe")}</h2>
          <p className="muted">{t("security.adminWipeHint")}</p>
          <ul className="list" data-testid="admin-wipe-list">
            {wipes.length === 0 && <li className="muted">{t("admin.noWipes")}</li>}
            {wipes.map((w) => (
              <li key={w.id}>
                <strong>{w.id}</strong>
                <div className="muted">
                  {w.userId} · {w.reasonCode} · {w.status}
                  {w.deviceId ? ` · ${w.deviceId}` : ""}
                </div>
              </li>
            ))}
          </ul>
          <h3 style={{ marginTop: "1.25rem" }}>{t("admin.wipeFromUsers")}</h3>
          <ul className="list">
            {users
              .filter((u) => !u.tombstoned)
              .map((u) => (
                <li key={u.userId}>
                  <strong>{u.uid ?? u.userId}</strong>
                  <button
                    type="button"
                    className="btn danger"
                    disabled={busy}
                    onClick={() => void remoteWipe(u.userId)}
                  >
                    {t("security.adminWipe")}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {section === "corpus" && access?.platformAdmin && (
        <div className="panel" data-testid="admin-corpus-panel">
          <h2 style={{ marginTop: 0 }}>{t("admin.sectionCorpus")}</h2>
          <p className="muted">{t("admin.corpusHint")}</p>
          <div className="toolbar" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="admin-corpus-tid">{t("admin.corpusTid")}</label>
              <select
                id="admin-corpus-tid"
                data-testid="admin-corpus-tid"
                value={pdTid}
                onChange={(e) => setPdTid(e.target.value as (typeof PD_CORPUS_TIDS)[number])}
              >
                {PD_CORPUS_TIDS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="admin-corpus-book">{t("admin.corpusBookNr")}</label>
              <input
                id="admin-corpus-book"
                data-testid="admin-corpus-book"
                type="number"
                min={1}
                max={66}
                value={pdBookNr}
                onChange={(e) => setPdBookNr(Number(e.target.value) || 1)}
              />
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy}
              data-testid="admin-corpus-seed-book"
              onClick={() => void seedOnePdBook()}
            >
              {busy ? t("admin.corpusSeeding") : t("admin.corpusSeedBook")}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              data-testid="admin-corpus-seed-all"
              onClick={() => void seedFullPdCanon()}
            >
              {t("admin.corpusSeedAll")}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              data-testid="admin-corpus-refresh"
              onClick={() =>
                void run(async () => {
                  await loadPdStatuses();
                })
              }
            >
              {t("admin.corpusRefresh")}
            </button>
          </div>
          {pdProgress ? (
            <p className="muted" data-testid="admin-corpus-progress">
              {pdProgress}
            </p>
          ) : null}
          <ul className="list" data-testid="admin-corpus-status-list">
            {pdStatuses.length === 0 ? (
              <li className="muted">—</li>
            ) : (
              pdStatuses.map((s) => (
                <li key={s.tid} data-testid={`admin-corpus-status-${s.tid}`}>
                  <strong>{s.tid}</strong>
                  <div className="muted">
                    {t("admin.corpusStatus")}: {s.objectCount}
                    {" · "}
                    {s.fullPackLikely ? t("admin.corpusFull") : t("admin.corpusPartial")}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {access && !access.platformAdmin && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("admin.bootstrap")}</h2>
          <p className="muted">{t("admin.bootstrapHint")}</p>
          <div className="field">
            <label>{t("admin.bootstrapSecret")}</label>
            <input
              type="password"
              value={bootstrapSecret}
              onChange={(e) => setBootstrapSecret(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn"
            disabled={busy || !bootstrapSecret}
            onClick={() => void bootstrapPlatform()}
          >
            {t("admin.bootstrap")}
          </button>
        </div>
      )}
      </div>
    </section>
  );
}
