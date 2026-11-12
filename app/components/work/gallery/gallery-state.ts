/**
 * What changes tile by tile, as a count by 1 RGBA8 texture the shader reads: R the picture's reveal
 * (a flat `--surface-1` until the picture is in, then a 350 ms fade), G the hover growth, B the focus
 * ring. The values ease on the CPU (exponential, frame rate independent) and the texture is re-sent only
 * on a frame where a byte changed. With reduced motion everything snaps.
 *
 * Original work for this site; the shader that reads it is ported from the ObsidianUI Art Gallery (MIT,
 * see gallery-shaders.ts).
 */

import type * as THREE from "three";
import { approach } from "./gallery-math";

const REVEAL_MS = 350;
const HOVER_RATE = 14; // per second: about 70 ms to settle
const RING_RATE = 20;

export type TileState = {
  texture: THREE.DataTexture;
  setHover(i: number | null): void;
  setFocus(i: number | null): void;
  /** Moves the values on by `dt` and re-sends the texture if a byte changed. True while anything is still easing. */
  step(dt: number, now: number, loadedAt: Float64Array): boolean;
  dispose(): void;
};

export function createTileState(T: typeof THREE, count: number, reduced: boolean): TileState {
  const data = new Uint8Array(count * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const texture = new T.DataTexture(data, count, 1);
  texture.magFilter = T.NearestFilter;
  texture.minFilter = T.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const hover = new Float32Array(count);
  const ring = new Float32Array(count);
  let hoverIdx: number | null = null;
  let focusIdx: number | null = null;

  return {
    texture,
    setHover: (i) => (hoverIdx = i),
    setFocus: (i) => (focusIdx = i),
    step(dt, now, loadedAt) {
      let busy = false;
      let changed = false;
      for (let i = 0; i < count; i++) {
        hover[i] = reduced ? (i === hoverIdx ? 1 : 0) : approach(hover[i], i === hoverIdx ? 1 : 0, dt, HOVER_RATE);
        ring[i] = reduced ? (i === focusIdx ? 1 : 0) : approach(ring[i], i === focusIdx ? 1 : 0, dt, RING_RATE);
        if (hover[i] !== (i === hoverIdx ? 1 : 0) || ring[i] !== (i === focusIdx ? 1 : 0)) busy = true;
        let reveal = 0;
        if (loadedAt[i] > 0) reveal = reduced ? 1 : Math.min(1, (now - loadedAt[i]) / REVEAL_MS);
        if (reveal > 0 && reveal < 1) busy = true;
        const r = Math.round(reveal * 255);
        const h = Math.round(hover[i] * 255);
        const b = Math.round(ring[i] * 255);
        if (data[i * 4] !== r || data[i * 4 + 1] !== h || data[i * 4 + 2] !== b) {
          data[i * 4] = r;
          data[i * 4 + 1] = h;
          data[i * 4 + 2] = b;
          changed = true;
        }
      }
      if (changed) texture.needsUpdate = true;
      return busy;
    },
    dispose: () => texture.dispose(),
  };
}
