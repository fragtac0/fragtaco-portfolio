import { describe, expect, it } from "vitest";
import { blockPlan, centredPan, clampPan, panRange } from "./wall-block";
import { fitBlock } from "./wall-reshape";
import { createWallState, type WallState } from "./wall-types";

const N = 109;

function wallAt(vw: number, vh: number): WallState {
  const st = createWallState();
  st.vw = vw;
  st.vh = vh;
  fitBlock(st, N);
  return st;
}

const resize = (st: WallState, vw: number, vh: number) => {
  st.vw = vw;
  st.vh = vh;
  return fitBlock(st, N);
};

const cell = (idx: number, cols: number) => ({ cx: idx % cols, cy: Math.floor(idx / cols) });
const keyOfIdx = (idx: number, cols: number) => `${cell(idx, cols).cx},${cell(idx, cols).cy}`;

/** Where tile (cx, cy) shows on screen, from the pan the wall will show. */
function onScreen(st: WallState, cx: number, cy: number) {
  const [x, y] = clampPan(st.pan.x, st.pan.y, st.plan, st.vw, st.vh);
  return { x: cx * st.size.pitchX - x, y: cy * st.size.pitchY - y };
}

describe("fitBlock", () => {
  it("fits the first run to the plan and stands the block in the middle", () => {
    const st = createWallState();
    st.vw = 1440;
    st.vh = 900;
    expect(fitBlock(st, N)).toBe(true);
    expect(st.plan).toEqual(blockPlan(N, 1440, 900));
    expect(st.size.pitchX).toBe(st.plan.tileW + st.plan.gap);
    expect([st.pan.x, st.pan.y]).toEqual(centredPan(st.plan, 1440, 900));
  });

  it("does nothing with no videos or no canvas", () => {
    const st = createWallState();
    expect(fitBlock(st, 0)).toBe(false);
    st.vw = 1440;
    st.vh = 900;
    expect(fitBlock(st, 0)).toBe(false);
    expect(st.plan.cols).toBe(0);
  });

  it("recentres only when the grid (columns or rows) changed", () => {
    const st = wallAt(1440, 900);
    st.pan.x = 40;
    st.pan.y = 55;
    // 1440 to 1450 wide: the tiles change size, the grid stays 10 by 11
    expect(blockPlan(N, 1450, 900).cols).toBe(st.plan.cols);
    expect(blockPlan(N, 1450, 900).rows).toBe(st.plan.rows);
    expect(blockPlan(N, 1450, 900).tileW).not.toBe(st.plan.tileW);
    expect(resize(st, 1450, 900)).toBe(false);
    expect([st.pan.x, st.pan.y]).toEqual([40, 55]);
  });

  it("clamps the old pan into the new range when the grid is the same", () => {
    const st = wallAt(1440, 900);
    st.pan.x = 1e6;
    st.pan.y = -1e6;
    expect(resize(st, 1450, 900)).toBe(false);
    const [x0, x1] = panRange(st.plan.width, 1450);
    const [y0, y1] = panRange(st.plan.height, 900);
    expect(st.pan.x).toBeLessThanOrEqual(x1);
    expect(st.pan.x).toBeGreaterThanOrEqual(x0);
    expect(st.pan.y).toBeGreaterThanOrEqual(y0);
    expect(st.pan.y).toBeLessThanOrEqual(y1);
  });

  it("recentres when the grid changed and nothing is in focus", () => {
    const st = wallAt(1440, 900);
    st.pan.x = 40;
    st.pan.y = 55;
    st.vel.x = 300;
    expect(resize(st, 1440, 700)).toBe(true);
    expect([st.pan.x, st.pan.y]).toEqual(centredPan(st.plan, 1440, 700));
    expect(st.vel.x).toBe(0);
  });

  describe("a resize that changes the grid, with a video open", () => {
    // the audit's case: a phone turned on its side
    it("keeps the chosen video (its idx) on its video and puts it in view: 390 by 844 to 844 by 390", () => {
      const st = wallAt(390, 844);
      const before = st.plan;
      const idx = 57;
      const key = keyOfIdx(idx, before.cols);
      st.choice = { key, idx, live: true };
      st.hoverKey = key;
      expect(resize(st, 844, 390)).toBe(true);
      expect(st.plan.cols).not.toBe(before.cols);
      expect(st.choice.idx).toBe(idx);
      expect(st.choice.key).toBe(keyOfIdx(idx, st.plan.cols));
      expect(st.choice.live).toBe(true);
      expect(st.hoverKey).toBe(st.choice.key);
      // the key now names the same video in the new grid
      const [cx, cy] = st.choice.key.split(",").map(Number);
      expect(cy * st.plan.cols + cx).toBe(idx);
      // and it is on the screen
      const at = onScreen(st, cx, cy);
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.x + st.size.cw).toBeLessThanOrEqual(844);
      expect(at.y).toBeGreaterThanOrEqual(0);
      expect(at.y + st.size.ch).toBeLessThanOrEqual(390);
    });

    it("and back again", () => {
      const st = wallAt(844, 390);
      const idx = 100;
      st.choice = { key: keyOfIdx(idx, st.plan.cols), idx, live: true };
      resize(st, 390, 844);
      expect(st.choice.idx).toBe(idx);
      const [cx, cy] = st.choice.key.split(",").map(Number);
      expect(cy * st.plan.cols + cx).toBe(idx);
    });

    it("keeps the keyboard's tile on its video, and in view", () => {
      const st = wallAt(390, 844);
      const idx = 83;
      st.kbd = cell(idx, st.plan.cols);
      st.hoverKey = `${st.kbd.cx},${st.kbd.cy}`;
      expect(resize(st, 844, 390)).toBe(true);
      expect(st.kbd.cy * st.plan.cols + st.kbd.cx).toBe(idx);
      expect(st.hoverKey).toBe(`${st.kbd.cx},${st.kbd.cy}`);
      const at = onScreen(st, st.kbd.cx, st.kbd.cy);
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.x + st.size.cw).toBeLessThanOrEqual(844);
      expect(at.y).toBeGreaterThanOrEqual(0);
      expect(at.y + st.size.ch).toBeLessThanOrEqual(390);
    });

    it("keeps a hover alone on a video other than the chosen one", () => {
      const st = wallAt(390, 844);
      st.hoverKey = keyOfIdx(40, st.plan.cols);
      resize(st, 844, 390);
      const [cx, cy] = (st.hoverKey ?? "").split(",").map(Number);
      expect(cy * st.plan.cols + cx).toBe(40);
    });

    it("keeps every video's choice through a run of grid changes", () => {
      const st = wallAt(1440, 900);
      const idx = 33;
      st.choice = { key: keyOfIdx(idx, st.plan.cols), idx, live: true };
      for (const [w, h] of [
        [390, 844],
        [844, 390],
        [1024, 768],
        [320, 568],
        [1440, 850],
        [1440, 900],
      ]) {
        resize(st, w, h);
        const [cx, cy] = st.choice.key.split(",").map(Number);
        expect(cy * st.plan.cols + cx).toBe(idx);
        const at = onScreen(st, cx, cy);
        expect(at.x).toBeGreaterThanOrEqual(0);
        expect(at.x + st.size.cw).toBeLessThanOrEqual(w);
        expect(at.y).toBeGreaterThanOrEqual(0);
        expect(at.y + st.size.ch).toBeLessThanOrEqual(h);
      }
    });
  });

  it("brings a focused tile back on screen when the same grid's tiles change size", () => {
    const st = wallAt(1440, 900);
    st.pan.x = 0;
    st.pan.y = 0;
    const idx = 109 - 1;
    st.kbd = cell(idx, st.plan.cols); // far from the screen at this pan
    expect(resize(st, 1450, 900)).toBe(false);
    const at = onScreen(st, st.kbd.cx, st.kbd.cy);
    expect(at.x).toBeGreaterThanOrEqual(0);
    expect(at.x + st.size.cw).toBeLessThanOrEqual(1450);
  });
});
