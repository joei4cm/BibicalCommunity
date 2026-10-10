import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  canCreateGroup,
  canManageDepartments,
  canVerifyMembers,
  canViewerSeePerson,
  groupKindSchema,
  parseRolesJson,
  primaryChurchRole,
  serializeRoles,
  type ChurchRole,
  type GroupKind,
  type GroupRole,
  type OrgTreeGroup,
  type OrgTreePerson,
} from "@logoshome/shared";
import type { Env } from "../env";
import { openField } from "./field-crypto";
import * as schema from "../db/schema";

type Db = DrizzleD1Database<typeof schema>;

export type MembershipContext = {
  membership: typeof schema.churchMembers.$inferSelect;
  roles: ChurchRole[];
  platformAdmin: boolean;
  groupIds: string[];
  ledGroupIds: string[];
  departmentRootIds: string[];
};

export async function loadPlatformAdmin(db: Db, userId: string): Promise<boolean> {
  const user = (
    await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  )[0];
  return user?.platformRole === "platform_admin";
}

export async function loadMembershipContext(
  db: Db,
  userId: string,
  churchId: string,
): Promise<MembershipContext | null> {
  const membership = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(and(eq(schema.churchMembers.churchId, churchId), eq(schema.churchMembers.userId, userId)))
      .limit(1)
  )[0];
  if (!membership) return null;

  const platformAdmin = await loadPlatformAdmin(db, userId);
  const roles = parseRolesJson(membership.rolesJson, membership.role);

  const gmRows = await db
    .select()
    .from(schema.churchGroupMembers)
    .where(eq(schema.churchGroupMembers.userId, userId));

  const churchGroups = await db
    .select()
    .from(schema.churchGroups)
    .where(eq(schema.churchGroups.churchId, churchId));
  const churchGroupIds = new Set(churchGroups.map((g) => g.id));

  const groupIds: string[] = [];
  const ledGroupIds: string[] = [];
  for (const row of gmRows) {
    if (!churchGroupIds.has(row.groupId)) continue;
    groupIds.push(row.groupId);
    if (row.role === "leader") ledGroupIds.push(row.groupId);
  }

  // Legacy fallback: group_ids_json
  try {
    const legacy = JSON.parse(membership.groupIdsJson || "[]") as unknown;
    if (Array.isArray(legacy)) {
      for (const id of legacy) {
        if (typeof id === "string" && churchGroupIds.has(id) && !groupIds.includes(id)) {
          groupIds.push(id);
        }
      }
    }
  } catch {
    /* ignore */
  }

  const byId = new Map(churchGroups.map((g) => [g.id, g]));
  const departmentRootIds: string[] = [];
  for (const gid of groupIds) {
    let cur = byId.get(gid);
    while (cur?.parentId && byId.has(cur.parentId)) {
      cur = byId.get(cur.parentId);
    }
    if (cur && cur.kind === "department" && !departmentRootIds.includes(cur.id)) {
      departmentRootIds.push(cur.id);
    }
    // If member is directly on a department node
    const self = byId.get(gid);
    if (self?.kind === "department" && !departmentRootIds.includes(self.id)) {
      departmentRootIds.push(self.id);
    }
  }

  return {
    membership,
    roles,
    platformAdmin,
    groupIds,
    ledGroupIds,
    departmentRootIds,
  };
}

export function syncPrimaryRole(roles: ChurchRole[]): { role: string; rolesJson: string } {
  const primary = primaryChurchRole(roles);
  return { role: primary, rolesJson: serializeRoles(roles) };
}

