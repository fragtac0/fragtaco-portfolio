import { describe, expect, it } from "vitest";
import { PLANE, tileSize } from "./wall-math";
import { createPose, type PoseInput } from "./wall-pose";
import type { Tile } from "./wall-types";

const videos = [
  { channel: "A" },
  { channel: "B" },
  { channel: "A" },
  { channel: "A" },
];
const size = tileSize(1440);

const tile = (key: string, idx: number, plane: "near" | "far"): Tile => {
  const [cx, cy] = key.split(",").map(Number);
  return {
    key,
    idx,
    x: cx * size.pitchX,
    y: cy * size.pitchY,
    plane,
    f: 0,
    e: 0,
    cx: 0,
    cy: 0,
    w: 0,
    h: 0,
    rad: 0,
    dim: 1,
    bias: 0,
  };
};

const input = (over: Partial<PoseInput>): PoseInput => ({
  dt: 0.016,
  size,
  hoverKey: null,
  lens: 0,
  focus: { x: 0, y: 0 },
  focusIdx: null,
  reduced: false,
  ...over,
});

describe("createPose", () => {
  it("sizes a far tile by its plane about its own centre", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0, "near"), tile("1,0", 1, "far")];
    pose.apply(list, input({}));
    const near = list.find((t) => t.key === "0,0") as Tile;
    const far = list.find((t) => t.key === "1,0") as Tile;
    expect(near.w).toBeCloseTo(size.cw);
    expect(far.w).toBeCloseTo(size.cw * PLANE.far.scale);
    expect(far.cx).toBeCloseTo(1 * size.pitchX + size.cw / 2);
    expect(far.dim).toBeCloseTo(PLANE.far.dim);
    expect(far.bias).toBeCloseTo(PLANE.far.bias);
  });

  it("draws far tiles first and the hovered tile last", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0, "near"), tile("1,0", 1, "far"), tile("2,0", 2, "near")];
    pose.apply(list, input({ hoverKey: "1,0", dt: 0.5 }));
    expect(list[list.length - 1].key).toBe("1,0");
  });

  it("lights the other videos of the focused channel, and only those", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0, "near"), tile("1,0", 1, "far"), tile("2,0", 2, "near")];
    const focusIdx = 0;
    expect([...pose.echoFor(focusIdx)].sort()).toEqual([2, 3]);
    // a second per frame: the weights settle
    for (let i = 0; i < 5; i++) {
      pose.apply(list, input({ hoverKey: "0,0", lens: 1, focusIdx, dt: 0.5 }));
    }
    const by = (k: string) => list.find((t) => t.key === k) as Tile;
    expect(by("2,0").e).toBeGreaterThan(0.95);
    expect(by("2,0").dim).toBeCloseTo(1, 1); // keeps its brightness while the rest dim
    expect(by("1,0").e).toBe(0);
    expect(by("1,0").dim).toBeLessThan(PLANE.far.dim); // another channel: dimmed further
    expect(by("0,0").e).toBe(0); // the focused video itself is not its own echo
  });

  it("eases the echo in, and snaps to a static state with reduced motion", () => {
    const eased = createPose(videos);
    const a = [tile("2,0", 2, "near")];
    eased.apply(a, input({ hoverKey: "0,0", lens: 1, focusIdx: 0, dt: 0.016 }));
    expect(a[0].e).toBeGreaterThan(0);
    expect(a[0].e).toBeLessThan(0.5);

    const still = createPose(videos);
    const b = [tile("2,0", 2, "near")];
    still.apply(b, input({ hoverKey: "0,0", lens: 1, focusIdx: 0, dt: 0.016, reduced: true }));
    expect(b[0].e).toBe(1);
  });

  it("has no echo when nothing is focused", () => {
    const pose = createPose(videos);
    expect(pose.echoFor(null).size).toBe(0);
    const list = [tile("2,0", 2, "near")];
    pose.apply(list, input({}));
    expect(list[0].e).toBe(0);
  });

  it("forgets its weights on reset", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0, "near")];
    pose.apply(list, input({ hoverKey: "0,0", dt: 0.5 }));
    expect(list[0].f).toBeGreaterThan(0.5);
    pose.reset();
    pose.apply(list, input({ dt: 0.016 }));
    expect(list[0].f).toBe(0);
  });
});
