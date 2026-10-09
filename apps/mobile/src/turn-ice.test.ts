import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIceServersFromTurnResponse, turnResponseHasRelay } from "./turn-ice";

describe("turn-ice", () => {
  it("splits STUN and TURN with credentials", () => {
    const servers = buildIceServersFromTurnResponse({
      username: "u",
      credential: "c",
      uris: ["stun:stun.example:3478", "turn:turn.example:3478?transport=udp"],
      hasRelay: true,
    });
    assert.ok(servers.some((s) => JSON.stringify(s.urls).includes("stun:")));
    const relay = servers.find((s) => s.username === "u");
    assert.ok(relay);
    assert.equal(relay?.credential, "c");
  });

  it("detects relay", () => {
    assert.equal(turnResponseHasRelay({ uris: ["stun:a"], hasRelay: false }), false);
    assert.equal(turnResponseHasRelay({ uris: ["turn:b"] }), true);
  });
});
