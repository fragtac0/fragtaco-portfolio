/**
 * The pictures that give the glass front its soft, wandering edge (follow-ups spec 4), as plain pixels. glass-run.ts turns them
 * into sheets of tiles (glass-field.ts explains the tiles) and glass.css uses them as the new page's mask and as the glow's
 * background, scaled and moved to follow the front.
 *
 * A mask tile is the new page's share (`newShare`, the preview's `1 - smoothstep(-1, 1, x)`) at each point of the field cut at the
 * tile's front radius. A line tile is what the preview adds on top of the pages there: the cream glow at the front (`glowAt`), a
 * fainter one at the outer rim, and the glass a touch darker than the pages (`shadeAt`), as one picture with its own alpha. There
 * is no thin line any more.
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
 * What the glow and the shade add at `x` half-bands from the front, as one colour and alpha: `[r, g, b, a]` with the colour from 0
 * to 255 and `a` from 0 to 1 (the shade is black under the glow, so a pixel with both is cream over black).
 */
export function lineColorAt(x: number): [number, number, number, number] {
  const glow = glowAt(x);
  const shade = shadeAt(x);
  const a = glow + shade * (1 - glow);
  if (a < 1e-4) return [0, 0, 0, 0];
  const k = glow / a;
  return [cream[0] * k, cream[1] * k, cream[2] * k, a];
}

/** The line tile for a front of radius `front`: the glow and the shade, as alpha over their colour. `n` pixels square. */
export function lineTilePixels(n: number, front: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(n * n * 4);
  eachTilePixel(n, front, (i, x) => {
    if (x < -3 || x > 3) return;
    const [r, g, b, a] = lineColorAt(x);
    if (a < 0.002) return;
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = Math.round(a * 255);
  }, 3);
  return out;
}

/** Where along the front's normal (in half-bands) the plain gradient that draws the glow while the front is small has its stops. */
const LINE_STOPS = [-2.4, -1.6, -1.1, -0.75, -0.5, -0.32, -0.2, -0.1, 0, 0.1, 0.2, 0.32, 0.5, 0.7, 0.85, 0.95, 1.1, 1.4, 1.9];

/**
 * The CSS `radial-gradient(...)` that draws the same glow and shade as a line tile round a circle at the front (for fronts smaller
 * than glass-field.ts's `HAND_OVER`, and until the tiles are ready). `front` and `band` are CSS lengths (a custom property each).
 */
export function lineGradient(origin: string, front: string, band: string): string {
  const stops = LINE_STOPS.map((x) => {
    const [r, g, b, a] = lineColorAt(x);
    return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${+a.toFixed(4)}) calc(${front} + ${x} * ${band})`;
  });
  return `radial-gradient(circle at ${origin}, ${stops.join(", ")})`;
}
