import type { EmblemId } from "./spine-series";

/**
 * The series' emblems: small drawings on a 24 by 24 grid, one per kind of book, as canvas paths
 * (`Path2D` takes an SVG path string). Each is drawn in the foil ink with a 1.6 unit round stroke
 * unless a part says otherwise. Client only when drawn (`Path2D` and a 2D context); the data is plain.
 */

type Part = {
  d: string;
  /** Filled as well as stroked (a dot), or only filled (`stroke: false`). */
  fill?: boolean;
  stroke?: boolean;
};

export type Emblem = { parts: Part[]; /** Letters set in the foil, on the same grid. */ text?: { s: string; x: number; y: number; font: string } };

export const GRID = 24;
export const EMBLEM_STROKE = 1.6;

/** A circle as a path (two arcs). */
const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
/** A rectangle as a path. */
const rect = (x: number, y: number, w: number, h: number): string => `M${x} ${y}h${w}v${h}h${-w}z`;

export const EMBLEMS: Record<Exclude<EmblemId, "none">, Emblem> = {
  blink: { parts: [{ d: "M3 10c3 4 6 5.5 9 5.5S18 14 21 10" }, { d: "M6 14.5l-1.4 2.6M12 15.8V19M18 14.5l1.4 2.6" }] },
  hourglass: { parts: [{ d: "M6 3h12M6 21h12M7.5 3c0 7 9 6 9 18M16.5 3c0 7-9 6-9 18" }] },
  film: {
    parts: [
      { d: "M5.5 3h13A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3z" },
      { d: rect(8, 7.5, 8, 9) },
      { d: "M6 6v.1M6 10v.1M6 14v.1M6 18v.1M18 6v.1M18 10v.1M18 14v.1M18 18v.1" },
    ],
  },
  splice: { parts: [{ d: "M2.5 8h8.5l-3 8h-5.5zM13.5 8h8v8h-11z" }] },
  arc: {
    parts: [
      { d: "M3 19C6 4 18 4 21 19" },
      { d: circle(3, 19, 1.2), fill: true },
      { d: circle(12, 7.8, 1.2), fill: true },
      { d: circle(21, 19, 1.2), fill: true },
    ],
  },
  cat: { parts: [{ d: "M5 20V6l4.5 4.5h5L19 6v14" }, { d: "M9.5 15v.1M14.5 15v.1" }] },
  dot: { parts: [{ d: circle(12, 12, 9.2) }, { d: circle(12, 12, 1.7), fill: true }] },
  cut: { parts: [{ d: "M4 4h10.5L20 9.5V20H4z" }, { d: "M14.5 4v5.5H20" }] },
  share: { parts: [{ d: "M10 5H5v14h14v-5" }, { d: "M12 12l8-8M14.5 4H20v5.5" }] },
  eye: {
    parts: [
      { d: "M2 12c3-5 6.2-7 10-7s7 2 10 7c-3 5-6.2 7-10 7s-7-2-10-7z" },
      { d: circle(12, 12, 3) },
    ],
  },
  panels: { parts: [{ d: rect(3, 3, 8, 10) }, { d: rect(13, 3, 8, 6) }, { d: rect(13, 11, 8, 10) }, { d: rect(3, 15, 8, 6) }] },
  aa: { parts: [], text: { s: "Aa", x: 12, y: 18, font: '600 17px "Bodoni Moda", serif' } },
  grid: {
    parts: [
      {
        d: "M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z",
        fill: true,
        stroke: false,
      },
    ],
  },
  handle: { parts: [{ d: circle(8, 12, 5) }, { d: "M13 12h8v4" }] },
};

const PATHS = new Map<string, Path2D>();
const pathOf = (d: string): Path2D => {
  let p = PATHS.get(d);
  if (!p) {
    p = new Path2D(d);
    PATHS.set(d, p);
  }
  return p;
};

/**
 * Draws `id` with its top left corner at (`x`, `y`) and `size` units across, in `ink`. The context's
 * state is restored; a `none` emblem draws nothing.
 */
export function drawEmblem(
  ctx: CanvasRenderingContext2D,
  id: EmblemId,
  x: number,
  y: number,
  size: number,
  ink: string,
): void {
  if (id === "none") return;
  const e = EMBLEMS[id];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / GRID, size / GRID);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = EMBLEM_STROKE;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const part of e.parts) {
    const p = pathOf(part.d);
    if (part.fill) ctx.fill(p);
    if (part.stroke !== false) ctx.stroke(p);
  }
  if (e.text) {
    ctx.font = e.text.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(e.text.s, e.text.x, e.text.y);
  }
  ctx.restore();
}
