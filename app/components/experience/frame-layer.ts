// The frame of the chart (spec 9.6), on its own canvas above the darkening so it stays crisp in the corners: four corner
// marks, two small squares on the edges and a position readout (always there), and, only in the overview and fading with the
// picture, north, the ring labels, the degree labels and a 200 km scale bar. The numbers are preview 9's (map.js drawFrame);
// where things go is chart.ts. On a phone the frame's foot sits on top of the dock, and the overview's labels that would
// collide with the page's words, the dock or each other are left out (keep-out.ts), decided from the overview's own view so
// no label pops in or out while the camera moves. Drawn only when the view changes.
import { INK, RINGS_KM, latitudeLabels, longitudeLabels, readout, ringLabelAt, scaleBar, type ScaleBar } from "./chart";
import { leftOut, type Box, type KeepOut, type Wanted } from "./keep-out";
import { project, type Stage, type View } from "./view";

/** The chart's lettering: IBM Plex Mono at 10 px, which advances 6 px a character. */
export const FRAME_FONT = '500 10px "IBM Plex Mono", monospace';
export const GLYPH = 6;
/** The marks: how far the corner marks sit from the edge, their arm, and the edge squares' size. */
export const MARK = { inset: 10, arm: 12, square: 3 };
/** The strengths of the frame's inks (preview 9). */
export const INKS = { marks: 0.55, readout: 0.72, degrees: 0.42, ring: 0.45, north: 0.75, scale: 0.8 };
/** Where the readout and the readout's margin are: right-aligned 24 px in from the edge and 22 px above the foot. */
export const READOUT = { right: 24, above: 22 };

type Align = "left" | "right" | "center";
type Base = { id: string; box: Box; overview: boolean; always?: boolean };
export type TextItem = Base & { type: "text"; text: string; x: number; y: number; align: Align; ink: number };
export type NorthItem = Base & { type: "north"; x: number };
export type ScaleItem = Base & { type: "scale"; bar: ScaleBar };
/** A thing of the frame that can be left out: its text, or north, or the scale bar. */
export type Item = TextItem | NorthItem | ScaleItem;

/** The box a line of this lettering takes at (x, y) (y is the middle of the line). */
export function textBox(text: string, x: number, y: number, align: Align): Box {
  const w = text.length * GLYPH;
  const l = align === "left" ? x : align === "right" ? x - w : x - w / 2;

  return { l, t: y - 6, r: l + w, b: y + 6 };
}

const text = (id: string, label: string, x: number, y: number, align: Align, ink: number, overview: boolean, always = false): TextItem => ({
  id,
  type: "text",
  text: label,
  x,
  y,
  align,
  ink,
  overview,
  always,
  box: textBox(label, x, y, align),
});

/**
 * Every thing of the frame that can be left out, for the view `v`, in order of importance: the readout (never left out), the
 * scale bar, north, the ring labels, the latitude labels, the longitude labels. `foot` is the frame's bottom (the stage's, or
 * just above the dock); `at` is the point the readout tells (the summit, or the chosen milestone).
 */
export function frameItems(v: View, stage: Stage, foot: number, summit: readonly [number, number], at: readonly [number, number]): Item[] {
  const eff: Stage = { w: stage.w, h: foot };
  const items: Item[] = [text("readout", readout(at[0], at[1]), stage.w - READOUT.right, foot - READOUT.above, "right", INKS.readout, false, true)];
  const bar = scaleBar(v.S, eff);

  items.push({ id: "scale", type: "scale", bar, overview: true, box: { l: bar.x0 - 2, t: bar.y - 17, r: bar.x1 + 2, b: bar.y + 1 } });
  items.push({ id: "north", type: "north", x: stage.w / 2, overview: true, box: { l: stage.w / 2 - 4, t: 7, r: stage.w / 2 + 4, b: 29 } });
  for (const km of RINGS_KM) {
    const [qx, qy] = project(v, ...ringLabelAt([summit[0], summit[1]], km), 0);

    items.push(text(`ring-${km}`, `${km} km`, qx + 6, qy - 4, "left", INKS.ring, true));
  }
  for (const l of latitudeLabels(v, eff)) items.push(text(`lat-${l.text}`, l.text, l.x, l.y, "right", INKS.degrees, true));
  for (const l of longitudeLabels(v, eff)) items.push(text(`lon-${l.text}`, l.text, l.x, l.y, "left", INKS.degrees, true));

  return items;
}

