import { test } from "node:test";
import assert from "node:assert/strict";
import { createSignalClientAsync, probeLibsignalPackage } from "./libsignal.js";
import { NativeLibsignalSignalClient } from "./libsignal-native.js";

test("probeLibsignalPackage reports native package + roundtrip on Node", async () => {
  const probe = await probeLibsignalPackage();
  assert.equal(probe.packageName, "@signalapp/libsignal-client");
  assert.equal(probe.available, true);
  assert.equal(probe.nativeRoundtrip, true);
});

test("createSignalClientAsync(libsignal) returns native client and roundtrips", async () => {
  const client = await createSignalClientAsync("libsignal");
  assert.ok(client instanceof NativeLibsignalSignalClient);
  const a = await client.generateIdentity();
  const b = await client.generateIdentity();
  assert.ok(a.publicBundle.kyberPrekeyPub);
  assert.ok(b.publicBundle.kyberPrekeyPub);

  const session = await client.establishSession(a.privateState, b.publicBundle);
  const aPriv = JSON.parse(a.privateState) as { userId: string; deviceId: number };
  const responder = {
    remoteUserId: aPriv.userId,
    remoteDeviceId: String(aPriv.deviceId),
    stateBlob: JSON.stringify({
      v: 1,
      local: JSON.parse(b.privateState),
      remoteUserId: aPriv.userId,
      remoteDeviceId: aPriv.deviceId,
      role: "responder",
      remoteIdentityPub: a.publicBundle.identityKeyPub,
    }),
  };

  const enc = await client.encrypt(session, "native-ok");
  const plain = await client.decrypt(responder, enc);
  assert.equal(plain, "native-ok");

  // Bidirectional whisper after first prekey
  const reply = await client.encrypt(responder, "ack");
  const ack = await client.decrypt(session, reply);
  assert.equal(ack, "ack");
});
