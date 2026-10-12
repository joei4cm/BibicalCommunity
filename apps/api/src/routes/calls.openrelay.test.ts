import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { openRelayIceServers } from "./calls.js";

describe("openRelayIceServers", () => {
  it("returns TURN relay credentials for cross-NAT fallback", () => {
    const out = openRelayIceServers();
    assert.equal(out.hasRelay, true);
    assert.equal(out.provider, "openrelay-fallback");
    assert.ok(out.uris.some((u) => u.startsWith("turn:") || u.startsWith("turns:")));
    assert.ok(out.iceServers.some((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return urls.some((u) => String(u).startsWith("turn") && s.username && s.credential);
    }));
  });
});
