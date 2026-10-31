/**
 * D1-backed sliding window rate limit (no KV required).
 * Suitable for closed beta (~hundreds of users); not a substitute for edge WAF.
 */

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export async function enforceRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  const row = await db
    .prepare(`SELECT window_start AS windowStart, count AS count FROM rate_limits WHERE key = ?`)
    .bind(key)
    .first<{ windowStart: number; count: number }>();

  if (!row || now - row.windowStart >= windowMs) {
    await db
      .prepare(
        `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
         ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
      )
      .bind(key, now)
      .run();
    return { ok: true, remaining: Math.max(0, limit - 1) };
  }

  if (row.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((row.windowStart + windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  await db
    .prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?`)
    .bind(key)
    .run();
  return { ok: true, remaining: Math.max(0, limit - row.count - 1) };
}
