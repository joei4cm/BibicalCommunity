import { test } from "node:test";
import assert from "node:assert/strict";
import { WebCryptoSignalClient } from "./webcrypto-signal.js";
import { generateEphemeralKeyPair } from "./x3dh.js";

test("WebCryptoSignalClient encrypt/decrypt roundtrip across peers", async () => {
  const client = new WebCryptoSignalClient();
  const alice = await client.generateIdentity();
  const bob = await client.generateIdentity();

  const aliceSession = await client.establishSession(alice.privateState, bob.publicBundle);
  const bobSession = await client.establishSession(bob.privateState, alice.publicBundle);

  const enc = await client.encrypt(aliceSession, "平安", Date.now() + 3600_000);
  assert.ok(enc.ciphertext);
  assert.ok(enc.expiresAt);

  const plain = await client.decrypt(bobSession, enc);
  assert.equal(plain, "平安");

  const reply = await client.encrypt(bobSession, "ack");
  assert.equal(await client.decrypt(aliceSession, reply), "ack");
});

test("WebCryptoSignalClient establishResponderSession X3DH path", async () => {
  const client = new WebCryptoSignalClient();
  const alice = await client.generateIdentity();
  const bob = await client.generateIdentity();
  const alicePriv = JSON.parse(
    decodeURIComponent(escape(atob(alice.privateState))),
  ) as { identity: { publicKey: JsonWebKey } };
  const eph = await generateEphemeralKeyPair();
  const bobSession = await client.establishResponderSession(
    bob.privateState,
    alicePriv.identity.publicKey,
    eph.publicKey,
  );
  assert.ok(bobSession.stateBlob.length > 8);
});
