// Which tiles of the pyramid a view needs (spec 9.1, 9.6). Pure maths, no DOM.
//
// `public/mars/{z}/{x}_{y}.webp`: level z is a square of 2^z by 2^z tiles of `tile` px; the top level
// (`levels - 1`) is `size` px across, and each level below has half the pixels of the one above.
import type { Manifest } from "./geo";
import type { View } from "./view";

export type Tile = {
  z: number;
  x: number;
  y: number;
  /** The tile's top left corner on the screen, in CSS pixels. */
  left: number;
  top: number;
  /** The tile's side on the screen, in CSS pixels. */
  size: number;
};

type Pyramid = Pick<Manifest, "levels" | "size" | "tile">;

/**
 * The coarsest level that still has a picture pixel for every screen pixel (or the top level, when the
 * view is closer than that): level z shows `2^(levels - 1 - z)` top level pixels in each of its own, which
 * is `scale * 2^(levels - 1 - z)` screen pixels, so this picks the smallest z with that at most 1.
 */
export function levelFor(scale: number, m: Pyramid): number {
  const top = m.levels - 1;

  return Math.min(top, Math.max(0, Math.ceil(top + Math.log2(scale) - 1e-9)));
}

/** The address of a tile file below `public/mars/`. */
export const tilePath = (t: Pick<Tile, "z" | "x" | "y">) => `/mars/${t.z}/${t.x}_${t.y}.webp`;

/** The tiles that cover the screen (vw by vh) for the view, row by row, at the level `levelFor` gives. */
export function tilesFor(v: View, vw: number, vh: number, m: Pyramid): Tile[] {
  const z = levelFor(v.scale, m);
  const count = 2 ** z;
  const side = m.size / count; // a tile's side in top level pixels
  const size = side * v.scale; // and on the screen
  // The picture pixels at the screen's edges.
  const x0 = v.cx - vw / (2 * v.scale);
  const x1 = v.cx + vw / (2 * v.scale);
  const y0 = v.cy - vh / (2 * v.scale);
  const y1 = v.cy + vh / (2 * v.scale);
  const first = (a: number) => Math.min(count - 1, Math.max(0, Math.floor(a / side)));
  const last = (a: number) => Math.min(count - 1, Math.max(0, Math.ceil(a / side) - 1));
  const out: Tile[] = [];

  // Nothing of the picture on the screen: no tiles.
  if (x1 <= 0 || y1 <= 0 || x0 >= m.size || y0 >= m.size) return out;

  for (let y = first(y0); y <= last(y1); y++) {
    for (let x = first(x0); x <= last(x1); x++) {
      out.push({ z, x, y, left: (x * side - x0) * v.scale, top: (y * side - y0) * v.scale, size });
    }
  }

  return out;
}
