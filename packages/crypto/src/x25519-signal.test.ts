import assert from "node:assert/strict";
import { test } from "node:test";
import { createSignalClient, resolveSignalBackend } from "./adapters/libsignal.js";
import { probeCurve25519WebCrypto, X25519SignalClient } from "./x25519-signal.js";

test("probeCurve25519WebCrypto detects X25519+Ed25519", async () => {
  assert.equal(await probeCurve25519WebCrypto(), true);
});

test("X25519SignalClient encrypt/decrypt roundtrip across peers", async () => {
  const client = new X25519SignalClient();
  const alice = await client.generateIdentity();
  const bob = await client.generateIdentity();

  const aliceSession = await client.establishSession(alice.privateState, bob.publicBundle);
  const bobSession = await client.establishSession(bob.privateState, alice.publicBundle);

  const msg = await client.encrypt(aliceSession, "curve25519 hello 聖言");
  const pt = await client.decrypt(bobSession, msg);
  assert.equal(pt, "curve25519 hello 聖言");

  const reply = await client.encrypt(bobSession, "ack");
  assert.equal(await client.decrypt(aliceSession, reply), "ack");
});

test("createSignalClient(x25519) returns X25519SignalClient", async () => {
  assert.equal(resolveSignalBackend("x25519"), "x25519");
  const client = createSignalClient("x25519");
  assert.ok(client instanceof X25519SignalClient);
  const id = await client.generateIdentity();
  assert.match(id.publicBundle.identityKeyPub, /x25519/);
});
