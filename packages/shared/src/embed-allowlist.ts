/**
 * Allowed external embed / media hosts for Home forum posts.
 * Anything outside this list is rejected server-side and rendered as a plain link client-side.
 */

const ALLOWED_HOST_SUFFIXES = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
] as const;

const AUDIO_EXT = /\.(mp3|m4a|ogg|wav|aac)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|ogv)(\?|$)/i;

function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

/** True when URL is an allowlisted youtube/vimeo embed or a direct audio/video file URL. */
export function isAllowedExternalMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (hostAllowed(u.hostname)) return true;
    // Direct media files: require https and an audio/video extension (no open redirect hosts).
    if (u.protocol === "https:" && (AUDIO_EXT.test(u.pathname) || VIDEO_EXT.test(u.pathname))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function assertAllowedExternalMediaUrl(url: string): string {
  if (!isAllowedExternalMediaUrl(url)) {
    throw new Error("external_media_not_allowed");
  }
  return url;
}

/** R2 object keys for user uploads must be under media/{userId}/. */
export function isOwnedMediaKey(mediaKey: string, userId: string): boolean {
  const prefix = `media/${userId}/`;
  return mediaKey.startsWith(prefix) && !mediaKey.includes("..");
}
