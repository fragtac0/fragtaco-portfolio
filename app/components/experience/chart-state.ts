// What the engine holds for the chart layer and the frame (spec 9.6): the grid's points (which take the heights), where the
// page's words and the dock are (keep-out.ts), the frame's foot, and which overview-only labels are left out. The engine
// asks it to draw the grid under the trail and the frame on its own canvas, when the view changes. No DOM, no clock.
import { drawChart, makeChart, setChartHeights, type Chart } from "./chart-layer";
import { drawFrame, frameItems, itemsKept, itemsLeftOut } from "./frame-layer";
import type { HeightField } from "./heights";
import { NO_KEEP_OUT, frameFoot, type Box, type KeepOut } from "./keep-out";
import { SUMMIT_XY } from "./frame";
import { viewOf, type Cam, type Stage, type View } from "./view";
import type { XY } from "./card-slot";

export type ChartState = {
  /** The stage's size or the page's words moved: the foot is found again and the labels that would collide with the words, the dock or the overview's beads and trail (`avoid`: the beads and the trail's line) are chosen again. */
  refit(cam: Cam, stage: Stage, avoid: readonly Box[]): void;
  setKeepOut(keep: KeepOut, cam: Cam, stage: Stage, avoid: readonly Box[]): void;
  /** The heights are read: the grid's rows take the height under them. */
  setHeights(field: HeightField): void;
  /** The grid and the overview's marks on the (cleared) trail canvas, under the trail; `over` is the picture's opacity. The rings and the crosses keep out of the page's words. */
  under(c: CanvasRenderingContext2D, v: View, stage: Stage, over: number): void;
  /** The frame on its own canvas; `at` is the point the readout tells; `over` the overview-only items' strength. */
  frame(c: CanvasRenderingContext2D, v: View, stage: Stage, dpr: number, at: XY, over: number): void;
};

export function createChartState(): ChartState {
  const chart: Chart = makeChart();
  let keep: KeepOut = NO_KEEP_OUT;
  let foot = 0;
  /** The overview-only items kept at the overview's view; null until it is fitted (everything is kept then). */
  let kept: ReadonlySet<string> | null = null;

  function refit(cam: Cam, stage: Stage, avoid: readonly Box[]) {
    if (stage.w <= 0 || stage.h <= 0) return; // no size yet: the engine's first resize fits it
    foot = frameFoot(stage, keep);
    // decided once, at the overview's own view (k = 0), so no label pops in or out while the camera moves
    const items = frameItems(viewOf(cam, 0, 1, stage), stage, foot, SUMMIT_XY, SUMMIT_XY);

    kept = itemsKept(items, itemsLeftOut(items, keep, stage, avoid));
  }

  return {
    refit,
    setKeepOut(next, cam, stage, avoid) {
      keep = next;
      refit(cam, stage, avoid);
    },
    setHeights: (field) => setChartHeights(chart, field),
    under: (c, v, stage, over) => drawChart(c, v, chart, SUMMIT_XY, over, { stage, boxes: keep.words }),
    frame(c, v, stage, dpr, at, over) {
      const f = foot || stage.h;
      const items = frameItems(v, stage, f, SUMMIT_XY, at);

      drawFrame(c, items, kept ?? itemsKept(items, new Set()), stage, f, dpr, over);
    },
  };
}
