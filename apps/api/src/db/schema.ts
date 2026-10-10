import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    uid: text("uid").notNull().unique(),
    handleHash: text("handle_hash").notNull().unique(),
    emailHash: text("email_hash"),
    passwordHash: text("password_hash").notNull(),
    nicknameCt: text("nickname_ct"),
    legalNameCt: text("legal_name_ct"),
    signatureCt: text("signature_ct"),
    locale: text("locale").notNull().default("zh-CN"),
    theme: text("theme").notNull().default("day"),
    privacyJson: text("privacy_json").notNull(),
    /** null | "platform_admin" — global console access */
    platformRole: text("platform_role"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    tombstoned: integer("tombstoned", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("users_uid_idx").on(t.uid)],
);

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  platform: text("platform").notNull(),
  name: text("name"),
  identityKeyPub: text("identity_key_pub"),
  signedPrekeyPub: text("signed_prekey_pub"),
  signedPrekeySig: text("signed_prekey_sig"),
  signedPrekeyId: integer("signed_prekey_id"),
  registrationId: integer("registration_id"),
  revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "number" }).notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const churches = sqliteTable("churches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  securityMode: text("security_mode").notNull().default("standard"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const churchMembers = sqliteTable("church_members", {
  id: text("id").primaryKey(),
  churchId: text("church_id")
    .notNull()
    .references(() => churches.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  /** Legacy primary role; keep in sync with rolesJson[0] for older clients. */
  role: text("role").notNull().default("member"),
  /** JSON array of ChurchRole — supports multi-role membership. */
  rolesJson: text("roles_json").notNull().default("[]"),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  groupIdsJson: text("group_ids_json").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const churchGroups = sqliteTable("church_groups", {
  id: text("id").primaryKey(),
  churchId: text("church_id")
    .notNull()
    .references(() => churches.id),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  /** department | small_group */
  kind: text("kind").notNull().default("small_group"),
  sortOrder: integer("sort_order", { mode: "number" }).notNull().default(0),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const churchGroupMembers = sqliteTable(
  "church_group_members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => churchGroups.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    /** leader | member */
    role: text("role").notNull().default("member"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("church_group_members_group_idx").on(t.groupId),
    index("church_group_members_user_idx").on(t.userId),
  ],
);

export const messageFavorites = sqliteTable("message_favorites", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  messageId: text("message_id").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const annotations = sqliteTable("annotations", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  translationId: text("translation_id").notNull(),
  book: text("book").notNull(),
  chapter: integer("chapter").notNull(),
  verseStart: integer("verse_start"),
  verseEnd: integer("verse_end"),
  kind: text("kind").notNull(),
  color: text("color"),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const readingPlans = sqliteTable("reading_plans", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  visibility: text("visibility").notNull().default("private"),
  daysJson: text("days_json").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const planSubscriptions = sqliteTable("plan_subscriptions", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => readingPlans.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  progressDay: integer("progress_day").notNull().default(0),
  /** Current devotion step: pause | read | reflect | pray | act */
  devotionStep: text("devotion_step").notNull().default("pause"),
  /** Optional devotion material id bound to this subscription */
  devotionMaterialId: text("devotion_material_id"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const forumPosts = sqliteTable("forum_posts", {
  id: text("id").primaryKey(),
  churchId: text("church_id")
    .notNull()
    .references(() => churches.id),
  groupId: text("group_id"),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  board: text("board").notNull().default("general"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  externalMediaUrl: text("external_media_url"),
  mediaKey: text("media_key"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title"),
  disappearingTtlSec: integer("disappearing_ttl_sec"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const conversationMembers = sqliteTable("conversation_members", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull().default("member"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id),
  senderDeviceId: text("sender_device_id").notNull(),
  ratchetHeader: text("ratchet_header").notNull(),
  ciphertext: text("ciphertext").notNull(),
  contentType: text("content_type").notNull().default("msg"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  expiresAt: integer("expires_at", { mode: "number" }),
  tombstoned: integer("tombstoned", { mode: "boolean" }).notNull().default(false),
});

export const wipeCommands = sqliteTable("wipe_commands", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  deviceId: text("device_id"),
  issuedBy: text("issued_by").notNull(),
  reasonCode: text("reason_code").notNull(),
  tokenHash: text("token_hash").notNull(),
  status: text("status").notNull().default("pending"),
  issuedAt: integer("issued_at", { mode: "number" }).notNull(),
  expiresAt: integer("expires_at", { mode: "number" }).notNull(),
});

export const translationEntitlements = sqliteTable(
  "translation_entitlements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    translationId: text("translation_id").notNull(),
    grantedAt: integer("granted_at", { mode: "number" }).notNull(),
    expiresAt: integer("expires_at", { mode: "number" }),
  },
  (t) => [
    index("translation_entitlements_user_idx").on(t.userId),
    index("translation_entitlements_user_translation_uidx").on(t.userId, t.translationId),
  ],
);

export const oneTimePrekeys = sqliteTable(
  "one_time_prekeys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id),
    prekeyId: integer("prekey_id").notNull(),
    prekeyPub: text("prekey_pub").notNull(),
    consumedAt: integer("consumed_at", { mode: "number" }),
  },
  (t) => [
    index("one_time_prekeys_user_device_idx").on(t.userId, t.deviceId),
    index("one_time_prekeys_unused_idx").on(t.deviceId, t.consumedAt),
  ],
);

/**
 * Preview/temporary Workers without R2: chapter JSON lives in D1.
 * Production corpora remain on R2 (`CORPUS_LIVE_R2_*`).
 */
export const corpusChapters = sqliteTable(
  "corpus_chapters",
  {
    translationId: text("translation_id").notNull(),
    book: text("book").notNull(),
    chapter: integer("chapter", { mode: "number" }).notNull(),
    bodyJson: text("body_json").notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.translationId, t.book, t.chapter] }),
    index("corpus_chapters_tid_idx").on(t.translationId),
  ],
);
