import assert from "node:assert/strict";
import { test } from "node:test";
import { averageHashBits, compareFrames, hamming, meanAbsDiff, shouldSendFrame, STABLE_RECHECK_MS } from "./frame-diff";

test("identical frames are skipped and a wire-sized change is not", () => {
  const stable = new Uint8Array(96 * 72).fill(40);
  const same = stable.slice();
  const still = compareFrames(stable, same);
  assert.equal(still.similar, true);
  assert.equal(still.score, 0);

  const moved = stable.slice();
  for (let i = 0; i < moved.length; i += 17) moved[i] = 200;
  const change = compareFrames(stable, moved);
  assert.equal(change.similar, false);
  assert.ok(change.score > 3);
  assert.ok(meanAbsDiff(stable, moved) > 0);
});

test("a steady camera is rechecked, a steady demo frame is not", () => {
  assert.equal(
    shouldSendFrame({ similar: true, hasQuestion: false, dirty: false, liveCamera: true, msSinceLastLook: STABLE_RECHECK_MS }),
    true,
  );
  assert.equal(
    shouldSendFrame({ similar: true, hasQuestion: false, dirty: false, liveCamera: true, msSinceLastLook: STABLE_RECHECK_MS - 1 }),
    false,
  );
  assert.equal(
    shouldSendFrame({ similar: true, hasQuestion: false, dirty: false, liveCamera: false, msSinceLastLook: 60_000 }),
    false,
  );
  assert.equal(
    shouldSendFrame({ similar: true, hasQuestion: true, dirty: false, liveCamera: false, msSinceLastLook: 0 }),
    true,
  );
  assert.equal(
    shouldSendFrame({ similar: false, hasQuestion: false, dirty: false, liveCamera: true, msSinceLastLook: 0 }),
    true,
  );
});

test("average hash distance grows when a region flips", () => {
  const base = new Uint8Array(16 * 16).fill(10);
  const other = base.slice();
  for (let i = 0; i < 40; i++) other[i] = 250;
  const distance = hamming(averageHashBits(base), averageHashBits(other));
  assert.ok(distance > 8);
  assert.equal(hamming(averageHashBits(base), averageHashBits(base)), 0);
});
