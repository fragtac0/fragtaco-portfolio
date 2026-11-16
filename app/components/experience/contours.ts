// The night map's lines (spec 9.2): a level every 3 grey steps of the height field, as rings in map units, with a
// fill, a stroke colour and a width for each (cream low, warming to orange at the top, every fifth line stronger).
// d3-contour (ISC) finds the rings; the colours are mixed here so that nothing else of d3 is needed.
import { contours } from "d3-contour";
import { HEIGHT_FRAME } from "./frame";
import { normalise, type HeightField } from "./heights";
import { clamp, lerp, range } from "./map-math";

/** One line of the map: its height n (0 plain, 1 summit; a little below 0 under the plain), colours, width and rings (x, y pairs in map units). */
export type Level = { n: number; fill: string; stroke: string; width: number; rings: Float32Array[] };

/** Grey steps between two levels, and between the strong lines (every fifth). */
export const LEVEL_STEP = 3;
export const MAJOR_EVERY = 5;

type Rgba = [number, number, number, number];

const CREAM_LOW: Rgba = [253, 244, 222, 0.3];
const CREAM_HIGH: Rgba = [255, 214, 170, 0.62];
const FIRE_LOW: Rgba = [255, 190, 130, 0.7];
const FIRE_HIGH: Rgba = [255, 118, 40, 1];
const FLOOR_LOW: Rgba = [15, 14, 13, 1];
const FLOOR_HIGH: Rgba = [33, 22, 15, 1];

function mix(a: Rgba, b: Rgba, t: number): string {
  const [r, g, bl] = [0, 1, 2].map((i) => Math.round(lerp(a[i], b[i], t)));
  const alpha = Math.round(lerp(a[3], b[3], t) * 1000) / 1000;

  return alpha < 1 ? `rgba(${r}, ${g}, ${bl}, ${alpha})` : `rgb(${r}, ${g}, ${bl})`;
}

/** The stroke of a level: faint ink on the plain, cream climbing the slope, fire near the top. */
export function strokeOf(n: number, major: boolean): string {
  if (n < 0.05) return `rgba(253,252,230,${major ? 0.2 : 0.11})`;

  return n < 0.45 ? mix(CREAM_LOW, CREAM_HIGH, n / 0.45) : mix(FIRE_LOW, FIRE_HIGH, (n - 0.45) / 0.55);
}

/** The ground under a level of height n: a deep brown, slightly warmer higher. */
export const fillOf = (n: number) => mix(FLOOR_LOW, FLOOR_HIGH, clamp(n));

/** The grey values at which lines are drawn. */
export function thresholdsOf(field: Pick<HeightField, "lo" | "hi">): number[] {
  return range(Math.ceil(field.lo) + 0.5, field.hi, LEVEL_STEP);
}

/**
 * The levels of the field one at a time (`level(i)` for i below `count`), so a caller can spread the work (each is about 2 ms; all of them are over
 * 150): the same levels `buildLevels` gives. d3-contour's `contour(values, value)` is what its `thresholds(...)(values)` calls for each value.
 */
export function levelsOf(field: HeightField): { count: number; level: (i: number) => Level } {
  const { w, h } = field;
  const { x0, y0, w: fw, h: fh } = HEIGHT_FRAME;
  const values = thresholdsOf(field);
  const finder = contours().size([w, h]).smooth(true);

  return {
    count: values.length,
    level: (i) => {
      const ct = finder.contour(field.data as unknown as number[], values[i]); // @types/d3-contour asks for number[]; it only indexes, so the Float32Array is fine
      const n = normalise(field, ct.value);
      const major = i % MAJOR_EVERY === 0;

      return {
        n: Math.max(n, -0.05),
        fill: fillOf(n),
        stroke: strokeOf(n, major),
        width: major ? 1.4 : 0.8,
        rings: ct.coordinates.flatMap((poly) =>
          poly.map((ring) => {
            const a = new Float32Array(ring.length * 2);

            ring.forEach((p, k) => {
              a[k * 2] = (p[0] * fw) / w + x0;
              a[k * 2 + 1] = (p[1] * fh) / h + y0;
            });

            return a;
          }),
        ),
      };
    },
  };
}

/** Every level of the field, lowest first, ready to draw one over the next. */
export function buildLevels(field: HeightField): Level[] {
  const { count, level } = levelsOf(field);

  return Array.from({ length: count }, (_, i) => level(i));
}
