import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptMediaBlob, encryptMediaBlob } from "./media-crypto.ts";

test("encryptMediaBlob roundtrips", async () => {
  const plain = new TextEncoder().encode("secret-bytes-你好");
  const { ciphertext, contentKey } = await encryptMediaBlob(plain.buffer);
  assert.notEqual(new Uint8Array(ciphertext)[0], plain[0]);
  const out = await decryptMediaBlob(ciphertext, contentKey);
  assert.equal(new TextDecoder().decode(out), "secret-bytes-你好");
});
