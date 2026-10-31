import { sqliteTable, text, integer, index, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const churchMembers = sqliteTable(
  "church_members",
  {
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
  },
  (t) => [index("church_members_church_user_uidx").on(t.churchId, t.userId)],
);

/** One-time / limited invite codes for hostile (and optional standard) join. */
export const churchInvites = sqliteTable(
  "church_invites",
  {
    id: text("id").primaryKey(),
    churchId: text("church_id")
      .notNull()
      .references(() => churches.id),
    codeHash: text("code_hash").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at", { mode: "number" }),
    maxUses: integer("max_uses", { mode: "number" }),
    useCount: integer("use_count", { mode: "number" }).notNull().default(0),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("church_invites_church_idx").on(t.churchId)],
);

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

/**
 * Client-encrypted account vault (reading place / history pointers).
 * Server stores opaque ciphertext only — never plaintext scripture positions.
 */
export const userVault = sqliteTable(
  "user_vault",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("user_vault_user_kind_uidx").on(t.userId, t.kind)],
);

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

export const forumPosts = sqliteTable(
  "forum_posts",
  {
    id: text("id").primaryKey(),
    churchId: text("church_id")
      .notNull()
      .references(() => churches.id),
    groupId: text("group_id"),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    board: text("board").notNull().default("general"),
    kind: text("kind").notNull().default("text"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    externalMediaUrl: text("external_media_url"),
    mediaKey: text("media_key"),
    payloadJson: text("payload_json").notNull().default("{}"),
    answerHash: text("answer_hash"),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    pinnedAt: integer("pinned_at", { mode: "number" }),
    readonly: integer("readonly", { mode: "boolean" }).notNull().default(false),
    expiresAt: integer("expires_at", { mode: "number" }),
    deletedAt: integer("deleted_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("forum_posts_church_created_idx").on(t.churchId, t.createdAt)],
);

export const forumPostResponses = sqliteTable("forum_post_responses", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => forumPosts.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
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

export const conversationMembers = sqliteTable(
  "conversation_members",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("member"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    /** Client last opened / marked-read time; used for unread badges (opaque message counts). */
    lastReadAt: integer("last_read_at", { mode: "number" }),
  },
  (t) => [
    index("conversation_members_user_last_read_idx").on(t.userId, t.lastReadAt),
    index("conversation_members_conversation_idx").on(t.conversationId),
    index("conversation_members_user_conversation_idx").on(t.userId, t.conversationId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
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
  },
  (t) => [index("messages_conversation_created_idx").on(t.conversationId, t.createdAt)],
);

/** Sliding-window counters for auth/chat/calls rate limits (beta hardening). */
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start", { mode: "number" }).notNull(),
  count: integer("count").notNull(),
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

export const friendRequests = sqliteTable(
  "friend_requests",
  {
    id: text("id").primaryKey(),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => users.id),
    message: text("message"),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    respondedAt: integer("responded_at", { mode: "number" }),
  },
  (t) => [
    index("friend_requests_to_idx").on(t.toUserId, t.status),
    index("friend_requests_from_idx").on(t.fromUserId, t.status),
  ],
);

export const friendships = sqliteTable(
  "friendships",
  {
    id: text("id").primaryKey(),
    userAId: text("user_a_id")
      .notNull()
      .references(() => users.id),
    userBId: text("user_b_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("friendships_a_idx").on(t.userAId),
    index("friendships_b_idx").on(t.userBId),
  ],
);

export const calendarEvents = sqliteTable(
  "calendar_events",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    notes: text("notes"),
    startAt: integer("start_at", { mode: "number" }).notNull(),
    endAt: integer("end_at", { mode: "number" }),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    /** event | seminar — seminars live on the calendar, not as a chat kind. */
    kind: text("kind").notNull().default("event"),
    source: text("source").notNull().default("local"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [index("calendar_events_owner_start_idx").on(t.ownerUserId, t.startAt)],
);

export const calendarInvites = sqliteTable(
  "calendar_invites",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => calendarEvents.id),
    inviteeUserId: text("invitee_user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    respondedAt: integer("responded_at", { mode: "number" }),
  },
  (t) => [index("calendar_invites_invitee_idx").on(t.inviteeUserId, t.status)],
);

export const inboxMessages = sqliteTable(
  "inbox_messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    payloadJson: text("payload_json").notNull().default("{}"),
    relatedUserId: text("related_user_id"),
    readAt: integer("read_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("inbox_messages_user_idx").on(t.userId, t.createdAt),
    index("inbox_messages_unread_idx").on(t.userId, t.readAt),
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
