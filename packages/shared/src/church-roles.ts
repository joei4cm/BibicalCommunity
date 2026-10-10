import { z } from "zod";

/** Church-level roles (one membership may hold several). */
export const CHURCH_ROLES = [
  "admin",
  "elder",
  "deacon",
  "coworker",
  "security_officer",
  "member",
] as const;

export type ChurchRole = (typeof CHURCH_ROLES)[number];

export const churchRoleSchema = z.enum(CHURCH_ROLES);

/** Group-level roles. */
export const GROUP_ROLES = ["leader", "member"] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

export const groupRoleSchema = z.enum(GROUP_ROLES);

export const GROUP_KINDS = ["department", "small_group"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const groupKindSchema = z.enum(GROUP_KINDS);

const ROLE_RANK: Record<ChurchRole, number> = {
  admin: 100,
  elder: 80,
  deacon: 70,
  coworker: 50,
  security_officer: 40,
  member: 10,
};

/** Leadership roles visible to ordinary group members in the org tree. */
export const DIRECTORY_LEADER_ROLES: readonly ChurchRole[] = [
  "admin",
  "elder",
  "deacon",
  "coworker",
];

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
  if (out.size === 0) out.add("member");
  return [...out].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
}

export function primaryChurchRole(roles: readonly ChurchRole[]): ChurchRole {
  return roles.slice().sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0] ?? "member";
}

export function serializeRoles(roles: readonly ChurchRole[]): string {
  const uniq = [...new Set(roles.filter((r) => (CHURCH_ROLES as readonly string[]).includes(r)))];
  if (uniq.length === 0) return JSON.stringify(["member"]);
  return JSON.stringify(uniq);
}

export function hasChurchRole(roles: readonly ChurchRole[], role: ChurchRole): boolean {
  return roles.includes(role);
}

export function isChurchAdminRoles(roles: readonly ChurchRole[]): boolean {
  return roles.includes("admin") || roles.includes("security_officer");
}

/** See whole-church directory (not just own group). */
export function canSeeChurchDirectory(roles: readonly ChurchRole[], isGroupLeader: boolean): boolean {
  return (
    roles.includes("admin") ||
    roles.includes("elder") ||
    roles.includes("deacon") ||
    roles.includes("security_officer") ||
    isGroupLeader
  );
}

export function canManageChurch(roles: readonly ChurchRole[], platformAdmin: boolean): boolean {
  return platformAdmin;
}

export function canCreateGroup(roles: readonly ChurchRole[], platformAdmin: boolean): boolean {
  return platformAdmin || roles.includes("admin");
}

export function canVerifyMembers(roles: readonly ChurchRole[], platformAdmin: boolean): boolean {
  return platformAdmin || isChurchAdminRoles(roles);
}

export function canManageDepartments(roles: readonly ChurchRole[], platformAdmin: boolean): boolean {
  return platformAdmin || roles.includes("admin") || roles.includes("deacon");
}

export function canAssignChurchRoles(roles: readonly ChurchRole[], platformAdmin: boolean): boolean {
  return platformAdmin || roles.includes("admin");
}

export type OrgTreePerson = {
  userId: string;
  uid: string | null;
  nickname: string | null;
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
 * - platform admin / elder / deacon / church admin / any group leader: whole church
 * - coworker: people sharing a department subtree the coworker belongs to
 * - member: own group peers + leadership roles (elder/deacon/coworker/admin/group leaders)
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

  if (viewerRoles.includes("coworker") && viewerDepartmentRootIds.length > 0) {
    for (const gid of targetGroupIds) {
      const ancestors = groupAncestorIds.get(gid) ?? [gid];
      if (ancestors.some((a) => viewerDepartmentRootIds.includes(a))) return true;
    }
  }

  // Peers in shared groups
  if (targetGroupIds.some((g) => viewerGroupIds.includes(g))) return true;

  // Leaders visible to ordinary members
  if (targetRoles.some((r) => DIRECTORY_LEADER_ROLES.includes(r)) || targetIsGroupLeader) {
    return true;
  }

  return false;
}
