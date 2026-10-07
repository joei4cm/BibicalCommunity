import { test } from "node:test";
import assert from "node:assert/strict";
import { WebCryptoSignalClient } from "./webcrypto-signal.js";

test("WebCryptoSignalClient encrypt/decrypt roundtrip across peers", async () => {
  const client = new WebCryptoSignalClient();
  const alice = await client.generateIdentity();
  const bob = await client.generateIdentity();

  const aliceSession = await client.establishSession(alice.privateState, bob.publicBundle);
  const aliceBlob = JSON.parse(
    decodeURIComponent(escape(atob(aliceSession.stateBlob))),
  ) as {
    aliceIdentityPub: JsonWebKey;
    aliceEphemeralPub: JsonWebKey;
  };

  const bobSession = await client.establishResponderSession(
    bob.privateState,
    aliceBlob.aliceIdentityPub,
    aliceBlob.aliceEphemeralPub,
  );

  const enc = await client.encrypt(aliceSession, "平安", Date.now() + 3600_000);
  assert.ok(enc.ciphertext);
  assert.ok(enc.expiresAt);

  const plain = await client.decrypt(bobSession, enc);
  assert.equal(plain, "平安");
});
