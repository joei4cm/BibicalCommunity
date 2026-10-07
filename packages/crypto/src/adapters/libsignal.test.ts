import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSignalClient,
  LibsignalNotConfiguredError,
  LibsignalSignalClient,
  resolveSignalBackend,
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

test("resolveSignalBackend respects prefer and env", () => {
  assert.equal(resolveSignalBackend("libsignal"), "libsignal");
  assert.equal(resolveSignalBackend("webcrypto"), "webcrypto");
  const g = globalThis as { LOGOSHOME_SIGNAL_BACKEND?: string };
  const prev = g.LOGOSHOME_SIGNAL_BACKEND;
  g.LOGOSHOME_SIGNAL_BACKEND = "libsignal";
  assert.equal(resolveSignalBackend(), "libsignal");
  g.LOGOSHOME_SIGNAL_BACKEND = "webcrypto";
  assert.equal(resolveSignalBackend(), "webcrypto");
  if (prev === undefined) delete g.LOGOSHOME_SIGNAL_BACKEND;
  else g.LOGOSHOME_SIGNAL_BACKEND = prev;
});
