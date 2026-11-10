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

test("room capacity is by unique user, not socket count", () => {
  // Simulate: callee listen + caller session = 2 sockets, 2 users (full for DM).
  // Callee Accept replaces their listen socket → still 2 users, must be allowed.
  const sockets = new Map<string, string>([
    ["ws-caller", "caller"],
    ["ws-callee-listen", "callee"],
  ]);
  const dropUser = (userId: string) => {
    for (const [id, uid] of [...sockets]) {
      if (uid === userId) sockets.delete(id);
    }
  };
  const unique = () => new Set(sockets.values()).size;
  const maxPeers = 2;
  dropUser("callee");
  assert.equal(unique(), 1);
  assert.equal(unique() >= maxPeers, false);
  sockets.set("ws-callee-session", "callee");
  assert.equal(unique(), 2);
});

/**
 * Disconnect hangup policy (mirrors CallRoomDO.webSocketClose):
 * - replaced listen→session: never hangup
 * - caller abandon while ringing: hangup
 * - mid-call (buffer cleared): hangup
 * - callee listen drop while invite buffered: no hangup (reconnect)
 */
function shouldHangupOnClose(opts: {
  reason: string;
  userId: string;
  remainingUserIds: string[];
  bufferedFrom: string | null;
}): boolean {
  if (opts.reason === "replaced") return false;
  if (opts.remainingUserIds.includes(opts.userId)) return false;
  if (opts.remainingUserIds.length === 0) return false;
  const callerAbandoned = opts.bufferedFrom === opts.userId;
  const midCall = opts.bufferedFrom === null;
  return callerAbandoned || midCall;
}

test("replaced listen socket does not hang up", () => {
  assert.equal(
    shouldHangupOnClose({
      reason: "replaced",
      userId: "callee",
      remainingUserIds: ["caller"],
      bufferedFrom: "caller",
    }),
    false,
  );
});

test("caller abandon while ringing hangs up", () => {
  assert.equal(
    shouldHangupOnClose({
      reason: "",
      userId: "caller",
      remainingUserIds: ["callee"],
      bufferedFrom: "caller",
    }),
    true,
  );
});

test("callee listen drop while ringing does not hang up", () => {
  assert.equal(
    shouldHangupOnClose({
      reason: "",
      userId: "callee",
      remainingUserIds: ["caller"],
      bufferedFrom: "caller",
    }),
    false,
  );
});

test("mid-call peer leave hangs up", () => {
  assert.equal(
    shouldHangupOnClose({
      reason: "",
      userId: "callee",
      remainingUserIds: ["caller"],
      bufferedFrom: null,
    }),
    true,
  );
});
