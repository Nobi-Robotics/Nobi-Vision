/** Downscaled scene compare. Runs in the browser on pixels; no image is stored. */

export const DIFF_WIDTH = 96;
export const DIFF_HEIGHT = 72;

/** Mean absolute grayscale difference, 0–255. */
export const SCENE_CHANGE_MAD = 3.5;

/** Share of pixels that moved by at least PIXEL_DELTA. */
export const SCENE_CHANGE_RATIO = 0.012;
export const PIXEL_DELTA = 26;

export function meanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i]! - b[i]!);
  return sum / n;
}

export function changedPixelRatio(a: Uint8Array, b: Uint8Array, delta = PIXEL_DELTA): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let changed = 0;
  for (let i = 0; i < n; i++) {
    if (Math.abs(a[i]! - b[i]!) >= delta) changed += 1;
  }
  return changed / n;
}

/** Steady camera shots are rechecked on this cadence so a still bench is still inspected. */
export const STABLE_RECHECK_MS = 6000;

/**
 * Identical frames are skipped, except a live camera look that is due again,
 * a user question, or a change that arrived while another look was in flight.
 */
export function shouldSendFrame(input: {
  similar: boolean;
  hasQuestion: boolean;
  dirty: boolean;
  liveCamera: boolean;
  msSinceLastLook: number;
}): boolean {
  if (input.hasQuestion || input.dirty || !input.similar) return true;
  return input.liveCamera && input.msSinceLastLook >= STABLE_RECHECK_MS;
}

export function compareFrames(previous: Uint8Array, next: Uint8Array): {
  score: number;
  changedPixels: number;
  similar: boolean;
} {
  const score = meanAbsDiff(previous, next);
  const ratio = changedPixelRatio(previous, next);
  const similar = score < SCENE_CHANGE_MAD && ratio < SCENE_CHANGE_RATIO;
  return {
    score: Math.round(score * 10) / 10,
    changedPixels: Math.round(ratio * 1000) / 1000,
    similar,
  };
}

/** 16x16 average hash, returned as a bit string. Useful as a second signal in tests. */
export function averageHashBits(gray: Uint8Array): string {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i]!;
  const mean = gray.length ? sum / gray.length : 0;
  let bits = "";
  for (let i = 0; i < gray.length; i++) bits += gray[i]! >= mean ? "1" : "0";
  return bits;
}

export function hamming(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let distance = 0;
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) distance += 1;
  distance += Math.abs(a.length - b.length);
  return distance;
}

export function grayFromImageData(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < out.length; p += 1, i += 4) {
    out[p] = (data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114) | 0;
  }
  return out;
}
