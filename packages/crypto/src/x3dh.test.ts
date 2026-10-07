import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateEphemeralKeyPair,
  generateIdentityKeyPair,
  generateOneTimePrekeys,
  generateSignedPrekey,
  toPrekeyBundle,
  x3dhInitiate,
  x3dhRespond,
} from "./x3dh.js";
import { initRatchetSession, ratchetDecrypt, ratchetEncrypt } from "./double-ratchet.js";

test("x3dhInitiate and x3dhRespond derive matching shared secrets", async () => {
  const aliceId = await generateIdentityKeyPair();
  const bobId = await generateIdentityKeyPair();
  const bobSpk = await generateSignedPrekey(bobId, 1);
  const bobOtps = await generateOneTimePrekeys(1, 10);
  const bobOtp = bobOtps[0]!;

  const aliceEph = await generateEphemeralKeyPair();
  const bundle = toPrekeyBundle(bobId, bobSpk, 42, bobOtp);

  const aliceSecret = await x3dhInitiate(
    { identity: aliceId, ephemeral: aliceEph },
    bundle,
  );
  const bobSecret = await x3dhRespond(
    { identity: bobId, signedPrekey: bobSpk, oneTimePrekey: bobOtp },
    aliceId.publicKey,
    aliceEph.publicKey,
  );

  assert.equal(aliceSecret.byteLength, 32);
  assert.equal(bobSecret.byteLength, 32);
  assert.deepEqual(new Uint8Array(aliceSecret), new Uint8Array(bobSecret));
});

test("double ratchet encrypt/decrypt roundtrip after x3dh", async () => {
  const aliceId = await generateIdentityKeyPair();
  const bobId = await generateIdentityKeyPair();
  const bobSpk = await generateSignedPrekey(bobId, 1);
  const aliceEph = await generateEphemeralKeyPair();
  const bundle = toPrekeyBundle(bobId, bobSpk, 7);

  const shared = await x3dhInitiate({ identity: aliceId, ephemeral: aliceEph }, bundle);
  let alice = await initRatchetSession(shared, "initiator");
  let bob = await initRatchetSession(shared, "responder");

  const enc = await ratchetEncrypt(alice, "hello church");
  alice = enc.state;
  const dec = await ratchetDecrypt(bob, enc.message);
  bob = dec.state;

  assert.equal(dec.plaintext, "hello church");
  assert.equal(alice.sendN, 1);
  assert.equal(bob.recvN, 1);
});
