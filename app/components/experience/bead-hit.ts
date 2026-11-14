// Where a touch or a click on a bead's button lands when the buttons overlap (Ruling R108). On a small stage the beads are closer
// than a button is wide (44 px), so squares lie over one another and the one lower on the screen would take a tap on its
// neighbour's visible centre. Each bead's hit area is its own square cut by the line half way to every neighbour, so a point
// belongs to the bead whose centre is nearest (a point nearest to a neighbour whose square does not reach it belongs to nobody).
// A bead's own centre is always in its own area. The page sets it as a clip-path on the button's hit span; the button, its
// label and the keyboard are not touched.
import type { XY } from "./card-slot";

/** Half the width of a button (`--pill-h-touch` is 44 px). */
export const BEAD_HIT_HALF = 22;

/** The half plane of the points nearer to the origin than to `d` (p . d <= |d|^2 / 2), cut out of a polygon (Sutherland and Hodgman). */
function nearer(poly: readonly XY[], d: XY): XY[] {
  const limit = (d[0] * d[0] + d[1] * d[1]) / 2;
  const side = (p: XY) => p[0] * d[0] + p[1] * d[1] - limit; // <= 0 is inside
  const out: XY[] = [];

  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);

    if (sa <= 0) out.push(a);
    if (sa < 0 !== sb < 0 && sa !== sb) {
      const t = sa / (sa - sb);

      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  });

  return out;
}

/** The corners of bead `i`'s hit area, in pixels from the centre of its button. Beads at the same place (nothing to tell them apart by) do not cut each other. */
export function hitCorners(heads: readonly XY[], i: number, half: number = BEAD_HIT_HALF): XY[] {
  let poly: XY[] = [[-half, -half], [half, -half], [half, half], [-half, half]];

  heads.forEach((head, j) => {
    const d: XY = [head[0] - heads[i][0], head[1] - heads[i][1]];

    if (j === i || poly.length === 0 || (Math.abs(d[0]) < 0.01 && Math.abs(d[1]) < 0.01)) return;
    // too far to reach this square: its line is outside it
    if (Math.hypot(d[0], d[1]) / 2 >= half * Math.SQRT2) return;
    poly = nearer(poly, d);
  });

  return poly;
}

/** The same as a `clip-path` value for the hit span (its box is the button: the origin is its top left corner), or null where nothing cuts the square (no clip needed). */
export function hitClip(heads: readonly XY[], i: number, half: number = BEAD_HIT_HALF): string | null {
  const poly = hitCorners(heads, i, half);

  if (poly.length === 4 && poly.every((p) => Math.abs(Math.abs(p[0]) - half) < 1e-6 && Math.abs(Math.abs(p[1]) - half) < 1e-6)) return null;
  if (poly.length < 3) return "polygon(0 0)"; // nothing left (cannot happen to a bead's own centre, but never an error)

  return `polygon(${poly.map((p) => `${+(p[0] + half).toFixed(2)}px ${+(p[1] + half).toFixed(2)}px`).join(", ")})`;
}

/** Writes each bead's hit area as the custom property `--hit` on its button, only where it changed since `was` (which it updates); null removes it. */
export function writeHits(styles: readonly { setProperty(name: string, value: string): void; removeProperty(name: string): unknown }[], heads: readonly XY[], was: (string | null)[]): void {
  styles.forEach((style, i) => {
    const hit = hitClip(heads, i);

    if (hit === was[i]) return;
    was[i] = hit;
    if (hit === null) style.removeProperty("--hit");
    else style.setProperty("--hit", hit);
  });
}
