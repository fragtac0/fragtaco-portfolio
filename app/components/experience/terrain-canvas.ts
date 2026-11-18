// The night map's ground (spec 9.2): the height picture read into a field, its levels found once, and each frame
// of the change drawn on one 2D canvas, low level to high, each filled and then stroked. Vectors at the screen's
// resolution, so the lines stay sharp. The drawing takes the view; it only runs while the night is on and the
// view has changed (the engine decides). The loading is the only part that touches the DOM.
import { levelsOf, type Level } from "./contours";
import { GRID_H, GRID_W, fieldSteps, liftOf, type HeightField } from "./heights";
import type { Stage, View } from "./view";
import { runInTurns } from "../../utils/turns";

/** What loading the heights gives: the field (for the trail's heights) and the levels (for the drawing). */
export type Terrain = { field: HeightField; levels: Level[] };

/** The red channel of an RGBA pixel array: one grey level for each pixel (the height picture is grey). */
export function redChannel(rgba: ArrayLike<number>): Uint8Array {
  const grey = new Uint8Array(Math.floor(rgba.length / 4));

  for (let i = 0; i < grey.length; i++) grey[i] = rgba[i * 4];

  return grey;
}

/**
 * Draw the levels of `levels` as seen from `v` on a 2D canvas context set up for `dpr`: the canvas is cleared, then
 * each level (lowest first) is filled with its ground colour (even-odd, so holes stay open) and stroked in its line
 * colour. A point's height is its level's, lifted by the rise; the maths is `project`'s, written out for speed
 * (a frame draws over a hundred thousand points).
 */
export function drawTerrain(c: CanvasRenderingContext2D, levels: readonly Level[], v: View, stage: Stage, dpr: number): void {
  const { S, cy, sy, cp, sp, CX, CY, DIST, tx, ty, tz, rise } = v;
  const lim = DIST * 0.8;

  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, stage.w, stage.h);
  c.lineJoin = "round";
  for (let li = 0; li < levels.length; li++) {
    const level = levels[li];
    const z = liftOf(level.n, rise) - tz;
    const zs = z * sp;
    const zc = z * cp;

    c.beginPath();
    for (let r = 0; r < level.rings.length; r++) {
      const ring = level.rings[r];

      for (let i = 0; i < ring.length; i += 2) {
        const px = ring[i] - tx;
        const py = ring[i + 1] - ty;
        const xr = px * cy - py * sy;
        const yr = px * sy + py * cy;
        let dep = yr * sp + zc;

        if (dep > lim) dep = lim;

        const f = DIST / (DIST - dep);
        const x = CX + S * f * xr;
        const y = CY + S * f * (yr * cp - zs);

        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.closePath();
    }
    c.fillStyle = level.fill;
    c.fill("evenodd");
    c.strokeStyle = level.stroke;
    c.lineWidth = level.width;
    c.stroke();
  }
}

/**
 * Load the height picture. Rejects if it does not load or the canvas cannot be read. Reading the picture is one short step; the field (about 60 ms of
 * work) and the levels (over 150) are made in many small steps, a few milliseconds of them at each idle moment (utils/turns.ts), so no frame of the
 * page is held for them: the page may start this while it is animating (My experience starts it while its words come in).
 */
export async function loadTerrain(url: string): Promise<Terrain> {
  const img = new Image();

  img.src = url;
  await img.decode();

  const canvas = document.createElement("canvas");

  canvas.width = GRID_W;
  canvas.height = GRID_H;

  const g = canvas.getContext("2d", { willReadFrequently: true });

  if (g === null) throw new Error("no 2d canvas");
  g.drawImage(img, 0, 0, GRID_W, GRID_H);

  const make = fieldSteps(redChannel(g.getImageData(0, 0, GRID_W, GRID_H).data), GRID_W, GRID_H);

  await runInTurns(make.steps);

  const field = make.field();
  const finder = levelsOf(field);
  const levels: Level[] = [];

  await runInTurns(Array.from({ length: finder.count }, (_, i) => () => void levels.push(finder.level(i))));

  return { field, levels };
}