/**
 * The ids of the overview-only items to leave out, decided at one view (the overview's): the ones that would collide with the
 * words, the dock, one of the boxes `avoid` (the beads and the trail's line) or an item before them, or run off the stage.
 */
export function itemsLeftOut(items: readonly Item[], keep: KeepOut, stage: Stage, avoid: readonly Box[]): Set<string> {
  const wanted: Wanted[] = items.map((i) => ({ id: i.id, box: i.box, always: i.always }));

  return leftOut(wanted, keep, { l: 0, t: 0, r: stage.w, b: stage.h }, avoid);
}

const ink = (a: number) => `rgba(${INK},${a})`;

/**
 * The frame on the cleared canvas. `over` is the overview-only items' strength (the picture's own opacity, 0 to 1); `gone`
 * holds the ids left out. Everything is drawn in CSS pixels (the context is set up for `dpr` here).
 */
export function drawFrame(c: CanvasRenderingContext2D, items: readonly Item[], gone: ReadonlySet<string>, stage: Stage, foot: number, dpr: number, over: number): void {
  const { inset, arm, square } = MARK;

  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, stage.w, stage.h);
  c.font = FRAME_FONT;
  c.textBaseline = "middle";

  // the marks that are always there: four corner marks, two small squares, and (below) the readout
  c.strokeStyle = ink(INKS.marks);
  c.lineWidth = 1.2;
  for (const [x, y, sx, sy] of [[inset, inset, 1, 1], [stage.w - inset, inset, -1, 1], [inset, foot - inset, 1, -1], [stage.w - inset, foot - inset, -1, -1]]) {
    c.beginPath();
    c.moveTo(x + arm * sx, y);
    c.lineTo(x, y);
    c.lineTo(x, y + arm * sy);
    c.stroke();
  }
  c.fillStyle = ink(INKS.marks);
  c.fillRect(inset - square / 2, foot / 2 - square / 2, square, square);
  c.fillRect(stage.w - inset - square / 2, foot / 2 - square / 2, square, square);

  for (const item of items) {
    if (gone.has(item.id) || (item.overview && over <= 0.01)) continue;

    const a = item.overview ? over : 1;

    if (item.type === "text") {
      c.fillStyle = ink(item.ink * a);
      c.textAlign = item.align;
      c.fillText(item.text, item.x, item.y);
    } else if (item.type === "north") {
      c.fillStyle = ink(INKS.north * a);
      c.textAlign = "center";
      c.fillText("N", item.x, 23);
      c.beginPath();
      c.moveTo(item.x, 7);
      c.lineTo(item.x + 3.5, 13);
      c.lineTo(item.x - 3.5, 13);
      c.closePath();
      c.fill();
    } else {
      const { bar } = item;

      c.strokeStyle = ink(INKS.scale * a);
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(bar.x0, bar.y);
      c.lineTo(bar.x1, bar.y);
      for (const x of bar.ticks) {
        c.moveTo(x, bar.y - 4);
        c.lineTo(x, bar.y);
      }
      c.stroke();
      c.fillStyle = ink(INKS.north * a);
      c.textAlign = "left";
      c.fillText(bar.zeroLabel.text, bar.zeroLabel.x, bar.zeroLabel.y);
      c.textAlign = "right";
      c.fillText(bar.endLabel.text, bar.endLabel.x, bar.endLabel.y);
    }
  }
}
