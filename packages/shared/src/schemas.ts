import { z } from "zod";

export const localeSchema = z.enum(["zh-CN", "en", "ja"]);
export const themeSchema = z.enum(["day", "sepia", "night", "highContrast"]);

export const privacySettingsSchema = z.object({
  discoverableByHandle: z.boolean().default(true),
  discoverableByUid: z.boolean().default(true),
  showInChurchDirectory: z.boolean().default(true),
  allowMessageRequests: z.enum(["everyone", "church-only", "admin-approved", "off"]).default("church-only"),
  shareReadReceipts: z.boolean().default(true),
  shareTypingIndicators: z.boolean().default(true),
  shareLastActive: z.boolean().default(false),
});

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

export const forumPostSchema = z.object({
  churchId: z.string(),
  groupId: z.string().optional(),
  board: z.enum(["notice", "group", "general"]).default("general"),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  externalMediaUrl: z.string().url().optional(),
});

export const wipeCommandSchema = z.object({
  userId: z.string(),
  deviceId: z.string().optional(),
  reasonCode: z.enum(["admin", "self", "lost", "security"]).default("admin"),
});

export type PrivacySettings = z.infer<typeof privacySettingsSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type AnnotationInput = z.infer<typeof annotationSchema>;
export type ReadingPlanInput = z.infer<typeof readingPlanSchema>;
export type ForumPostInput = z.infer<typeof forumPostSchema>;
