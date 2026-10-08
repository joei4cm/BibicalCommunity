import type { Env } from "../env";

/**
 * Delete all R2 objects under `media/{userId}/` (user-uploaded blobs).
 * SECURITY.md §7 — remote wipe must destroy R2 objects, not only D1 ciphertext.
 */
export async function deleteUserMediaObjects(
  media: Env["MEDIA"],
  userId: string,
): Promise<{ deleted: number; prefix: string }> {
  const prefix = `media/${userId}/`;
  let deleted = 0;
  let cursor: string | undefined;
  for (;;) {
    const listed = await media.list({ prefix, limit: 1000, cursor });
    for (const obj of listed.objects) {
      await media.delete(obj.key);
      deleted += 1;
    }
    if (!listed.truncated) break;
    cursor = listed.cursor;
  }
  return { deleted, prefix };
}
