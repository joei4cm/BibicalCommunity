import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  discoveryAllowed,
  messageRequestAllowed,
  readPrivacy,
} from "./privacy-policy.js";

describe("readPrivacy", () => {
  it("fills defaults when the blob is empty", () => {
    const privacy = readPrivacy(null);
    assert.equal(privacy?.discoverableByHandle, true);
    assert.equal(privacy?.discoverableByUid, true);
    assert.equal(privacy?.showInChurchDirectory, true);
    assert.equal(privacy?.allowMessageRequests, "church-only");
  });

  it("keeps a partial override and defaults the rest", () => {
    const privacy = readPrivacy(JSON.stringify({ discoverableByHandle: false }));
    assert.equal(privacy?.discoverableByHandle, false);
    assert.equal(privacy?.discoverableByUid, true);
  });

  it("fails closed on corrupt JSON", () => {
    assert.equal(readPrivacy("{"), null);
  });
});

describe("discoveryAllowed", () => {
  const privacy = readPrivacy(
    JSON.stringify({ discoverableByUid: true, discoverableByHandle: false }),
  )!;

  it("allows UID lookup only when that switch is on", () => {
    assert.equal(discoveryAllowed(privacy, "uid"), true);
    assert.equal(discoveryAllowed(privacy, "handle"), false);
  });
});

describe("messageRequestAllowed", () => {
  it("follows everyone, off, church-only, and admin-approved", () => {
    assert.equal(
      messageRequestAllowed({
        privacy: readPrivacy(JSON.stringify({ allowMessageRequests: "everyone" }))!,
        sharesChurch: false,
        requesterIsAdmin: false,
      }),
      true,
    );
    assert.equal(
      messageRequestAllowed({
        privacy: readPrivacy(JSON.stringify({ allowMessageRequests: "off" }))!,
        sharesChurch: true,
        requesterIsAdmin: true,
      }),
      false,
    );
    assert.equal(
      messageRequestAllowed({
        privacy: readPrivacy(JSON.stringify({ allowMessageRequests: "church-only" }))!,
        sharesChurch: false,
        requesterIsAdmin: true,
      }),
      false,
    );
    assert.equal(
      messageRequestAllowed({
        privacy: readPrivacy(JSON.stringify({ allowMessageRequests: "church-only" }))!,
        sharesChurch: true,
        requesterIsAdmin: false,
      }),
      true,
    );
    assert.equal(
      messageRequestAllowed({
        privacy: readPrivacy(JSON.stringify({ allowMessageRequests: "admin-approved" }))!,
        sharesChurch: true,
        requesterIsAdmin: false,
      }),
      false,
    );
    assert.equal(
      messageRequestAllowed({
        privacy: readPrivacy(JSON.stringify({ allowMessageRequests: "admin-approved" }))!,
        sharesChurch: true,
        requesterIsAdmin: true,
      }),
      true,
    );
  });
});
