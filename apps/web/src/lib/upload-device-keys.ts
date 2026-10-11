/**
 * Upload this browser's product Signal public key bundle to the API.
 * Private material stays in IndexedDB via mintProductIdentityForUpload.
 */
import { api } from "./api";
import {
  hasProductIdentity,
  mintProductIdentityForUpload,
  PRODUCT_PRIV_KEY,
} from "./product-signal-chat";
import { saveProductSignalPrefer, loadProductSignalPrefer } from "./product-signal-prefer";
import { secureGet, secureSet } from "./secure-kv";

/** Legacy P-256 X3DH private blob marker (kept for wipe/detect of older installs). */
const DEVICE_PRIV_KEY = "lh.device.priv";

export async function hasLocalDeviceKeys(): Promise<boolean> {
  const [legacy, product] = await Promise.all([
    secureGet(DEVICE_PRIV_KEY),
    hasProductIdentity(),
  ]);
  return Boolean(legacy) || product;
}

export async function uploadDeviceKeyBundle(): Promise<void> {
  saveProductSignalPrefer(loadProductSignalPrefer());
  const bundle = await mintProductIdentityForUpload();

  await api("/v1/keys/bundle", {
    method: "PUT",
    body: JSON.stringify({
      identityKeyPub: bundle.identityKeyPub,
      signedPrekeyPub: bundle.signedPrekeyPub,
      signedPrekeySig: bundle.signedPrekeySig,
      signedPrekeyId: bundle.signedPrekeyId,
      registrationId: bundle.registrationId,
    }),
  });

  const prekeys: { id: number; pub: string }[] = [];
  if (bundle.oneTimePrekeyPub != null && bundle.oneTimePrekeyId != null) {
    prekeys.push({ id: bundle.oneTimePrekeyId, pub: bundle.oneTimePrekeyPub });
  }
  if (bundle.kyberPrekeyPub != null && bundle.kyberPrekeyId != null) {
    prekeys.push({ id: bundle.kyberPrekeyId, pub: bundle.kyberPrekeyPub });
  }
  if (prekeys.length) {
    await api("/v1/keys/prekeys", {
      method: "PUT",
      body: JSON.stringify({ prekeys }),
    });
  }

  await secureSet(DEVICE_PRIV_KEY, `product:${PRODUCT_PRIV_KEY}`);
}
