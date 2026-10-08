#!/usr/bin/env node
/**
 * Prove Signal backend resolve + libsignal fail-closed seam + package probe.
 * Production Curve25519 remains OPEN until @signalapp/libsignal-client is wired.
 */
import {
  createSignalClient,
  LibsignalNotConfiguredError,
  LibsignalSignalClient,
  probeLibsignalPackage,
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

const probe = await probeLibsignalPackage();
if (probe.available) {
  console.log("LIBSIGNAL_PACKAGE_PROBE_OK package=" + probe.packageName);
} else {
  // Expected in this tree until the production package is provisioned.
  console.log("LIBSIGNAL_PACKAGE_PROBE_OPEN package=" + probe.packageName);
  console.log("LIBSIGNAL_PACKAGE_PROBE_REASON=" + (probe.reason ?? "unavailable").slice(0, 160));
}

console.log("LIBSIGNAL_SEAM_FAIL_CLOSED_OK");
console.log("SIGNAL_BACKEND_RESOLVE_OK");
