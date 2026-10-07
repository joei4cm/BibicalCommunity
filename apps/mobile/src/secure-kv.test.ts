import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kvDelete, kvGet, kvSet, wipeSecureSecrets } from "./secure-kv.js";

describe("secure-kv fallback", () => {
  it("roundtrips via AsyncStorage when SecureStore is unavailable in Node", async () => {
    const key = `lh.test.secret.${Date.now()}`;
    const backend = await kvSet(key, "payload-secret");
    assert.ok(backend === "async-storage" || backend === "memory");
    const got = await kvGet(key);
    assert.equal(got.value, "payload-secret");
    assert.ok(got.backend === "async-storage" || got.backend === "memory");
    await kvDelete(key);
    const after = await kvGet(key);
    assert.equal(after.value, null);
  });

  it("wipeSecureSecrets clears listed keys", async () => {
    const a = `lh.test.a.${Date.now()}`;
    const b = `lh.test.b.${Date.now()}`;
    await kvSet(a, "1");
    await kvSet(b, "2");
    await wipeSecureSecrets([a, b]);
    assert.equal((await kvGet(a)).value, null);
    assert.equal((await kvGet(b)).value, null);
  });
});
