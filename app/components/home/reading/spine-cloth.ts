/**
 * The cloth of a spine: its grain (a seeded tile, fine along the spine's length) and the soft shading
 * that rounds it. Client only for `clothGrain` and `shade` (a canvas); `grainAlphas` is pure and tested.
 */

const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Seeded, so a spine is the same every time it is painted. */
function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The tile of cloth grain: fine along the spine's length (fibres), a little coarser across. */
export const GRAIN_TILE = 64;
export function grainAlphas(): Uint8ClampedArray {
  const rand = mulberry(4);
  const n = GRAIN_TILE;
  const cols = Array.from({ length: n }, () => rand());
  const cells = Array.from({ length: n * n }, () => rand());
  const out = new Uint8ClampedArray(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // vertical fibres: a column's own value runs down the tile, stirred by a little per pixel noise and a slow wave
      const v = 0.3 * cols[x] + 0.5 * cells[y * n + x] + 0.2 * cells[((y >> 2) * 7 + x * 3) % (n * n)];
      out[y * n + x] = clampN(Math.round(255 * (0.78 - 1.1 * v) * 0.36), 0, 255);
    }
  }
  return out;
}

let GRAIN: HTMLCanvasElement | null = null;
export function clothGrain(): HTMLCanvasElement | null {
  if (GRAIN) return GRAIN;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = GRAIN_TILE;
  const x = c.getContext("2d");
  if (!x || typeof x.createImageData !== "function") return null;
  const a = grainAlphas();
  const id = x.createImageData(GRAIN_TILE, GRAIN_TILE);
  for (let i = 0; i < a.length; i++) id.data[i * 4 + 3] = a[i]; // black, with the weave as its alpha
  x.putImageData(id, 0, 0);
  GRAIN = c;
  return c;
}

/** The soft rounding of a cloth spine: light from the left, shade to the right and at the foot. */
export function shade(ctx: CanvasRenderingContext2D, vw: number, vh: number): void {
  const side = ctx.createLinearGradient(0, 0, vw, 0);
  side.addColorStop(0, "rgba(255,255,255,.10)");
  side.addColorStop(0.22, "rgba(255,255,255,0)");
  side.addColorStop(0.7, "rgba(0,0,0,0)");
  side.addColorStop(1, "rgba(0,0,0,.22)");
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, vw, vh);
  const left = ctx.createLinearGradient(0, 0, 6, 0);
  left.addColorStop(0, "rgba(255,255,255,.22)");
  left.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, 6, vh);
  const right = ctx.createLinearGradient(vw, 0, vw - 9, 0);
  right.addColorStop(0, "rgba(0,0,0,.5)");
  right.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = right;
  ctx.fillRect(vw - 9, 0, 9, vh);
  const foot = ctx.createLinearGradient(0, vh, 0, vh - 10);
  foot.addColorStop(0, "rgba(0,0,0,.45)");
  foot.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = foot;
  ctx.fillRect(0, vh - 10, vw, 10);
}

