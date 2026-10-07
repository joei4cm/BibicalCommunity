#!/usr/bin/env node
/**
 * Prove Signal backend resolve + libsignal fail-closed seam.
 * Production Curve25519 remains OPEN until @signalapp/libsignal-client is wired.
 */
import {
  createSignalClient,
  LibsignalNotConfiguredError,
  LibsignalSignalClient,
  resolveSignalBackend,
  WebCryptoSignalClient,
} from "../packages/crypto/dist/index.js";

if (resolveSignalBackend("webcrypto") !== "webcrypto") {
  throw new Error("prefer webcrypto failed");
}
if (resolveSignalBackend("libsignal") !== "libsignal") {
  throw new Error("prefer libsignal failed");
}

const prev = globalThis.LOGOSHOME_SIGNAL_BACKEND;
globalThis.LOGOSHOME_SIGNAL_BACKEND = "libsignal";
if (resolveSignalBackend() !== "libsignal") throw new Error("env libsignal failed");
globalThis.LOGOSHOME_SIGNAL_BACKEND = "webcrypto";
if (resolveSignalBackend() !== "webcrypto") throw new Error("env webcrypto failed");
if (prev === undefined) delete globalThis.LOGOSHOME_SIGNAL_BACKEND;
else globalThis.LOGOSHOME_SIGNAL_BACKEND = prev;

const web = createSignalClient("webcrypto");
if (!(web instanceof WebCryptoSignalClient)) throw new Error("expected WebCryptoSignalClient");

const lib = createSignalClient("libsignal");
if (!(lib instanceof LibsignalSignalClient)) throw new Error("expected LibsignalSignalClient");

let threw = false;
try {
  await lib.generateIdentity();
} catch (e) {
  threw = e instanceof LibsignalNotConfiguredError;
}
if (!threw) throw new Error("libsignal must fail closed with LibsignalNotConfiguredError");

console.log("LIBSIGNAL_SEAM_FAIL_CLOSED_OK");
console.log("SIGNAL_BACKEND_RESOLVE_OK");
