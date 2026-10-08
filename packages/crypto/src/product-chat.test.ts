import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createProductChatIdentity,
  isProductX25519IdentityPub,
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
      JSON.stringify({
        ecdh: { kty: "EC", crv: "P-256" },
        signing: { kty: "EC", crv: "P-256" },
      }),
    ),
    false,
  );
  assert.equal(isProductX25519IdentityPub("not-json"), false);
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
