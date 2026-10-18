import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clipPreview, trimThread, upsertPreview, type StoredChatMessage } from "./chat-local.ts";

function msg(id: string, createdAt: number, expiresAt: number | null = null): StoredChatMessage {
  return {
    id,
    senderDeviceId: "dev",
    ratchetHeader: "h",
    ciphertext: "c",
    contentType: "msg",
    createdAt,
    expiresAt,
  };
}

describe("chat local cache", () => {
  it("drops expired rows and keeps the newest 80", () => {
    const rows = Array.from({ length: 90 }, (_, i) => msg(`m${i}`, i + 1));
    rows.push(msg("gone", 10, 1));
    const kept = trimThread(rows, 50);
    assert.equal(kept.length, 80);
    assert.equal(kept[0]?.id, "m10");
    assert.equal(kept.at(-1)?.id, "m89");
    assert.equal(kept.some((m) => m.id === "gone"), false);
  });

  it("clips previews and forgets ciphertext placeholders", () => {
    assert.equal(clipPreview("  你好\n世界  "), "你好 世界");
    const map = upsertPreview({}, "c1", "[ciphertext]", 2);
    assert.deepEqual(map, {});
    const next = upsertPreview({}, "c1", "平安", 3);
    assert.equal(next.c1?.text, "平安");
  });
});
