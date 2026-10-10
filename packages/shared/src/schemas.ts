import { z } from "zod";
import type { LocaleCode } from "./ids.js";

/** Map BCP-47 / short tags (zh, zh-TW, en-US, ja-JP) onto product locales. */
export function normalizeLocale(raw: unknown): LocaleCode {
  if (typeof raw !== "string" || !raw.trim()) return "zh-CN";
  const lng = raw.trim().toLowerCase();
  if (lng.startsWith("zh")) return "zh-CN";
  if (lng.startsWith("ja")) return "ja";
  if (lng.startsWith("en")) return "en";
  return "zh-CN";
}

export const localeSchema = z.preprocess(
  (v) => (v === undefined || v === null || v === "" ? "zh-CN" : normalizeLocale(v)),
  z.enum(["zh-CN", "en", "ja"]),
);
export const themeSchema = z.enum(["day", "blush", "sepia", "night", "highContrast"]);

/** 大道 post kinds. */
export const FORUM_POST_KINDS = ["text", "poll", "chain", "survey", "riddle", "timed"] as const;
export type ForumPostKind = (typeof FORUM_POST_KINDS)[number];
export const forumPostKindSchema = z.enum(FORUM_POST_KINDS);

export const forumPollPayloadSchema = z.object({
  options: z.array(z.string().min(1).max(120)).min(2).max(12),
});

export const forumChainPayloadSchema = z.object({
  prompt: z.string().min(1).max(500).optional(),
  maxEntries: z.number().int().min(1).max(500).optional(),
});

export const forumSurveyQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().min(1).max(300),
  type: z.enum(["single", "multi", "text"]).default("single"),
  options: z.array(z.string().min(1).max(120)).max(12).optional(),
});

export const forumSurveyPayloadSchema = z.object({
  questions: z.array(forumSurveyQuestionSchema).min(1).max(20),
});

export const forumRiddlePayloadSchema = z.object({
  /** Plain answer at create time; server stores hash only. */
  answer: z.string().min(1).max(200),
  hint: z.string().max(300).optional(),
});

export const forumTimedPayloadSchema = z.object({
  expiresAt: z.number().int().positive(),
});

export const privacySettingsSchema = z.object({
  discoverableByHandle: z.boolean().default(true),
  discoverableByUid: z.boolean().default(true),
  showInChurchDirectory: z.boolean().default(true),
  allowMessageRequests: z.enum(["everyone", "church-only", "admin-approved", "off"]).default("church-only"),
  shareReadReceipts: z.boolean().default(true),
  shareTypingIndicators: z.boolean().default(true),
  shareLastActive: z.boolean().default(false),
});

/** Church deployment security posture. */
export const securityModeSchema = z.enum(["standard", "hostile"]);

/** Forced privacy floors for members of a hostile-mode church. */
export const HOSTILE_PRIVACY_FLOORS = {
  discoverableByHandle: false,
  discoverableByUid: false,
  showInChurchDirectory: false,
  allowMessageRequests: "admin-approved",
} as const satisfies Partial<z.infer<typeof privacySettingsSchema>>;

/** Merge never raises discovery — floors always win over looser member settings. */
export function mergeHostilePrivacy(
  current: Partial<z.infer<typeof privacySettingsSchema>>,
): z.infer<typeof privacySettingsSchema> {
  return privacySettingsSchema.parse({ ...current, ...HOSTILE_PRIVACY_FLOORS });
}

export const registerSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(10).max(128),
  nickname: z.string().min(1).max(64),
  locale: localeSchema.default("zh-CN"),
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fff\u3040-\u30ff]+$/),
});

export const loginSchema = z.object({
  handleOrEmail: z.string().min(1),
  password: z.string().min(1),
  deviceName: z.string().max(64).optional(),
  platform: z.enum(["web", "ios", "android"]).default("web"),
});

