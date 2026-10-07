import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSignalClient,
  LibsignalNotConfiguredError,
  LibsignalSignalClient,
} from "./libsignal.js";

test("createSignalClient defaults to WebCrypto and encrypts", async () => {
  const client = createSignalClient("webcrypto");
  const a = await client.generateIdentity();
  const b = await client.generateIdentity();
  const session = await client.establishSession(a.privateState, b.publicBundle);
  const enc = await client.encrypt(session, "hi");
  assert.ok(enc.ciphertext.length > 0);
});

test("LibsignalSignalClient fails closed until configured", async () => {
  const client = new LibsignalSignalClient();
  await assert.rejects(() => client.generateIdentity(), LibsignalNotConfiguredError);
  const viaFactory = createSignalClient("libsignal");
  await assert.rejects(() => viaFactory.generateIdentity(), LibsignalNotConfiguredError);
});
