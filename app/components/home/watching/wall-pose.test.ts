import { describe, expect, it } from "vitest";
import { tileSize } from "./wall-math";
import { createPose, drawRank, sortForDraw, type PoseInput } from "./wall-pose";
import type { Tile } from "./wall-types";

const videos = [{ channel: "A" }, { channel: "B" }, { channel: "A" }, { channel: "A" }];
const size = tileSize(1440);

const tile = (key: string, idx: number): Tile => {
  const [cx, cy] = key.split(",").map(Number);
  return {
    key,
    idx,
    x: cx * size.pitchX,
    y: cy * size.pitchY,
    f: 0,
    e: 0,
    c: 0,
    dim: 1,
    fade: 1,
    cx: 0,
    cy: 0,
    w: 0,
    h: 0,
    rad: 0,
  };
};
const centre = (t: Tile) => ({ x: t.x + size.cw / 2, y: t.y + size.ch / 2 });
const by = (list: Tile[], k: string) => list.find((t) => t.key === k) as Tile;

const input = (over: Partial<PoseInput>): PoseInput => ({
  dt: 0.016,
  size,
  hoverKey: null,
  point: null,
  focusIdx: null,
  reduced: false,
  ...over,
});

describe("createPose", () => {
  it("leaves every tile the same size, brightness and place with nothing near", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0), tile("1,0", 1), tile("2,3", 2)];
    pose.apply(list, input({}));
    for (const t of list) {
      expect(t.w).toBeCloseTo(size.cw);
      expect(t.h).toBeCloseTo(size.ch);
      expect(t.rad).toBe(12);
      expect(t.cx).toBeCloseTo(t.x + size.cw / 2);
      expect(t.cy).toBeCloseTo(t.y + size.ch / 2);
    }
  });

  it("grows the tile under the pointer by 4%, and one far away not at all", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0), tile("4,0", 1)];
    const here = centre(list[0]);
    for (let i = 0; i < 40; i++) pose.apply(list, input({ point: here, dt: 0.1 }));
    expect(by(list, "0,0").w).toBeCloseTo(size.cw * 1.04, 3);
    expect(by(list, "0,0").h).toBeCloseTo(size.ch * 1.04, 3);
    expect(by(list, "4,0").w).toBe(size.cw);
  });

  it("eases a nearby tile away from the pointer by no more than 4 px", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0), tile("1,0", 1)];
    // the pointer sits on the left tile's right edge: the right tile is 130 px or so away
    const p = { x: list[0].x + size.cw, y: list[0].y + size.ch / 2 };
    for (let i = 0; i < 40; i++) pose.apply(list, input({ point: p, dt: 0.1 }));
    const right = by(list, "1,0");
    const pushed = right.cx - (right.x + size.cw / 2);
    expect(pushed).toBeGreaterThan(0.5);
    expect(pushed).toBeLessThanOrEqual(4);
    expect(right.cy).toBeCloseTo(right.y + size.ch / 2, 6);
    expect(right.w).toBeGreaterThan(size.cw);
    expect(right.w).toBeLessThan(size.cw * 1.04);
  });

  it("never lifts or dims: the size is at most 4% and there is no brightness at all", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0), tile("1,0", 1), tile("2,0", 2)];
    for (let i = 0; i < 40; i++) {
      pose.apply(list, input({ point: centre(list[1]), hoverKey: "1,0", dt: 0.1, focusIdx: 1 }));
    }
    for (const t of list) {
      expect(t.w).toBeLessThanOrEqual(size.cw * 1.04 + 1e-9);
      expect(t.dim).toBe(1);
      expect(t.fade).toBe(1);
      expect("bias" in t).toBe(false);
    }
  });

  it("eases the nearness in, and back out when the pointer leaves", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0)];
    pose.apply(list, input({ point: centre(list[0]) }));
    const first = list[0].w;
    expect(first).toBeGreaterThanOrEqual(size.cw);
    for (let i = 0; i < 40; i++) pose.apply(list, input({ point: centre(list[0]), dt: 0.1 }));
    expect(list[0].w).toBeGreaterThan(first);
    for (let i = 0; i < 60; i++) pose.apply(list, input({ point: null, dt: 0.1 }));
    expect(list[0].w).toBeCloseTo(size.cw, 6);
  });

  it("with reduced motion keeps the growth, with no easing and no push", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0), tile("1,0", 1)];
    const p = { x: list[0].x + size.cw, y: list[0].y + size.ch / 2 };
    pose.apply(list, input({ point: p, reduced: true }));
    const right = by(list, "1,0");
    expect(right.cx).toBeCloseTo(right.x + size.cw / 2, 9);
    expect(right.cy).toBeCloseTo(right.y + size.ch / 2, 9);
    expect(right.w).toBeGreaterThan(size.cw);
    pose.apply(list, input({ point: null, reduced: true }));
    expect(by(list, "1,0").w).toBe(size.cw);
  });

  it("draws the focused tile last", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0), tile("1,0", 1), tile("2,0", 2)];
    pose.apply(list, input({ hoverKey: "1,0", dt: 0.5 }));
    expect(list[list.length - 1].key).toBe("1,0");
  });

  it("lights the other videos of the focused channel, and only those", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0), tile("1,0", 1), tile("2,0", 2)];
    expect([...pose.echoFor(0)].sort()).toEqual([2, 3]);
    for (let i = 0; i < 5; i++) pose.apply(list, input({ hoverKey: "0,0", focusIdx: 0, dt: 0.5 }));
    expect(by(list, "2,0").e).toBeGreaterThan(0.95);
    expect(by(list, "1,0").e).toBe(0);
    expect(by(list, "0,0").e).toBe(0); // the focused video itself is not its own echo
  });

  it("eases the echo in, and snaps to a static state with reduced motion", () => {
    const eased = createPose(videos);
    const a = [tile("2,0", 2)];
    eased.apply(a, input({ hoverKey: "0,0", focusIdx: 0, dt: 0.016 }));
    expect(a[0].e).toBeGreaterThan(0);
    expect(a[0].e).toBeLessThan(0.5);

    const still = createPose(videos);
    const b = [tile("2,0", 2)];
    still.apply(b, input({ hoverKey: "0,0", focusIdx: 0, dt: 0.016, reduced: true }));
    expect(b[0].e).toBe(1);
  });

  it("has no echo when nothing is focused", () => {
    const pose = createPose(videos);
    expect(pose.echoFor(null).size).toBe(0);
    const list = [tile("2,0", 2)];
    pose.apply(list, input({}));
    expect(list[0].e).toBe(0);
  });

  it("forgets its weights on reset", () => {
    const pose = createPose(videos);
    const list = [tile("0,0", 0)];
    pose.apply(list, input({ hoverKey: "0,0", point: centre(list[0]), dt: 0.5 }));
    expect(list[0].f).toBeGreaterThan(0.5);
    pose.reset();
    pose.apply(list, input({ dt: 0.016 }));
    expect(list[0].f).toBe(0);
    expect(list[0].w).toBe(size.cw);
  });
});

describe("drawRank and sortForDraw", () => {
  it("ranks the chosen tile after the focused ones", () => {
    expect(drawRank(1, 1)).toBeGreaterThan(drawRank(1, 0));
    expect(drawRank(0, 0.5)).toBeGreaterThan(drawRank(1, 0));
    expect(drawRank(0, 0)).toBe(0);
  });

  it("ranks a focused tile after the rest, the more focused the later", () => {
    expect(drawRank(0)).toBe(0);
    expect(drawRank(0.005)).toBe(0);
    expect(drawRank(0.3)).toBeGreaterThan(drawRank(0));
    expect(drawRank(0.9)).toBeGreaterThan(drawRank(0.3));
  });

  it("sorts in place, focused last, the others in their order", () => {
    const tiles = [
      { id: "a", f: 0.9 },
      { id: "b", f: 0 },
      { id: "c", f: 0.4 },
      { id: "d", f: 0 },
    ];
    expect(sortForDraw(tiles).map((t) => t.id)).toEqual(["b", "d", "c", "a"]);
  });
});
