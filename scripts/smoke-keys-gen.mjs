#!/usr/bin/env node
/**
 * Generate an X3DH-shaped identity bundle + one-time prekeys (P-256 WebCrypto)
 * matching MePage registerDeviceKeys / packages/crypto helpers.
 * Prints JSON on stdout for smoke-keys.sh.
 */
import {
  generateIdentityKeyPair,
  generateOneTimePrekeys,
  generateSignedPrekey,
} from "../packages/crypto/dist/index.js";

const identity = await generateIdentityKeyPair();
const signedPrekey = await generateSignedPrekey(identity, 1);
const oneTimePrekeys = await generateOneTimePrekeys(3, 1);
const registrationId = Math.floor(Math.random() * 16380) + 1;

const bundle = {
  identityKeyPub: JSON.stringify({
    ecdh: identity.publicKey,
    signing: identity.signingPublicKey,
  }),
  signedPrekeyPub: JSON.stringify(signedPrekey.publicKey),
  signedPrekeySig: signedPrekey.signature,
  signedPrekeyId: signedPrekey.id,
  registrationId,
};

const prekeys = {
  prekeys: oneTimePrekeys.map((pk) => ({
    id: pk.id,
    pub: JSON.stringify(pk.publicKey),
  })),
};

process.stdout.write(JSON.stringify({ bundle, prekeys }));
