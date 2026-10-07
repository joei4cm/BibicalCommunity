/**
 * Unit tests for startScreenShare / stopScreenShare.
 * Mocks getDisplayMedia + RTCPeerConnection senders — no real display picker.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { startScreenShare, stopScreenShare } from "./webrtc.js";

type FakeTrack = MediaStreamTrack & { kind: string; stop: () => void };

function makeTrack(kind: "video" | "audio", id: string): FakeTrack {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    kind,
    id,
    enabled: true,
    muted: false,
    readyState: "live",
    label: id,
    stop() {
      (this as { readyState: string }).readyState = "ended";
    },
    addEventListener(type: string, fn: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: EventListener) {
      listeners.get(type)?.delete(fn);
    },
  } as unknown as FakeTrack;
}

function makeStream(tracks: FakeTrack[]): MediaStream {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
    id: "stream_" + tracks.map((t) => t.id).join("_"),
  } as unknown as MediaStream;
}

type FakeSender = {
  track: FakeTrack | null;
  replaceTrack: (t: MediaStreamTrack | null) => Promise<void>;
  replacedWith: Array<MediaStreamTrack | null>;
};

function makePc(initialVideo?: FakeTrack): RTCPeerConnection & {
  senders: FakeSender[];
  added: Array<{ track: MediaStreamTrack; stream: MediaStream }>;
} {
  const senders: FakeSender[] = [];
  if (initialVideo) {
    const sender: FakeSender = {
      track: initialVideo,
      replacedWith: [],
      async replaceTrack(t) {
        this.replacedWith.push(t);
        this.track = t as FakeTrack | null;
      },
    };
    senders.push(sender);
  }
  const added: Array<{ track: MediaStreamTrack; stream: MediaStream }> = [];
  return {
    senders,
    added,
    getSenders: () => senders as unknown as RTCRtpSender[],
    addTrack(track: MediaStreamTrack, stream: MediaStream) {
      added.push({ track, stream });
      const sender: FakeSender = {
        track: track as FakeTrack,
        replacedWith: [],
        async replaceTrack(t) {
          this.replacedWith.push(t);
          this.track = t as FakeTrack | null;
        },
      };
      senders.push(sender);
      return sender as unknown as RTCRtpSender;
    },
  } as unknown as RTCPeerConnection & {
    senders: FakeSender[];
    added: Array<{ track: MediaStreamTrack; stream: MediaStream }>;
  };
}

const origNav = globalThis.navigator;

beforeEach(() => {
  const gdm = async () => {
    throw new Error("getDisplayMedia stub not installed");
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: { getDisplayMedia: gdm },
    },
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: origNav,
  });
});

test("startScreenShare replaces existing video sender via getDisplayMedia", async () => {
  const displayTrack = makeTrack("video", "display");
  const display = makeStream([displayTrack]);
  let gdmCalled = 0;
  (navigator.mediaDevices as { getDisplayMedia: typeof navigator.mediaDevices.getDisplayMedia }).getDisplayMedia =
    async () => {
      gdmCalled += 1;
      return display;
    };

  const camera = makeTrack("video", "camera");
  const pc = makePc(camera);

  const out = await startScreenShare(pc);
  assert.equal(out, display);
  assert.equal(gdmCalled, 1);
  assert.equal(pc.senders[0]!.replacedWith.length, 1);
  assert.equal(pc.senders[0]!.replacedWith[0], displayTrack);
  assert.equal(pc.added.length, 0);
});

test("startScreenShare adds track when no video sender exists", async () => {
  const displayTrack = makeTrack("video", "display2");
  const display = makeStream([displayTrack]);
  (navigator.mediaDevices as { getDisplayMedia: typeof navigator.mediaDevices.getDisplayMedia }).getDisplayMedia =
    async () => display;

  const pc = makePc();
  await startScreenShare(pc);
  assert.equal(pc.added.length, 1);
  assert.equal(pc.added[0]!.track, displayTrack);
  assert.equal(pc.added[0]!.stream, display);
});

test("startScreenShare throws when getDisplayMedia returns no video track", async () => {
  (navigator.mediaDevices as { getDisplayMedia: typeof navigator.mediaDevices.getDisplayMedia }).getDisplayMedia =
    async () => makeStream([]);
  const pc = makePc();
  await assert.rejects(() => startScreenShare(pc), /no_display_track/);
});

test("stopScreenShare restore camera track on video sender", async () => {
  const camera = makeTrack("video", "camera");
  const display = makeTrack("video", "display");
  const pc = makePc(display);
  const cameraStream = makeStream([camera]);

  await stopScreenShare(pc, cameraStream);
  assert.equal(pc.senders[0]!.replacedWith.length, 1);
  assert.equal(pc.senders[0]!.replacedWith[0], camera);
});

test("stopScreenShare with no camera clears video sender track", async () => {
  const display = makeTrack("video", "display");
  const pc = makePc(display);
  await stopScreenShare(pc, null);
  assert.equal(pc.senders[0]!.replacedWith[0], null);
});
