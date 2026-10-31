import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sealField, openField, clearDekCacheForTests } from "./field-crypto.js";
import type { Env } from "../env";

const mockEnv = {
  KEK_MASTER: "test-kek-master-key-32-bytes-ok!",
} as unknown as Env;

describe("field-crypto seal/open", () => {
  it("roundtrips plaintext with mock env", async () => {
    clearDekCacheForTests();
    const sealed = await sealField(mockEnv, "user_1", "nickname", "Ada Lovelace");
    assert.ok(sealed.startsWith("v1."));
    const opened = await openField(mockEnv, "user_1", "nickname", sealed);
    assert.equal(opened, "Ada Lovelace");
  });

  it("reuses cached DEK so many opens stay fast", async () => {
    clearDekCacheForTests();
    const sealed = await sealField(mockEnv, "user_1", "nickname", "Ada");
    const t0 = Date.now();
    for (let i = 0; i < 40; i++) {
      assert.equal(await openField(mockEnv, "user_1", "nickname", sealed), "Ada");
    }
    // Uncached 40× PBKDF2-100k would be multi-second; cached should finish quickly.
    assert.ok(Date.now() - t0 < 1500, `opens took ${Date.now() - t0}ms`);
  });

  it("returns null for wrong user/field AAD", async () => {
    const sealed = await sealField(mockEnv, "user_1", "nickname", "secret");
    await assert.rejects(() => openField(mockEnv, "user_2", "nickname", sealed));
    await assert.rejects(() => openField(mockEnv, "user_1", "email", sealed));
  });

  it("passes through legacy plaintext (non-v1)", async () => {
    const opened = await openField(mockEnv, "user_1", "nickname", "legacy-plain");
    assert.equal(opened, "legacy-plain");
  });

  it("returns null for null/undefined sealed", async () => {
    assert.equal(await openField(mockEnv, "user_1", "nickname", null), null);
    assert.equal(await openField(mockEnv, "user_1", "nickname", undefined), null);
  });
});
