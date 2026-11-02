import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * Documents CallRoomDO invite buffer contract without spinning up a DO runtime:
 * ring + offer + trickle ICE must be replayable to a late joiner; answer/hangup
 * clears the invite; a new offer clears prior ICE.
 */
type BufferedInvite = {
  ring?: string;
  offer?: string;
  ice: string[];
  from: string;
};

function applySignal(
  buf: BufferedInvite | null,
  from: string,
  type: string,
  payload: string,
): BufferedInvite | null {
  if (type === "hangup" || type === "answer") return null;
  const next = !buf || buf.from !== from ? { ice: [] as string[], from } : buf;
  if (type === "ring") next.ring = payload;
  if (type === "offer") {
    next.offer = payload;
    next.ice = [];
  }
  if (type === "ice") next.ice.push(payload);
  return next;
}

function replay(buf: BufferedInvite | null, joiner: string): string[] {
  if (!buf || buf.from === joiner) return [];
  const out: string[] = [];
  if (buf.ring) out.push(buf.ring);
  if (buf.offer) out.push(buf.offer);
  out.push(...buf.ice);
  return out;
}

test("buffers ring, offer, and ICE for late joiner", () => {
  let buf: BufferedInvite | null = null;
  buf = applySignal(buf, "caller", "ring", "ring1");
  buf = applySignal(buf, "caller", "offer", "offer1");
  buf = applySignal(buf, "caller", "ice", "ice1");
  buf = applySignal(buf, "caller", "ice", "ice2");
  assert.deepEqual(replay(buf, "callee"), ["ring1", "offer1", "ice1", "ice2"]);
});

test("new offer clears prior ICE", () => {
  let buf: BufferedInvite | null = null;
  buf = applySignal(buf, "caller", "offer", "offer1");
  buf = applySignal(buf, "caller", "ice", "ice1");
  buf = applySignal(buf, "caller", "offer", "offer2");
  assert.deepEqual(replay(buf, "callee"), ["offer2"]);
});

test("answer clears buffered invite", () => {
  let buf: BufferedInvite | null = null;
  buf = applySignal(buf, "caller", "offer", "offer1");
  buf = applySignal(buf, "caller", "ice", "ice1");
  buf = applySignal(buf, "callee", "answer", "answer1");
  assert.equal(buf, null);
});
