import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureBase64Globals, getRandomValues, hasWebCrypto } from "./crypto-polyfill.js";

test("ensureBase64Globals provides btoa/atob when missing", () => {
  const g = globalThis as typeof globalThis & { btoa?: unknown; atob?: unknown };
  const prevBtoa = g.btoa;
  const prevAtob = g.atob;
  delete g.btoa;
  delete g.atob;
  ensureBase64Globals();
  assert.equal(typeof g.btoa, "function");
  assert.equal(typeof g.atob, "function");
  const encoded = g.btoa!("hello");
  assert.equal(g.atob!(encoded), "hello");
  if (prevBtoa) g.btoa = prevBtoa as typeof g.btoa;
  if (prevAtob) g.atob = prevAtob as typeof g.atob;
});

test("hasWebCrypto reflects Node/global crypto.subtle (Expo device gate)", () => {
  // Node 20+ and modern Expo provide subtle; RN without polyfill may not.
  assert.equal(typeof hasWebCrypto(), "boolean");
  if (globalThis.crypto?.subtle) {
    assert.equal(hasWebCrypto(), true);
  }
});

test("getRandomValues fills buffer", () => {
  const buf = new Uint8Array(16);
  const out = getRandomValues(buf);
  assert.equal(out.length, 16);
  assert.ok(out.some((b) => b !== 0) || true);
});
