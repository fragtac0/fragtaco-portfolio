/**
 * The pictures that give the front its soft, slightly wandering edge (spec 5.1: "soft and slightly irregular", as the
 * painting warps its front with noise), as plain pixels. glass-run.ts turns them into pictures and glass.css
 * uses them as the new page's mask and as the line's background, stretched to follow the front.
 *
 * Geometry, shared with glass.css through `glassVars()`: the pictures are squares reaching `K = 1 + REACH * band`
 * fronts from the middle, so the nominal front is at `1 / K` of the half-size, exactly where the bend map (glass-texture.ts)
 * has it. The edge of the revealed region is the nominal front moved by `WARP` times a noise that depends on the angle,
 * and its soft edge is `band` of the travel each side, so the new page is fully visible once the front has passed the
 * farthest corner by about `band + WARP` (`TRAVEL` in glass-math.ts scales the front's path so that is at 0.95 of the time).
 *
 * The line is a thin, soft highlight on that edge with a faint warm fringe outside and a cream glow inside; its brightness
 * varies along the front, like a glint on glass, so it never reads as a ruled ring. Its width is a share of the front's
 * radius, so it is thin when the front is small.
 */
import { ACCENT, CREAM, channels } from "../../styles/tokens";
import { GLASS, REACH, WARP } from "./glass-math";
import { fbm } from "./glass-texture";

const K = 1 + REACH * GLASS.band;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (x: number, centre: number, sigma: number) => Math.exp(-(((x - centre) / sigma) ** 2) * 0.5);

/** `n` values from -1 to 1 of smooth noise round a circle (so the end meets the start). */
function lut(n: number, freq: number, seed: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const v = fbm(Math.cos(t * 2 * Math.PI) * freq + seed, Math.sin(t * 2 * Math.PI) * freq + seed * 0.7);
    out[i] = Math.max(-1, Math.min(1, (v - 0.5) * 3));
  }
  return out;
}

const sample = (table: Float32Array, t: number) => table[Math.min(table.length - 1, Math.max(0, Math.floor(t * table.length)))];

interface Edge {
  /** The edge's offset from the nominal front, in fronts, at this angle. */
  offset: Float32Array;
  /** 0 to 1: how bright the line is here. */
  glint: Float32Array;
}
function edge(): Edge {
  const n = 720;
  const wander = lut(n, 1.7, 3.1);
  const glints = lut(n, 1.5, 9.7);
  return { offset: wander.map((v) => v * WARP), glint: glints.map((v) => 0.4 + 0.6 * smooth(-0.4, 0.5, v)) };
}

const BAND = GLASS.band;
/** One pixel of the line: its distance from the edge `x` (in fronts), the glint there and the core's width. */
function lineAt(x: number, glint: number, core: number, out: Uint8ClampedArray, i: number) {
  const ac = 0.7 * glint * bump(x, 0, core);
  const aw = 0.12 * (0.5 + 0.5 * glint) * bump(x, 3.2 * core, 2 * core);
  const ag = 0.12 * glint * bump(x, -2.4 * core, 3.4 * core);
  const a = 1 - (1 - ac) * (1 - aw) * (1 - ag);
  if (a < 0.002) return;
  const cream = channels(CREAM);
  const warm = channels(ACCENT);
  // weights of each piece in the pixel's colour
  const wc = ac + ag * (1 - ac);
  const ww = aw * (1 - ac) * (1 - ag);
  const sum = wc + ww || 1;
  for (let c = 0; c < 3; c++) out[i + c] = (cream[c] * wc + warm[c] * ww) / sum;
  out[i + 3] = a * 255;
}

/** The new page's mask for a radial front: opaque inside the front's wandering, soft edge, clear outside. `n` pixels square. */
export function ringMaskPixels(n: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(n * n * 4);
  const { offset } = edge();
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = ((x + 0.5) / n) * 2 - 1;
      const dy = ((y + 0.5) / n) * 2 - 1;
      const rho = Math.hypot(dx, dy) * K;
      const angle = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1;
      const e = 1 + sample(offset, angle);
      const i = (y * n + x) * 4;
      out[i + 3] = 255 * (1 - smooth(e - BAND, e + BAND, rho));
    }
  }
  return out;
}

/** The line for a radial front. `n` pixels square. */
export function ringLinePixels(n: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(n * n * 4);
  const { offset, glint } = edge();
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = ((x + 0.5) / n) * 2 - 1;
      const dy = ((y + 0.5) / n) * 2 - 1;
      const rho = Math.hypot(dx, dy) * K;
      if (rho > 1 + 3 * BAND) continue;
      const angle = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1;
      lineAt(rho - (1 + sample(offset, angle)), sample(glint, angle), 0.006, out, (y * n + x) * 4);
    }
  }
  return out;
}
