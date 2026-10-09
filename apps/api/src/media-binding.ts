import type { Env } from "./env";

type MediaContext = {
  env: Env;
  json: (body: unknown, status?: number) => Response;
};

/** Require R2 MEDIA binding — absent on temporary preview deploys without R2. */
export function requireMedia(c: MediaContext): R2Bucket | Response {
  const media = c.env.MEDIA;
  if (!media) {
    return c.json(
      {
        error: "media_unavailable",
        detail: "R2 MEDIA binding missing (temporary preview cannot create R2 buckets)",
      },
      503,
    );
  }
  return media;
}
