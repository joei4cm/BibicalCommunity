#!/usr/bin/env node
/**
 * Prove Signal backend resolve + libsignal fail-closed seam + native package probe.
 * When @signalapp/libsignal-client loads on Node, also prove native roundtrip.
 */
import {
  createSignalClient,
  createSignalClientAsync,
  LibsignalNotConfiguredError,
  LibsignalSignalClient,
  probeLibsignalPackage,
  resolveSignalBackend,
  WebCryptoSignalClient,
} from "../packages/crypto/dist/index.js";
import { NativeLibsignalSignalClient } from "../packages/crypto/dist/adapters/libsignal-native.js";

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

// Sync factory remains fail-closed stub (safe for Workers without native).
const libSync = createSignalClient("libsignal");
if (!(libSync instanceof LibsignalSignalClient)) throw new Error("expected LibsignalSignalClient stub");
let threw = false;
try {
  await libSync.generateIdentity();
} catch (e) {
  threw = e instanceof LibsignalNotConfiguredError;
}
if (!threw) throw new Error("sync libsignal factory must fail closed");

const probe = await probeLibsignalPackage();
if (!probe.available) {
  console.log("LIBSIGNAL_PACKAGE_PROBE_OPEN package=" + probe.packageName);
  console.log("LIBSIGNAL_PACKAGE_PROBE_REASON=" + (probe.reason ?? "unavailable").slice(0, 160));
} else {
  console.log("LIBSIGNAL_PACKAGE_PROBE_OK package=" + probe.packageName);
  if (probe.nativeRoundtrip) {
    console.log("LIBSIGNAL_NATIVE_ROUNDTRIP_OK");
  } else {
    console.log("LIBSIGNAL_NATIVE_ROUNDTRIP_OPEN reason=" + (probe.reason ?? "").slice(0, 160));
  }
}

const libAsync = await createSignalClientAsync("libsignal");
if (probe.available && probe.nativeRoundtrip) {
  if (!(libAsync instanceof NativeLibsignalSignalClient)) {
    throw new Error("expected NativeLibsignalSignalClient from async factory");
  }
} else if (!(libAsync instanceof LibsignalSignalClient)) {
  throw new Error("expected fail-closed stub when native unavailable");
}

console.log("LIBSIGNAL_SEAM_FAIL_CLOSED_OK");
console.log("SIGNAL_BACKEND_RESOLVE_OK");
