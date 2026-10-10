import { z } from "zod";

/**
 * Role model (three layers + group leadership):
 *
 * 1. 系统层级 system: platform_admin (users.platformRole) | security_officer | user
 * 2. 角色层级 church role layer (derived): church_management | church_coworker | group_coworker | group_member
 * 3. 职分层级 office (stored in roles_json): elder | deacon | coworker | member(会友)
 *
 * 小组长 is group_members.role === "leader" (1–4 per group), not a church-role checkbox.
 * Legacy church role "admin" (家管理员) normalizes to security_officer.
 */

/** Stored church membership role tokens (includes legacy `admin`). */
export const CHURCH_ROLES = [
  "admin", // legacy → normalized to security_officer
  "elder",
  "deacon",
  "coworker",
  "security_officer",
  "member",
] as const;

export type ChurchRole = (typeof CHURCH_ROLES)[number];

export const churchRoleSchema = z.enum(CHURCH_ROLES);

/** Roles shown in assign UI (no legacy admin). */
export const ASSIGNABLE_CHURCH_ROLES: readonly ChurchRole[] = [
  "security_officer",
  "elder",
  "deacon",
  "coworker",
  "member",
];

/** 职分层级 — spiritual office titles. */
export const OFFICE_ROLES = ["elder", "deacon", "coworker", "member"] as const;
export type OfficeRole = (typeof OFFICE_ROLES)[number];

/** 角色层级 — operational church role layer (derived, not a separate checkbox set). */
export const CHURCH_ROLE_LAYERS = [
  "church_management",
  "church_coworker",
  "group_coworker",
  "group_member",
] as const;
export type ChurchRoleLayer = (typeof CHURCH_ROLE_LAYERS)[number];

/** Group-level roles. */
export const GROUP_ROLES = ["leader", "member"] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

export const groupRoleSchema = z.enum(GROUP_ROLES);

export const GROUP_KINDS = ["department", "small_group"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const groupKindSchema = z.enum(GROUP_KINDS);

const ROLE_RANK: Record<ChurchRole, number> = {
  security_officer: 100,
  admin: 100, // legacy alias of security_officer
  elder: 80,
  deacon: 70,
  coworker: 50,
  member: 10,
};

/** Leadership roles visible to ordinary group members in the org tree. */
export const DIRECTORY_LEADER_ROLES: readonly ChurchRole[] = [
  "security_officer",
  "elder",
  "deacon",
  "coworker",
];

/** Map legacy admin → security_officer; drop duplicate aliases. */
export function normalizeChurchRoles(roles: readonly ChurchRole[]): ChurchRole[] {
  const out = new Set<ChurchRole>();
  for (const r of roles) {
    if (r === "admin") out.add("security_officer");
    else if ((CHURCH_ROLES as readonly string[]).includes(r)) out.add(r);
  }
  if (out.size === 0) out.add("member");
  return [...out].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
}

export function parseRolesJson(raw: string | null | undefined, legacyRole?: string): ChurchRole[] {
  const out = new Set<ChurchRole>();
  if (legacyRole && (CHURCH_ROLES as readonly string[]).includes(legacyRole)) {
    out.add(legacyRole as ChurchRole);
  }
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (Array.isArray(parsed)) {
      for (const r of parsed) {
        if (typeof r === "string" && (CHURCH_ROLES as readonly string[]).includes(r)) {
          out.add(r as ChurchRole);
        }
      }
    }
  } catch {
    /* ignore */
  }
  return normalizeChurchRoles([...out]);
}

export function primaryChurchRole(roles: readonly ChurchRole[]): ChurchRole {
  return normalizeChurchRoles(roles)[0] ?? "member";
}

export function serializeRoles(roles: readonly ChurchRole[]): string {
  const uniq = normalizeChurchRoles(roles).filter((r) => r !== "admin");
  if (uniq.length === 0) return JSON.stringify(["member"]);
  return JSON.stringify(uniq);
}

export function hasChurchRole(roles: readonly ChurchRole[], role: ChurchRole): boolean {
  const normalized = normalizeChurchRoles(roles);
  if (role === "admin") return normalized.includes("security_officer");
  return normalized.includes(role);
}

/** Soft recommendation: 安全官职分一般为长老；执事可选。 */
export function securityOfficerOfficeHint(roles: readonly ChurchRole[]): {
  missingElder: boolean;
  suggestDeacon: boolean;
} {
  const r = normalizeChurchRoles(roles);
  const isOfficer = r.includes("security_officer");
  return {
    missingElder: isOfficer && !r.includes("elder"),
    suggestDeacon: isOfficer && !r.includes("deacon"),
  };
}

/** Offices present on the membership (职分). */
export function officeRolesOf(roles: readonly ChurchRole[]): OfficeRole[] {
  return normalizeChurchRoles(roles).filter((r): r is OfficeRole =>
    (OFFICE_ROLES as readonly string[]).includes(r),
  );
}

/**
 * Derive 角色层级 from stored roles + group leadership.
 * - 教会管理 ← security_officer
 * - 教会同工 ← coworker / elder / deacon (church-level service)
 * - 小组同工 ← group leader without higher church service roles
 * - 组员 ← default
 */
export function deriveChurchRoleLayer(
  roles: readonly ChurchRole[],
  isGroupLeader: boolean,
): ChurchRoleLayer {
  const r = normalizeChurchRoles(roles);
  if (r.includes("security_officer")) return "church_management";
  if (r.includes("elder") || r.includes("deacon") || r.includes("coworker")) {
    return "church_coworker";
  }
  if (isGroupLeader) return "group_coworker";
  return "group_member";
}

