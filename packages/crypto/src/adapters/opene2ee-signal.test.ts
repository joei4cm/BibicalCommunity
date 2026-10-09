import assert from "node:assert/strict";
import { test } from "node:test";
import { createProductSignalClient, resolveProductSignalBackend } from "./libsignal.js";
import { OpenE2eeSignalClient } from "./opene2ee-signal.js";

function decodeBlob(stateBlob: string): {
  usedPQXDH?: boolean;
  role?: string;
  sharedMaterial?: string;
  pendingPrekey?: unknown;
} {
  return JSON.parse(decodeURIComponent(escape(atob(stateBlob)))) as {
    usedPQXDH?: boolean;
    role?: string;
    sharedMaterial?: string;
    pendingPrekey?: unknown;
  };
}

function decodeHeader(ratchetHeader: string): {
  usedPQXDH?: boolean;
  prekey?: unknown;
  iv?: string;
} {
  return JSON.parse(decodeURIComponent(escape(atob(ratchetHeader)))) as {
    usedPQXDH?: boolean;
    prekey?: unknown;
    iv?: string;
  };
}

test("createProductSignalClient(opene2ee) PQXDH product establish + peer roundtrip", async () => {
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

  const aBlob = decodeBlob(as.stateBlob);
  const bBlob = decodeBlob(bs.stateBlob);
  assert.equal(aBlob.usedPQXDH, true);
  assert.equal(bBlob.usedPQXDH, true);
  assert.ok(
    (aBlob.role === "initiator" && bBlob.role === "responder") ||
      (aBlob.role === "responder" && bBlob.role === "initiator"),
  );
  if (aBlob.role === "initiator") {
    assert.ok(aBlob.sharedMaterial);
    assert.ok(aBlob.pendingPrekey);
    assert.equal(bBlob.sharedMaterial, undefined);
  } else {
    assert.ok(bBlob.sharedMaterial);
    assert.ok(bBlob.pendingPrekey);
    assert.equal(aBlob.sharedMaterial, undefined);
  }

  const initiatorSession = aBlob.role === "initiator" ? as : bs;
  const responderSession = aBlob.role === "initiator" ? bs : as;

  const enc = await client.encrypt(initiatorSession, "product-opene2ee-pqxdh");
  const header = decodeHeader(enc.ratchetHeader);
  assert.equal(header.usedPQXDH, true);
  assert.ok(header.prekey);
  assert.ok(header.iv);

  assert.equal(await client.decrypt(responderSession, enc), "product-opene2ee-pqxdh");
  const after = decodeBlob(responderSession.stateBlob);
  assert.ok(after.sharedMaterial);

  const ack = await client.encrypt(responderSession, "product-opene2ee-pqxdh:ack");
  const ackHeader = decodeHeader(ack.ratchetHeader);
  assert.equal(ackHeader.prekey, undefined);
  assert.equal(await client.decrypt(initiatorSession, ack), "product-opene2ee-pqxdh:ack");
});
