import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createProductChatIdentity,
  isProductIdentityPub,
  isProductOpenE2eeIdentityPub,
  isProductX25519IdentityPub,
  productBackendFromIdentityPub,
  productChatDecrypt,
  productChatEncrypt,
  productChatEstablish,
  productChatPeerRoundtrip,
} from "./product-chat.js";

test("isProductX25519IdentityPub detects curve and raw pubs", () => {
  assert.equal(
    isProductX25519IdentityPub(
      JSON.stringify({ curve: "x25519", ecdh: "abc", signing: "def" }),
    ),
    true,
  );
  assert.equal(
    isProductX25519IdentityPub(JSON.stringify({ ecdh: "abc", signing: "def" })),
    true,
  );
  assert.equal(
    isProductX25519IdentityPub(
      JSON.stringify({ curve: "opene2ee", ecdh: "abc", signing: "def" }),
    ),
    false,
  );
  assert.equal(
    isProductX25519IdentityPub(
      JSON.stringify({
        ecdh: { kty: "EC", crv: "P-256" },
        signing: { kty: "EC", crv: "P-256" },
      }),
    ),
    false,
  );
  assert.equal(isProductX25519IdentityPub("not-json"), false);
});

test("isProductOpenE2eeIdentityPub + productBackendFromIdentityPub", () => {
  const oe = JSON.stringify({ curve: "opene2ee", ecdh: "a", signing: "b" });
  assert.equal(isProductOpenE2eeIdentityPub(oe), true);
  assert.equal(isProductIdentityPub(oe), true);
  assert.equal(productBackendFromIdentityPub(oe), "opene2ee");
  assert.equal(
    productBackendFromIdentityPub(JSON.stringify({ curve: "x25519", ecdh: "a", signing: "b" })),
    "x25519",
  );
});

test("createProductChatIdentity + establish encrypt/decrypt", async () => {
  const alice = await createProductChatIdentity("x25519");
  const bob = await createProductChatIdentity("x25519");
  assert.equal(alice.identity.backend, "x25519");
  assert.ok(isProductX25519IdentityPub(alice.identity.publicBundle.identityKeyPub));

  const as = await productChatEstablish(
    alice.client,
    alice.identity.privateState,
    bob.identity.publicBundle,
  );
  const bs = await productChatEstablish(
    bob.client,
    bob.identity.privateState,
    alice.identity.publicBundle,
  );
  const enc = await productChatEncrypt(alice.client, as, "product-chat-wire");
  assert.equal(await productChatDecrypt(bob.client, bs, enc), "product-chat-wire");
});

test("productChatPeerRoundtrip", async () => {
  const r = await productChatPeerRoundtrip("圣言家-product", "x25519");
  assert.equal(r.ok, true);
  assert.equal(r.backend, "x25519");
});

test("productChatPeerRoundtrip opene2ee", async () => {
  const r = await productChatPeerRoundtrip("圣言家-opene2ee", "opene2ee");
  assert.equal(r.ok, true);
  assert.equal(r.backend, "opene2ee");
  const alice = await createProductChatIdentity("opene2ee");
  assert.equal(alice.identity.backend, "opene2ee");
  assert.ok(isProductOpenE2eeIdentityPub(alice.identity.publicBundle.identityKeyPub));
  assert.ok(alice.identity.publicBundle.kyberPrekeyPub);
});
