import { mix, toHex } from "./spine-styles";

/**
 * The two main colours of a cover, for its spine. `pickColours` is pure (it reads RGBA bytes);
 * `coloursOfImage` shrinks a decoded image onto a small canvas and reads that (client only).
 */

export type CoverColours = { dominant: string; secondary: string };

/** A bucket spans 32 levels of each channel (512 buckets): close shades count together. */
const BUCKET_BITS = 5;
/** Two colours closer than this (Euclidean, 0..441) are one colour for the secondary pick. */
const APART = 90;

/**
 * Dominant and secondary colour of RGBA pixels: pixels fall into colour buckets, each counted by
 * area with a lift for saturated ones (a cover's white border or page should not outvote its art);
 * the biggest bucket's mean colour is the dominant, the next bucket whose mean is clearly apart
 * from it the secondary. Without a second colour (a plain cover) the secondary is the dominant
 * pulled a quarter of the way to white or black.
 */
export function pickColours(rgba: ArrayLike<number>): CoverColours | null {
  const buckets = new Map<number, { w: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const hi = Math.max(r, g, b);
    const sat = hi === 0 ? 0 : (hi - Math.min(r, g, b)) / hi;
    const w = 0.5 + sat;
    const k =
      ((r >> (8 - BUCKET_BITS)) << (2 * BUCKET_BITS)) |
      ((g >> (8 - BUCKET_BITS)) << BUCKET_BITS) |
      (b >> (8 - BUCKET_BITS));
    const e = buckets.get(k) ?? { w: 0, r: 0, g: 0, b: 0 };
    e.w += w;
    e.r += r * w;
    e.g += g * w;
    e.b += b * w;
    buckets.set(k, e);
  }
  const ranked = [...buckets.values()]
    .sort((a, b) => b.w - a.w)
    .map((e) => ({ w: e.w, rgb: [e.r / e.w, e.g / e.w, e.b / e.w] as [number, number, number] }));
  if (!ranked.length) return null;
  const dominant = ranked[0].rgb;
  const far = ranked.find((c) => Math.hypot(c.rgb[0] - dominant[0], c.rgb[1] - dominant[1], c.rgb[2] - dominant[2]) >= APART);
  const dHex = toHex(dominant);
  if (far) return { dominant: dHex, secondary: toHex(far.rgb) };
  const lightish = dominant[0] * 0.3 + dominant[1] * 0.59 + dominant[2] * 0.11 > 128;
  return { dominant: dHex, secondary: mix(dHex, lightish ? "#000000" : "#ffffff", 0.25) };
}

const SAMPLE_W = 32;
const SAMPLE_H = 48;

/** The two main colours of a decoded cover, or null when it cannot be read (a cross origin canvas, an empty image). */
export function coloursOfImage(img: HTMLImageElement): CoverColours | null {
  try {
    const c = document.createElement("canvas");
    c.width = SAMPLE_W;
    c.height = SAMPLE_H;
    const x = c.getContext("2d", { willReadFrequently: true });
    if (!x) return null;
    x.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H);
    return pickColours(x.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data);
  } catch {
    return null;
  }
}
