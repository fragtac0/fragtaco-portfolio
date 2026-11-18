import { describe, expect, it } from "vitest";
import { blockPlan, sizeOfPlan } from "./wall-block";
import { choiceLayout } from "./wall-choice";
import { hiddenCache } from "./wall-hidden";
import { layoutTiles } from "./wall-math";
import type { PoseChoice } from "./wall-pose";
import type { Tile } from "./wall-types";

const COUNT = 109;
const VW = 1440;
const VH = 900;

function setup(viewX: number) {
  const plan = blockPlan(COUNT, VW, VH);
  const list = layoutTiles({ viewX, viewY: 60, vw: VW, vh: VH, plan, count: COUNT }) as Tile[];
  const choice = (shift: { x: number; y: number }): PoseChoice => {
    const l = choiceLayout(VW, VH);
    return { key: "4,5", live: true, rect: l.rect, zone: l.zone, halfDiag: Math.hypot(VW / 2, VH / 2), shift };
  };
  return { plan, size: sizeOfPlan(plan), list, choice };
}

describe("hiddenCache", () => {
  it("gives the same set while the camera travels (the view and the shift move together), and a new one when a resting place changes", () => {
    const hidden = hiddenCache();
    const a = setup(300);
    const first = hidden(a.list, a.choice({ x: 120, y: 0 }), a.size, false);
    expect(first.size).toBeGreaterThan(0);
    // the camera has moved 37 px: every tile is 37 px further left, and the shift (the view less its end) is 37 px more, so the resting places are as they were
    const b = setup(337);
    const again = hidden(b.list, b.choice({ x: 157, y: 0 }), b.size, false);
    expect(again).toBe(first);
    // a different resting place (the shift no longer matches the move) is worked out again
    const moved = hidden(b.list, b.choice({ x: 60, y: 0 }), b.size, false);
    expect(moved).not.toBe(first);
    // and so is a different mode
    expect(hidden(b.list, b.choice({ x: 60, y: 0 }), b.size, true)).not.toBe(moved);
  });
});
