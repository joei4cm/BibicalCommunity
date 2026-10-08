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

type Section = "homes" | "users" | "groups" | "wipe";

export function AdminConsole() {
  const { t } = useTranslation();
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [churches, setChurches] = useState<AdminChurch[]>([]);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [wipes, setWipes] = useState<WipeCommand[]>([]);
  const [section, setSection] = useState<Section>("homes");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [churchName, setChurchName] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");

  const selected = churches.find((c) => c.id === churchId) ?? null;

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
  ];

  return (
    <section className="fade-up" data-testid="admin-console">
      <h1 className="brand">{t("admin.title")}</h1>
      <p className="muted">
        {access?.platformAdmin ? t("admin.platformAdmin") : t("admin.churchAdmin")}
        {note ? ` · ${humanizeStatus(t, note)}` : ""}
      </p>

      <div className="toolbar board-tabs" role="tablist" aria-label={t("admin.title")}>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            className={`btn ghost${section === s.id ? " active-toggle" : ""}`}
            data-testid={`admin-tab-${s.id}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("admin.selectHome")}</h2>
        <ul className="list" data-testid="admin-church-list">
          {churches.length === 0 && <li className="muted">—</li>}
          {churches.map((c) => (
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
                {c.securityMode === "hostile" ? (
                  <span className="badge-hostile"> · {t("home.securityMode.hostileBadge")}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {section === "homes" && selected && (
        <div className="panel" data-testid="admin-homes-panel">
          <h2 style={{ marginTop: 0 }}>{t("admin.sectionHomes")}</h2>
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
    </section>
  );
}
