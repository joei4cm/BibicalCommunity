import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enforceRateLimit } from "./rate-limit.js";

type Row = { windowStart: number; count: number };

function memoryD1(store: Map<string, Row>): D1Database {
  return {
    prepare(sql: string) {
      const self = {
        _binds: [] as unknown[],
        bind(...args: unknown[]) {
          self._binds = args;
          return self;
        },
        async first<T>() {
          const key = String(self._binds[0] ?? "");
          const row = store.get(key);
          return (row ? { windowStart: row.windowStart, count: row.count } : null) as T | null;
        },
        async run() {
          const key = String(self._binds[0] ?? "");
          if (/INSERT INTO rate_limits/.test(sql)) {
            store.set(key, { windowStart: Number(self._binds[1]), count: 1 });
          } else if (/UPDATE rate_limits SET count/.test(sql)) {
            const cur = store.get(key);
            if (cur) cur.count += 1;
          }
          return { success: true };
        },
      };
      return self;
    },
  } as unknown as D1Database;
}

describe("enforceRateLimit", () => {
  it("allows up to limit then blocks until window resets", async () => {
    const store = new Map<string, Row>();
    const db = memoryD1(store);
    const t0 = 1_000_000;
    assert.equal((await enforceRateLimit(db, "u1", 2, 60_000, t0)).ok, true);
    assert.equal((await enforceRateLimit(db, "u1", 2, 60_000, t0 + 1)).ok, true);
    const blocked = await enforceRateLimit(db, "u1", 2, 60_000, t0 + 2);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.ok(blocked.retryAfterSec >= 1);
    assert.equal((await enforceRateLimit(db, "u1", 2, 60_000, t0 + 60_000)).ok, true);
  });
});
