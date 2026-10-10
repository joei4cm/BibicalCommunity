import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SecurityMode } from "@logoshome/shared";
import { api, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";

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
  createdAt: number;
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
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
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
      return;
    }
    const r = await api<{ groups: AdminGroup[] }>(
      `/v1/admin/churches/${encodeURIComponent(churchId)}/groups`,
    );
    setGroups(r.groups);
  }, [churchId]);

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
      await api(`/v1/admin/churches/${encodeURIComponent(churchId)}/groups`, {
        method: "POST",
        body: JSON.stringify({ name: groupName.trim() }),
      });
      setGroupName("");
      setNote("saved");
      await loadGroups();
      await loadChurches();
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
                      {m.role}
                      {m.verified ? ` · ${t("me.verified")}` : ` · ${t("me.pendingVerify")}`}
                      {m.tombstoned ? ` · ${t("admin.tombstoned")}` : ""}
                    </div>
                    <div className="toolbar" style={{ marginTop: "0.5rem" }}>
                      <select
                        value={m.role}
                        disabled={busy}
                        aria-label={t("admin.memberRole")}
                        onChange={(e) => void patchMember(m.userId, { role: e.target.value })}
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                        <option value="elder">elder</option>
                        <option value="deacon">deacon</option>
                        <option value="coworker">coworker</option>
                        <option value="security_officer">security_officer</option>
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
          <ul className="list" data-testid="admin-group-list">
            {groups.length === 0 && <li className="muted">{t("home.noGroups")}</li>}
            {groups.map((g) => (
              <li key={g.id}>
                <strong>{g.name}</strong>
                <div className="muted">{g.id}</div>
                {renameGroupId === g.id ? (
                  <div className="toolbar" style={{ marginTop: "0.5rem" }}>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      aria-label={t("home.groupName")}
                    />
                    <button type="button" className="btn" disabled={busy} onClick={() => void renameGroup()}>
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
                  <div className="toolbar" style={{ marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busy}
                      onClick={() => {
                        setRenameGroupId(g.id);
                        setRenameValue(g.name);
                      }}
                    >
                      {t("admin.renameGroup")}
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      disabled={busy}
                      onClick={() => void deleteGroup(g.id)}
                    >
                      {t("admin.deleteGroup")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="field" style={{ marginTop: "1rem" }}>
            <label>{t("home.groupName")}</label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              data-testid="admin-group-name"
            />
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
