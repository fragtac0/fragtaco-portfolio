/**
 * What changes tile by tile. A count by 1 RGBA8 texture the shader reads: R the picture's reveal (the tile's local
 * art until the picture is in, then a 350 ms fade over it), G the tile's arrival opacity, B the focus ring, A the
 * arrival scale (0 is `ARRIVAL.scaleFrom`, 255 is full size). The hover growth
 * is not in the texture: a grown tile overlaps its neighbours, so the shader draws the few tiles that
 * are grown on top, from `grown` (up to 4 pairs of tile index and amount, the smallest amount first so
 * the strongest is drawn last; index -1 is an empty slot). The values ease on the CPU (exponential,
 * frame rate independent) and the texture is re-sent only on a frame where a byte changed. With reduced
 * motion everything snaps.
 *
 * Original work for this site; the shader that reads it is ported from the ObsidianUI Art Gallery (MIT,
 * see gallery-shaders.ts).
 */

import type * as THREE from "three";
import { approach } from "./gallery-math";
import { ARRIVAL, arrival } from "./wall-arrival";

const REVEAL_MS = 350;
const HOVER_RATE = 14; // per second: about 70 ms to settle
const RING_RATE = 20;
export const GROWN_SLOTS = 4;

/**
 * A picture's reveal, 0 to 1. `loadedAt` is stamped with performance.now() at the upload, which can be a little
 * later than the frame's own `now`, so the raw difference can be slightly negative on that frame: clamped.
 */
export function revealOf(loadedAtMs: number, now: number, reduced: boolean): number {
  if (!(loadedAtMs > 0)) return 0;
  return reduced ? 1 : Math.min(1, Math.max(0, (now - loadedAtMs) / REVEAL_MS));
}

/**
 * The grown tiles for the shader: the [index, amount] pairs with an amount above 0, the strongest few that fit,
 * smallest first so the strongest is drawn last, and the tile under the pointer (`target`) always in the last
 * slot, drawn over the ones that are shrinking, and never dropped.
 */
export function pickGrown(entries: Array<[number, number]>, target: number | null, slots: number): Array<[number, number]> {
  const t = target === null ? undefined : entries.find((e) => e[0] === target);
  const rest = entries.filter((e) => e !== t).sort((a, b) => b[1] - a[1]);
  rest.length = Math.min(rest.length, slots - (t ? 1 : 0));
  rest.reverse();
  if (t) rest.push(t);
  return rest;
}

export type TileState = {
  texture: THREE.DataTexture;
  /** The grid the tiles arrive in: columns, rows and how many columns a short last row is shifted to the middle. Asked again after a resize. */
  setLayout(cols: number, rows: number, lastShift: number): void;
  /** The first frame is drawn at `now`: the arrival runs from here, and pictures already in show whole. */
  start(now: number): void;
  setHover(i: number | null): void;
  setFocus(i: number | null): void;
  /** The eased hover amount of tile `i`, 0 to 1. */
  amount(i: number): number;
  /** Flat [index, amount] x GROWN_SLOTS for the shader, see the header. */
  grown: Float32Array;
  /** Moves the values on by `dt` and re-sends the texture if a byte changed. True while anything is still easing or arriving. */
  step(dt: number, now: number, loadedAt: Float64Array): boolean;
  dispose(): void;
};

export function createTileState(T: typeof THREE, count: number, reduced: boolean): TileState {
  const data = new Uint8Array(count * 4); // all zero: nothing has arrived, nothing is revealed
  const texture = new T.DataTexture(data, count, 1);
  texture.magFilter = T.NearestFilter;
  texture.minFilter = T.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const hover = new Float32Array(count);
  const ring = new Float32Array(count);
  let hoverIdx: number | null = null;
  let focusIdx: number | null = null;
  let cols = 1;
  let rows = count;
  let lastShift = 0;
  let startedAt = -1;

  const grown = new Float32Array(GROWN_SLOTS * 2);
  const live: Array<[number, number]> = [];

  return {
    texture,
    grown,
    setLayout(c, r, shift) {
      cols = c;
      rows = r;
      lastShift = shift;
    },
    start(now) {
      startedAt = now;
    },
    amount: (i) => hover[i] ?? 0,
    setHover: (i) => (hoverIdx = i),
    setFocus: (i) => (focusIdx = i),
    step(dt, now, loadedAt) {
      let busy = false;
      let changed = false;
      const started = startedAt >= 0;
      const t = now - startedAt;
      live.length = 0;
      for (let i = 0; i < count; i++) {
        hover[i] = reduced ? (i === hoverIdx ? 1 : 0) : approach(hover[i], i === hoverIdx ? 1 : 0, dt, HOVER_RATE);
        ring[i] = reduced ? (i === focusIdx ? 1 : 0) : approach(ring[i], i === focusIdx ? 1 : 0, dt, RING_RATE);
        if (hover[i] !== (i === hoverIdx ? 1 : 0) || ring[i] !== (i === focusIdx ? 1 : 0)) busy = true;
        // a picture that was in before the first frame is there whole; a later one fades in over the tile's art
        const reveal = loadedAt[i] > 0 && loadedAt[i] <= startedAt ? 1 : revealOf(loadedAt[i], now, reduced);
        if (loadedAt[i] > 0 && reveal < 1) busy = true; // a picture that has just gone up is still fading in
        const r = Math.round(reveal * 255);
        if (hover[i] > 0) live.push([i, hover[i]]);
        const b = Math.round(ring[i] * 255);
        const row = Math.floor(i / cols);
        const pose = started
          ? arrival(Math.min(i % cols, cols - 1) + (row === rows - 1 ? lastShift : 0), row, cols, rows, t, reduced)
          : { scale: ARRIVAL.scaleFrom, alpha: 0 };
        if (started && pose.alpha < 1) busy = true;
        const g = Math.round(pose.alpha * 255);
        const a = Math.round(((pose.scale - ARRIVAL.scaleFrom) / (1 - ARRIVAL.scaleFrom)) * 255);
        if (data[i * 4] !== r || data[i * 4 + 1] !== g || data[i * 4 + 2] !== b || data[i * 4 + 3] !== a) {
          data[i * 4] = r;
          data[i * 4 + 1] = g;
          data[i * 4 + 2] = b;
          data[i * 4 + 3] = a;
          changed = true;
        }
      }
      const picked = pickGrown(live, hoverIdx, GROWN_SLOTS);
      for (let k = 0; k < GROWN_SLOTS; k++) {
        grown[k * 2] = picked[k] ? picked[k][0] : -1;
        grown[k * 2 + 1] = picked[k] ? picked[k][1] : 0;
      }
      if (changed) texture.needsUpdate = true;
      return busy;
    },
    dispose: () => texture.dispose(),
  };
}