export async function assertCanCreateGroup(db: Db, userId: string, churchId: string): Promise<MembershipContext> {
  const ctx = await loadMembershipContext(db, userId, churchId);
  if (!ctx || !canCreateGroup(ctx.roles, ctx.platformAdmin)) {
    const err = new Error("forbidden") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  return ctx;
}

export async function assertCanVerify(db: Db, userId: string, churchId: string): Promise<MembershipContext> {
  const ctx = await loadMembershipContext(db, userId, churchId);
  if (!ctx || !canVerifyMembers(ctx.roles, ctx.platformAdmin)) {
    const err = new Error("forbidden") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  return ctx;
}

export async function assertCanManageGroupMembers(
  db: Db,
  userId: string,
  groupId: string,
): Promise<{ ctx: MembershipContext | null; group: typeof schema.churchGroups.$inferSelect }> {
  const group = (
    await db.select().from(schema.churchGroups).where(eq(schema.churchGroups.id, groupId)).limit(1)
  )[0];
  if (!group) {
    const err = new Error("not_found") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  const platformAdmin = await loadPlatformAdmin(db, userId);
  // Platform admins may manage any church's groups even without membership.
  if (platformAdmin) {
    const ctx = await loadMembershipContext(db, userId, group.churchId);
    return { ctx, group };
  }
  const ctx = await loadMembershipContext(db, userId, group.churchId);
  if (!ctx) {
    const err = new Error("forbidden") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  const isLeader = ctx.ledGroupIds.includes(groupId);
  const isAdmin = ctx.roles.includes("admin");
  const isDeaconDept =
    canManageDepartments(ctx.roles, ctx.platformAdmin) && group.kind === "department";
  if (!isLeader && !isAdmin && !isDeaconDept) {
    const err = new Error("forbidden") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  return { ctx, group };
}

function buildAncestorMap(
  groups: { id: string; parentId: string | null }[],
): Map<string, string[]> {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const map = new Map<string, string[]>();
  for (const g of groups) {
    const chain: string[] = [g.id];
    let cur = g;
    const seen = new Set<string>([g.id]);
    while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
      seen.add(cur.parentId);
      chain.push(cur.parentId);
      cur = byId.get(cur.parentId)!;
    }
    map.set(g.id, chain);
  }
  return map;
}

export async function buildOrgTree(
  db: Db,
  env: Env,
  churchId: string,
  viewerUserId: string,
): Promise<{
  church: { id: string; name: string; slug: string; securityMode: string };
  viewer: {
    roles: ChurchRole[];
    ledGroupIds: string[];
    capabilities: Record<string, boolean>;
  };
  tree: OrgTreeGroup[];
  leaders: OrgTreePerson[];
}> {
  const church = (
    await db.select().from(schema.churches).where(eq(schema.churches.id, churchId)).limit(1)
  )[0];
  if (!church) {
    const err = new Error("not_found") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  const ctx = await loadMembershipContext(db, viewerUserId, churchId);
  if (!ctx) {
    const err = new Error("forbidden") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  const groups = await db
    .select()
    .from(schema.churchGroups)
    .where(eq(schema.churchGroups.churchId, churchId));
  const members = await db
    .select()
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.churchId, churchId));
  const allGm = await db.select().from(schema.churchGroupMembers);
  const groupIdSet = new Set(groups.map((g) => g.id));
  const gmInChurch = allGm.filter((g) => groupIdSet.has(g.groupId));

  const usersById = new Map<string, typeof schema.users.$inferSelect>();
  for (const m of members) {
    const u = (
      await db.select().from(schema.users).where(eq(schema.users.id, m.userId)).limit(1)
    )[0];
    if (u) usersById.set(u.id, u);
  }

  const ancestorMap = buildAncestorMap(groups);
  const groupMembersByGroup = new Map<string, typeof gmInChurch>();
  for (const row of gmInChurch) {
    const list = groupMembersByGroup.get(row.groupId) ?? [];
    list.push(row);
    groupMembersByGroup.set(row.groupId, list);
  }

  const personCache = new Map<string, OrgTreePerson>();
  async function toPerson(m: typeof schema.churchMembers.$inferSelect): Promise<OrgTreePerson> {
    const cached = personCache.get(m.userId);
    if (cached) return cached;
    const roles = parseRolesJson(m.rolesJson, m.role);
    const user = usersById.get(m.userId);
    const groupRoles = gmInChurch
      .filter((g) => g.userId === m.userId)
      .map((g) => ({ groupId: g.groupId, role: g.role as GroupRole }));
    const person: OrgTreePerson = {
      userId: m.userId,
      uid: user?.uid ?? null,
      nickname: user
        ? await openField(env, m.userId, "nickname", user.nicknameCt)
        : null,
      roles,
      groupRoles,
      verified: m.verified,
    };
    personCache.set(m.userId, person);
    return person;
  }

  const visiblePeople = new Map<string, OrgTreePerson>();
  for (const m of members) {
    const roles = parseRolesJson(m.rolesJson, m.role);
    let targetGroupIds = gmInChurch.filter((g) => g.userId === m.userId).map((g) => g.groupId);
    if (targetGroupIds.length === 0) {
      try {
        const legacy = JSON.parse(m.groupIdsJson || "[]") as unknown;
        if (Array.isArray(legacy)) {
          targetGroupIds = legacy.filter((x): x is string => typeof x === "string");
        }
      } catch {
        /* ignore */
      }
    }
    const targetIsGroupLeader = gmInChurch.some(
      (g) => g.userId === m.userId && g.role === "leader",
    );
    const ok = canViewerSeePerson({
      platformAdmin: ctx.platformAdmin,
      viewerRoles: ctx.roles,
      viewerGroupIds: ctx.groupIds,
      viewerLedGroupIds: ctx.ledGroupIds,
      viewerDepartmentRootIds: ctx.departmentRootIds,
      targetRoles: roles,
      targetGroupIds,
      targetIsGroupLeader,
      groupAncestorIds: ancestorMap,
    });
    if (ok || m.userId === viewerUserId) {
      visiblePeople.set(m.userId, await toPerson(m));
    }
  }

  const nodeMap = new Map<string, OrgTreeGroup>();
  for (const g of groups) {
    const kindParsed = groupKindSchema.safeParse(g.kind);
    const kind: GroupKind = kindParsed.success ? kindParsed.data : "small_group";
    const memberRows = groupMembersByGroup.get(g.id) ?? [];
    const membersVisible: OrgTreePerson[] = [];
    for (const row of memberRows) {
      const p = visiblePeople.get(row.userId);
      if (p) membersVisible.push(p);
    }
    nodeMap.set(g.id, {
      id: g.id,
      name: g.name,
      kind,
      parentId: g.parentId,
      sortOrder: g.sortOrder,
      members: membersVisible,
      children: [],
    });
  }

  const roots: OrgTreeGroup[] = [];
  const sorted = [...nodeMap.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  for (const node of sorted) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const leaders = [...visiblePeople.values()].filter(
    (p) =>
      p.roles.some((r) => r !== "member") ||
      p.groupRoles.some((g) => g.role === "leader"),
  );

  return {
    church: {
      id: church.id,
      name: church.name,
      slug: church.slug,
      securityMode: church.securityMode,
    },
    viewer: {
      roles: ctx.roles,
      ledGroupIds: ctx.ledGroupIds,
      capabilities: {
        platformAdmin: ctx.platformAdmin,
        createGroup: canCreateGroup(ctx.roles, ctx.platformAdmin),
        verifyMembers: canVerifyMembers(ctx.roles, ctx.platformAdmin),
        manageDepartments: canManageDepartments(ctx.roles, ctx.platformAdmin),
        manageChurch: ctx.platformAdmin,
        isGroupLeader: ctx.ledGroupIds.length > 0,
      },
    },
    tree: roots,
    leaders,
  };
}
