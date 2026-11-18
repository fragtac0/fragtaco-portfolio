/**
 * The pictures that give the glass front its soft, wandering edge (follow-ups spec 4), as plain pixels. glass-run.ts turns them
 * into sheets of tiles (glass-field.ts explains the tiles) and glass.css uses them as the new page's mask and as the glow's
 * background, scaled and moved to follow the front.
 *
 * A mask tile is the new page's share (`newShare`, the preview's `1 - smoothstep(-1, 1, x)`) at each point of the field cut at the
 * tile's front radius. What the preview adds on top of the pages there is two pictures: the cream glow at the front (`glowAt`, and a
 * fainter one at the outer rim), which is added to the pages, and the glass a touch darker than the pages (`shadeAt`), which
 * multiplies them (and the glow). There is no thin line any more.
 */
import { CREAM, channels } from "../../styles/tokens";
import { eachTilePixel, newShare } from "./glass-field";
import { glowAt, shadeAt } from "./glass-math";

/** The mask tile for a front of radius `front`: black with the new page's share as alpha. `n` pixels square. */
export function maskTilePixels(n: number, front: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(n * n * 4);
  eachTilePixel(n, front, (i, x) => {
    out[i + 3] = Math.round(255 * newShare(x));
  });
  return out;
}

const cream = channels(CREAM);

/**
 * The glow at `x` half-bands from the front as one colour and alpha: `[r, g, b, a]` with the colour from 0 to 255 and `a` from 0 to
 * 1 (`glowAt`). It is added to the pages (a layer that blends with `plus-lighter`, so on a bright page it still brightens, as in
 * the preview's `page + cream * glow`).
 */
export function glowColorAt(x: number): [number, number, number, number] {
  const a = glowAt(x);
  return a < 1e-4 ? [0, 0, 0, 0] : [cream[0], cream[1], cream[2], a];
}

/** The glow tile for a front of radius `front`: cream, with the glow's strength as alpha. `n` pixels square. */
export function glowTilePixels(n: number, front: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(n * n * 4);
  eachTilePixel(
    n,
    front,
    (i, x) => {
      const [r, g, b, a] = glowColorAt(x);
      if (a < 0.002) return;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = Math.round(a * 255);
    },
    3,
  );
  return out;
}

/**
 * The shade tile for a front of radius `front`: black with `shadeAt` as alpha, the glass a touch darker than the pages. It is drawn
 * over the glow with the normal blend, which multiplies both by `1 - shade`, as the preview's `(page + cream * glow) * (1 - shade)`.
 */
export function shadeTilePixels(n: number, front: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(n * n * 4);
  eachTilePixel(
    n,
    front,
    (i, x) => {
      out[i + 3] = Math.round(255 * shadeAt(x));
    },
    3,
  );
  return out;
}

/** Where along the front's normal (in half-bands) the plain gradients that draw the glow and the shade while the front is small have their stops. */
const STOPS = [-2.4, -1.6, -1.1, -0.75, -0.5, -0.32, -0.2, -0.1, 0, 0.1, 0.2, 0.32, 0.5, 0.7, 0.85, 0.95, 1.1, 1.4, 1.9];

const gradient = (origin: string, front: string, band: string, color: (x: number) => string) =>
  `radial-gradient(circle at ${origin}, ${STOPS.map((x) => `${color(x)} calc(${front} + ${x} * ${band})`).join(", ")})`;

/**
 * The CSS `radial-gradient(...)` that draws the glow round a circle at the front (for fronts smaller than glass-field.ts's
 * `HAND_OVER`, and until the tiles are ready). `front` and `band` are CSS lengths (a custom property each).
 */
export function glowGradient(origin: string, front: string, band: string): string {
  return gradient(origin, front, band, (x) => {
    const [r, g, b, a] = glowColorAt(x);
    return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${+a.toFixed(4)})`;
  });
}

/** The same for the shade: black with `shadeAt` as alpha. */
export function shadeGradient(origin: string, front: string, band: string): string {
  return gradient(origin, front, band, (x) => `rgb(0 0 0 / ${+shadeAt(x).toFixed(4)})`);
}
