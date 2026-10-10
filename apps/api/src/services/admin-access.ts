import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { isChurchAdminRoles, parseRolesJson } from "@logoshome/shared";
import * as schema from "../db/schema";

type Db = DrizzleD1Database<typeof schema>;

export type AdminChurchScope = {
  churchId: string;
  name: string;
  slug: string;
  role: string;
  securityMode: string;
};

/** Console / church-admin APIs: 安全官 (legacy admin accepted). */
export function isChurchAdminRole(role: string): boolean {
  return role === "security_officer" || role === "admin";
}

function membershipIsAdmin(m: { role: string; rolesJson?: string | null }): boolean {
  return isChurchAdminRoles(parseRolesJson(m.rolesJson, m.role));
}

export async function loadAdminAccess(
  db: Db,
  userId: string,
): Promise<{
  platformAdmin: boolean;
  churches: AdminChurchScope[];
  canAccessConsole: boolean;
}> {
  const user = (
    await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  )[0];
  const platformAdmin = user?.platformRole === "platform_admin";

  const memberships = await db
    .select()
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.userId, userId));

  const churches: AdminChurchScope[] = [];
  for (const m of memberships) {
    if (!membershipIsAdmin(m) && !platformAdmin) continue;
    const church = (
      await db.select().from(schema.churches).where(eq(schema.churches.id, m.churchId)).limit(1)
    )[0];
    if (!church) continue;
    churches.push({
      churchId: church.id,
      name: church.name,
      slug: church.slug,
      role: platformAdmin && !membershipIsAdmin(m) ? "platform_admin" : m.role,
      securityMode: church.securityMode,
    });
  }

  return {
    platformAdmin,
    churches,
    canAccessConsole: platformAdmin || churches.some((c) => isChurchAdminRole(c.role)),
  };
}

export async function assertChurchAdmin(
  db: Db,
  userId: string,
  churchId: string,
): Promise<{ platformAdmin: boolean; role: string }> {
  const user = (
    await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  )[0];
  if (user?.platformRole === "platform_admin") {
    return { platformAdmin: true, role: "platform_admin" };
  }
  const membership = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(eq(schema.churchMembers.userId, userId))
  ).find((m) => m.churchId === churchId && membershipIsAdmin(m));
  if (!membership) {
    const err = new Error("forbidden") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  return { platformAdmin: false, role: membership.role };
}
