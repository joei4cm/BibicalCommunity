import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { mergeHostilePrivacy, type PrivacySettings } from "@logoshome/shared";
import * as schema from "../db/schema";

type Db = DrizzleD1Database<typeof schema>;

/** Merge hostile privacy floors into a user's privacy_json (never raises discovery). */
export async function applyHostilePrivacyFloors(db: Db, userId: string): Promise<void> {
  const user = (
    await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  )[0];
  if (!user) return;

  let current: Partial<PrivacySettings> = {};
  try {
    current = JSON.parse(user.privacyJson) as Partial<PrivacySettings>;
  } catch {
    current = {};
  }

  const merged = mergeHostilePrivacy(current);
  await db
    .update(schema.users)
    .set({ privacyJson: JSON.stringify(merged) })
    .where(eq(schema.users.id, userId));
}

/** Apply floors to every member of a church (e.g. after switching to hostile). */
export async function applyHostilePrivacyFloorsToChurch(db: Db, churchId: string): Promise<void> {
  const members = await db
    .select({ userId: schema.churchMembers.userId })
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.churchId, churchId));
  for (const m of members) {
    await applyHostilePrivacyFloors(db, m.userId);
  }
}
