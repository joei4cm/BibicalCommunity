import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveSessionKey,
  encryptSessionPayload,
  decryptSessionPayload,
  generateAndExportNoteKey,
  importNoteKey,
} from "./session-aes.js";
import { encryptJson, decryptJson } from "./envelope.js";

describe("session-aes", () => {
  it("roundtrips session payloads with AAD", async () => {
    const key = await deriveSessionKey("test-shared-secret");
    const enc = await encryptSessionPayload(key, "ping", "msg");
    assert.ok(enc.ratchetHeader.length > 0);
    assert.ok(enc.ciphertext.length > 0);
    const pt = await decryptSessionPayload(key, enc.ratchetHeader, enc.ciphertext, "msg");
    assert.equal(pt, "ping");
  });

  it("rejects wrong AAD", async () => {
    const key = await deriveSessionKey("test-shared-secret-2");
    const enc = await encryptSessionPayload(key, "secret", "msg");
    await assert.rejects(() =>
      decryptSessionPayload(key, enc.ratchetHeader, enc.ciphertext, "other"),
    );
  });

  it("exports and reimports note root key for envelope storage", async () => {
    const { jwk } = await generateAndExportNoteKey();
    const key = await importNoteKey(jwk);
    const sealed = await encryptJson(key, { text: "note body" }, "note");
    const opened = await decryptJson<{ text: string }>(key, sealed.ciphertext, sealed.iv, "note");
    assert.equal(opened.text, "note body");
  });
});