/** Church top ops role is 安全官 only (legacy admin counts via normalize). */
export function isChurchAdminRoles(roles: readonly ChurchRole[]): boolean {
  return normalizeChurchRoles(roles).includes("security_officer");
}

/** See whole-church directory (not just own group). */
export function canSeeChurchDirectory(roles: readonly ChurchRole[], isGroupLeader: boolean): boolean {
  const r = normalizeChurchRoles(roles);
  return (
    r.includes("security_officer") ||
    r.includes("elder") ||
    r.includes("deacon") ||
    isGroupLeader
  );
}

export function canManageChurch(roles: readonly ChurchRole[], platformAdmin: boolean): boolean {
  return platformAdmin;
}

/** Create groups: platform admin or 安全官. */
export function canCreateGroup(roles: readonly ChurchRole[], platformAdmin: boolean): boolean {
  return platformAdmin || isChurchAdminRoles(roles);
}

export function canVerifyMembers(roles: readonly ChurchRole[], platformAdmin: boolean): boolean {
  return platformAdmin || isChurchAdminRoles(roles);
}

export function canManageDepartments(roles: readonly ChurchRole[], platformAdmin: boolean): boolean {
  const r = normalizeChurchRoles(roles);
  return platformAdmin || r.includes("security_officer") || r.includes("deacon");
}

export function canAssignChurchRoles(roles: readonly ChurchRole[], platformAdmin: boolean): boolean {
  return platformAdmin || isChurchAdminRoles(roles);
}

/**
 * 同工大会 — mailing-list / convene channel (not an org-tree node).
 * Membership: 长老 + 执事 + 小组长 (+ optional 教会同工 / coworker).
 */
export function isCoworkerAssemblyMember(opts: {
  roles: readonly ChurchRole[];
  isGroupLeader: boolean;
  /** When true (default), church-level coworker office is included. */
  includeChurchCoworkers?: boolean;
}): boolean {
  const r = normalizeChurchRoles(opts.roles);
  if (r.includes("elder") || r.includes("deacon")) return true;
  if (opts.isGroupLeader) return true;
  if ((opts.includeChurchCoworkers ?? true) && r.includes("coworker")) return true;
  return false;
}

/** Who may send assembly notify / open-or-create the assembly group chat. */
export function canConveneCoworkerAssembly(
  roles: readonly ChurchRole[],
  platformAdmin: boolean,
): boolean {
  const r = normalizeChurchRoles(roles);
  return platformAdmin || r.includes("security_officer") || r.includes("elder");
}

/** Stable conversation title marker for assembly group chat (UI maps to i18n). */
export function coworkerAssemblyConversationTitle(churchId: string): string {
  return `lh:assembly:${churchId}`;
}

export function isCoworkerAssemblyConversationTitle(title: string | null | undefined): boolean {
  return typeof title === "string" && title.startsWith("lh:assembly:");
}

export type OrgTreePerson = {
  userId: string;
  uid: string | null;
  nickname: string | null;
  /** Plaintext signature/bio when available to the viewer. */
  signature: string | null;
  /** Group display names the person belongs to (within this church). */
  groupNames: string[];
  roles: ChurchRole[];
  groupRoles: { groupId: string; role: GroupRole }[];
  verified: boolean;
};

export type OrgTreeGroup = {
  id: string;
  name: string;
  kind: GroupKind;
  parentId: string | null;
  sortOrder: number;
  members: OrgTreePerson[];
  children: OrgTreeGroup[];
};

/**
 * Visibility for a person node in the org directory.
 * - platform admin / elder / deacon / security officer / any group leader: whole church
 * - coworker: people sharing a department subtree the coworker belongs to
 * - member: own group peers + leadership roles (elder/deacon/coworker/security/group leaders)
 */
export function canViewerSeePerson(opts: {
  platformAdmin: boolean;
  viewerRoles: readonly ChurchRole[];
  viewerGroupIds: readonly string[];
  viewerLedGroupIds: readonly string[];
  viewerDepartmentRootIds: readonly string[];
  targetRoles: readonly ChurchRole[];
  targetGroupIds: readonly string[];
  targetIsGroupLeader: boolean;
  /** Map groupId → ancestor chain including self (department roots used for coworker scope). */
  groupAncestorIds: ReadonlyMap<string, readonly string[]>;
}): boolean {
  const {
    platformAdmin,
    viewerRoles,
    viewerGroupIds,
    viewerLedGroupIds,
    viewerDepartmentRootIds,
    targetRoles,
    targetGroupIds,
    targetIsGroupLeader,
    groupAncestorIds,
  } = opts;

  if (platformAdmin) return true;
  if (canSeeChurchDirectory(viewerRoles, viewerLedGroupIds.length > 0)) return true;

  if (normalizeChurchRoles(viewerRoles).includes("coworker") && viewerDepartmentRootIds.length > 0) {
    for (const gid of targetGroupIds) {
      const ancestors = groupAncestorIds.get(gid) ?? [gid];
      if (ancestors.some((a) => viewerDepartmentRootIds.includes(a))) return true;
    }
  }

  // Peers in shared groups
  if (targetGroupIds.some((g) => viewerGroupIds.includes(g))) return true;

  // Leaders visible to ordinary members
  if (
    normalizeChurchRoles(targetRoles).some((r) => DIRECTORY_LEADER_ROLES.includes(r)) ||
    targetIsGroupLeader
  ) {
    return true;
  }

  return false;
}
