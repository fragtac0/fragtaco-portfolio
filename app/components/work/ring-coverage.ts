// How much of the screen the rings' video tiles cover (R54.2). Pure: no DOM, safe on the server.
import type { RingPlan } from "./ring-math";

/** Steps one slot of a ring is sampled at (the pattern repeats each slot, so this spans a whole turn). */
export const COVERAGE_STEPS = 24;

/**
 * The share of a `vw` by `vh` screen under video tiles (the stack ring's icons are not counted), counting only the part of
 * each tile that is on the screen. Every tile counts in full, including one that passes under the dock (R56.4: the dock's
 * glass shows it blurred, there is no mask). Averaged over a turn of every ring: the pattern repeats each slot, so a slot
 * sampled at 24 steps is the whole turn. Tiles are upright and never overlap (the rings' clearance rule), so their areas add up.
 * The rings are centred on the screen. 0 for a screen of no size or a plan with no video rings.
 */
export function coverage(plan: Pick<RingPlan, "rings">, vw: number, vh: number): number {
  if (!(vw > 0) || !(vh > 0)) return 0;
  let area = 0;
  for (const ring of plan.rings) {
    if (ring.kind === "stack" || !(ring.count > 0)) continue;
    const { w, h } = ring.size;
    let ringArea = 0;
    for (let step = 0; step < COVERAGE_STEPS; step++) {
      for (let i = 0; i < ring.count; i++) {
        const a = ((step / COVERAGE_STEPS + i) / ring.count) * 2 * Math.PI;
        const cx = vw / 2 + ring.radius * Math.cos(a);
        const cy = vh / 2 + ring.radius * Math.sin(a);
        const x0 = Math.max(cx - w / 2, 0);
        const x1 = Math.min(cx + w / 2, vw);
        const y0 = Math.max(cy - h / 2, 0);
        const y1 = Math.min(cy + h / 2, vh);
        if (!(x1 > x0) || !(y1 > y0)) continue;
        ringArea += (x1 - x0) * (y1 - y0);
      }
    }
    area += ringArea / COVERAGE_STEPS;
  }
  return area / (vw * vh);
}
