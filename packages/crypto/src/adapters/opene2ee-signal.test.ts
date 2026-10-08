import assert from "node:assert/strict";
import { test } from "node:test";
import { createProductSignalClient, resolveProductSignalBackend } from "./libsignal.js";
import { OpenE2eeSignalClient } from "./opene2ee-signal.js";

test("createProductSignalClient(opene2ee) peer roundtrip with Kyber in public bundle", async () => {
  assert.equal(resolveProductSignalBackend("opene2ee"), "opene2ee");
  const client = await createProductSignalClient("opene2ee");
  assert.ok(client instanceof OpenE2eeSignalClient);
  const a = await client.generateIdentity();
  const b = await client.generateIdentity();
  assert.ok(a.publicBundle.kyberPrekeyPub);
  assert.ok(b.publicBundle.kyberPrekeyPub);
  assert.match(a.publicBundle.identityKeyPub, /opene2ee/);
  const as = await client.establishSession(a.privateState, b.publicBundle);
  const bs = await client.establishSession(b.privateState, a.publicBundle);
  const enc = await client.encrypt(as, "product-opene2ee");
  assert.equal(await client.decrypt(bs, enc), "product-opene2ee");
  const ack = await client.encrypt(bs, "product-opene2ee:ack");
  assert.equal(await client.decrypt(as, ack), "product-opene2ee:ack");
});
