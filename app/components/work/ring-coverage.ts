// How much of the screen the rings' video tiles cover (R54.2). Pure: no DOM, safe on the server.
import type { RingPlan } from "./ring-math";

/** Steps one turn is sampled at. */
export const COVERAGE_STEPS = 24;

/** The length of [a0, a1] that lies inside [0, limit]. */
function inside(a0: number, a1: number, limit: number): number {
  return Math.max(0, Math.min(a1, limit) - Math.max(a0, 0));
}

/**
 * The share of a `vw` by `vh` screen under video tiles (the stack ring's icons are not counted), averaged over one
 * turn of every ring sampled at 24 steps, counting only the part of each tile that is on the screen. Tiles are upright
 * and never overlap (that is what the rings' clearance rule keeps), so their areas add up. The ring is centred on
 * the screen. 0 for a screen of no size or a plan with no video rings.
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
        ringArea += inside(cx - w / 2, cx + w / 2, vw) * inside(cy - h / 2, cy + h / 2, vh);
      }
    }
    area += ringArea / COVERAGE_STEPS;
  }
  return area / (vw * vh);
}
