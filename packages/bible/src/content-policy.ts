/**
 * Content policy: block Jehovah's Witnesses and Mormon/LDS materials.
 * Applies to Bible translations, commentaries, study links, and corpus packs.
 *
 * Historic Protestant use of the divine name "Jehovah" (ASV text, Strong's KJV
 * glosses, etc.) is NOT blocked — only JW / LDS organizations and their works.
 */

export type DisallowedContentKind = "jw" | "mormon";

export interface DisallowedContentHit {
  kind: DisallowedContentKind;
  reason: string;
  matched: string;
}

/** Stable translation / pack ids that must never enter the registry. */
const BLOCKED_IDS = new Set([
  "nwt",
  "nwtp",
  "nwtsty",
  "nwtstudy",
  "jw",
  "jwbible",
  "watchtower",
  "mormon",
  "lds",
  "jst", // Joseph Smith Translation
  "bom", // Book of Mormon
  "dandc", // Doctrine & Covenants
  "pgp", // Pearl of Great Price
]);

const JW_ID_PREFIX = new Set(["nwt", "jw", "watchtower"]);
const MORMON_ID_PREFIX = new Set(["mormon", "lds", "jst", "bom", "dandc", "pgp"]);

/**
 * Phrase patterns for names, titles, URLs, and free text.
 * Kept specific so ASV "Jehovah is my shepherd" is not flagged.
 */
const JW_PATTERNS: RegExp[] = [
  /\bjw\.org\b/i,
  /\bwatch\s*tower\b/i,
  /\bwatchtower\b/i,
  /\bjehovah'?s?\s+witness/i,
  /\bnew\s+world\s+translation\b/i,
  /新世界译/,
  /新世界譯/,
  /耶和华见证人/,
  /耶和華見證人/,
  /守望台/,
];

const MORMON_PATTERNS: RegExp[] = [
  /\bmormon\b/i,
  /\blatter[\s-]*day\s+saints?\b/i,
  /\bchurch\s+of\s+jesus\s+christ\s+of\s+latter/i,
  /\bbook\s+of\s+mormon\b/i,
  /\bdoctrine\s+and\s+covenants\b/i,
  /\bpearl\s+of\s+great\s+price\b/i,
  /\bjoseph\s+smith\s+translation\b/i,
  /\blds\.org\b/i,
  /\bchurchofjesuschrist\.org\b/i,
  /摩门/,
  /摩門/,
  /后期圣徒/,
  /後期聖徒/,
  /末世圣徒/,
  /末世聖徒/,
  /摩尔门经/,
  /摩爾門經/,
  /约瑟斯密/,
  /約瑟·?\s*斯密/,
];

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function kindForBlockedId(id: string): DisallowedContentKind {
  if (MORMON_ID_PREFIX.has(id) || id.startsWith("lds") || id.startsWith("mormon")) return "mormon";
  if (JW_ID_PREFIX.has(id) || id.startsWith("nwt") || id.startsWith("jw")) return "jw";
  return id.includes("mormon") || id.includes("lds") ? "mormon" : "jw";
}

export function isBlockedContentId(id: string): boolean {
  const n = normalizeId(id);
  if (!n) return false;
  if (BLOCKED_IDS.has(n)) return true;
  // Catch variants like nwt-zh, jw-study, lds-en
  for (const blocked of BLOCKED_IDS) {
    if (n.startsWith(blocked) && n.length > blocked.length) return true;
  }
  return false;
}

export function classifyDisallowedContent(
  ...parts: Array<string | undefined | null>
): DisallowedContentHit | null {
  for (const part of parts) {
    if (!part) continue;
    const trimmed = part.trim();
    if (!trimmed) continue;
    // Id-like tokens (no spaces, short): check blocked ids first.
    if (!/\s/.test(trimmed) && trimmed.length <= 32 && isBlockedContentId(trimmed)) {
      const n = normalizeId(trimmed);
      return {
        kind: kindForBlockedId(n),
        reason: `blocked id: ${n}`,
        matched: trimmed,
      };
    }
  }

  const text = parts.filter(Boolean).join("\n");
  if (!text.trim()) return null;

  for (const re of JW_PATTERNS) {
    const m = text.match(re);
    if (m) return { kind: "jw", reason: "JW / Watchtower material", matched: m[0]! };
  }
  for (const re of MORMON_PATTERNS) {
    const m = text.match(re);
    if (m) return { kind: "mormon", reason: "Mormon / LDS material", matched: m[0]! };
  }
  return null;
}

export function isDisallowedContentSource(
  ...parts: Array<string | undefined | null>
): boolean {
  return classifyDisallowedContent(...parts) != null;
}

export function assertAllowedContentSource(
  ...parts: Array<string | undefined | null>
): void {
  const hit = classifyDisallowedContent(...parts);
  if (hit) {
    throw new Error(
      `Content policy: ${hit.kind} sources are not allowed (${hit.reason}; matched "${hit.matched}").`,
    );
  }
}