export const profileUpdateSchema = z.object({
  nickname: z.string().min(1).max(64).optional(),
  legalName: z.string().max(128).optional(),
  signature: z.string().max(280).optional(),
  locale: localeSchema.optional(),
  theme: themeSchema.optional(),
  privacy: privacySettingsSchema.partial().optional(),
});

export const verseRefSchema = z.object({
  book: z.string(),
  chapter: z.number().int().positive(),
  verseStart: z.number().int().positive().optional(),
  verseEnd: z.number().int().positive().optional(),
});

export const annotationSchema = z.object({
  translationId: z.string(),
  ref: verseRefSchema,
  kind: z.enum(["highlight", "bookmark", "note"]),
  color: z.string().optional(),
  /** Client-encrypted payload (base64). */
  ciphertext: z.string(),
  iv: z.string(),
});

export const readingPlanDaySchema = z.object({
  day: z.number().int().positive(),
  ref: z.string().min(1),
  title: z.string().optional(),
  note: z.string().optional(),
});

export const readingPlanSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["private", "church", "public"]).default("private"),
  days: z.array(readingPlanDaySchema).min(1),
});

export const forumPostSchema = z
  .object({
    churchId: z.string(),
    groupId: z.string().optional(),
    board: z.enum(["notice", "group", "general"]).default("general"),
    kind: forumPostKindSchema.default("text"),
    title: z.string().min(1).max(200),
    body: z.string().max(20000).default(""),
    /** Allowlisted youtube/vimeo/https audio|video URL (validated server-side). */
    externalMediaUrl: z.string().url().optional(),
    /** R2 object key from POST /v1/media/upload-url (must be owned by author). */
    mediaKey: z.string().min(1).max(512).optional(),
    /** Kind-specific payload (poll options, survey questions, etc.). */
    payload: z.record(z.unknown()).optional().default({}),
    /** For timed posts; also accepted inside payload.expiresAt. */
    expiresAt: z.number().int().positive().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.board === "group" && !val.groupId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "groupId required for group board",
        path: ["groupId"],
      });
    }
    if (val.kind === "text" && !val.body.trim() && !val.mediaKey && !val.externalMediaUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "text post needs body or media",
        path: ["body"],
      });
    }
    if (val.kind === "poll") {
      const p = forumPollPayloadSchema.safeParse(val.payload);
      if (!p.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid poll payload", path: ["payload"] });
      }
    }
    if (val.kind === "survey") {
      const p = forumSurveyPayloadSchema.safeParse(val.payload);
      if (!p.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid survey payload", path: ["payload"] });
      }
    }
    if (val.kind === "riddle") {
      const p = forumRiddlePayloadSchema.safeParse(val.payload);
      if (!p.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid riddle payload", path: ["payload"] });
      }
    }
    if (val.kind === "timed") {
      const exp =
        val.expiresAt ??
        (typeof val.payload?.expiresAt === "number" ? val.payload.expiresAt : undefined);
      if (!exp || exp <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "timed post needs future expiresAt",
          path: ["expiresAt"],
        });
      }
    }
  });

export const forumRespondSchema = z.object({
  /** poll | chain | survey | riddle */
  action: z.enum(["vote", "chain", "survey", "riddle"]),
  payload: z.record(z.unknown()).default({}),
});

export const forumAdminPatchSchema = z.object({
  pinned: z.boolean().optional(),
  readonly: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

export const wipeCommandSchema = z.object({
  userId: z.string(),
  deviceId: z.string().optional(),
  reasonCode: z.enum(["admin", "self", "lost", "security"]).default("admin"),
});

export type PrivacySettings = z.infer<typeof privacySettingsSchema>;
export type SecurityMode = z.infer<typeof securityModeSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type AnnotationInput = z.infer<typeof annotationSchema>;
export type ReadingPlanInput = z.infer<typeof readingPlanSchema>;
export type ForumPostInput = z.infer<typeof forumPostSchema>;
