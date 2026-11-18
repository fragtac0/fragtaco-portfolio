import { describe, expect, it } from "vitest";
import { FLOAT_MAX, SOFT_EDGE, clampPan, panRange, pullLimits, restFloat } from "./wall-block";
import { applyView, createMotion } from "./wall-motion";
import { fitBlock } from "./wall-reshape";
import { createWallState, type WallState } from "./wall-types";

const VW = 1440;
const VH = 900;

function wall(): WallState {
  const st = createWallState();
  st.vw = VW;
  st.vh = VH;
  fitBlock(st, 109);
  return st;
}

/** The middle of the pan range, where nothing resists and the float is whole. */
const middle = (st: WallState): [number, number] => {
  const [x0, x1] = panRange(st.plan.width, st.vw);
  const [y0, y1] = panRange(st.plan.height, st.vh);
  return [(x0 + x1) / 2, (y0 + y1) / 2];
};

const run = (m: ReturnType<typeof createMotion>, frames: number, dt = 1 / 60) => {
  for (let i = 0; i < frames; i++) m.step(dt, false);
};

describe("applyView", () => {
  it("is the soft-stopped pan, plus the float when floating", () => {
    const st = wall();
    st.pan.x = 300;
    st.pan.y = 200;
    st.t = 5;
    applyView(st, false);
    expect([st.view.x, st.view.y]).toEqual(clampPan(300, 200, st.plan, VW, VH));
    applyView(st, true);
    const [fx, fy] = restFloat(5);
    expect(st.view.x).toBeCloseTo(300 + fx, 9);
    expect(st.view.y).toBeCloseTo(200 + fy, 9);
  });

  it("never takes the view past the range, floating or not, at any pull and any moment", () => {
    const st = wall();
    const [x0, x1] = panRange(st.plan.width, VW);
    const [y0, y1] = panRange(st.plan.height, VH);
    for (const pull of [0, 5, 79, 400, 1e6]) {
      for (const sign of [-1, 1]) {
        for (let t = 0; t < 120; t += 0.9) {
          st.t = t;
          st.pan.x = sign > 0 ? x1 + pull : x0 - pull;
          st.pan.y = sign > 0 ? y1 + pull : y0 - pull;
          applyView(st, true);
          expect(st.view.x).toBeGreaterThanOrEqual(x0 - 1e-9);
          expect(st.view.x).toBeLessThanOrEqual(x1 + 1e-9);
          expect(st.view.y).toBeGreaterThanOrEqual(y0 - 1e-9);
          expect(st.view.y).toBeLessThanOrEqual(y1 + 1e-9);
        }
      }
    }
  });

  it("floats by up to FLOAT_MAX in the middle of the range", () => {
    const st = wall();
    [st.pan.x, st.pan.y] = middle(st);
    let most = 0;
    for (let t = 0; t < 300; t += 0.5) {
      st.t = t;
      applyView(st, true);
      most = Math.max(most, Math.abs(st.view.x - st.pan.x));
      expect(Math.abs(st.view.x - st.pan.x)).toBeLessThanOrEqual(FLOAT_MAX + 1e-9);
    }
    expect(most).toBeGreaterThan(2);
  });
});

describe("createMotion step: the soft stop", () => {
  it("holds a pull at its limit and zeroes the velocity going into it", () => {
    const st = wall();
    const m = createMotion(st, false);
    const lim = pullLimits(st.plan, VW, VH);
    st.dragging = true; // held: nothing eases it back
    st.pan.x = lim.x[1] + 500;
    st.pan.y = lim.y[0] - 500;
    st.vel.x = 900;
    st.vel.y = -900;
    m.step(1 / 60, false);
    expect(st.pan.x).toBeCloseTo(lim.x[1], 9);
    expect(st.pan.y).toBeCloseTo(lim.y[0], 9);
    expect(st.vel.x).toBe(0);
    expect(st.vel.y).toBe(0);
    // and stays there while it is held
    run(m, 120);
    expect(st.pan.x).toBeCloseTo(lim.x[1], 9);
    expect(st.pan.y).toBeCloseTo(lim.y[0], 9);
  });

  it("leaves the velocity alone inside the limits", () => {
    const st = wall();
    const m = createMotion(st, false);
    [st.pan.x, st.pan.y] = middle(st);
    st.vel.x = 400;
    m.step(1 / 60, false);
    expect(st.vel.x).toBeGreaterThan(300);
    expect(st.pan.x).toBeGreaterThan(middle(st)[0]);
  });

  it("eases a pull that is let go back to 80 px inside the range, without overshoot", () => {
    const st = wall();
    const m = createMotion(st, false);
    const [x0, x1] = panRange(st.plan.width, VW);
    const lim = pullLimits(st.plan, VW, VH);
    st.pan.x = lim.x[1];
    st.pan.y = middle(st)[1];
    let last = st.pan.x;
    for (let i = 0; i < 400; i++) {
      m.step(1 / 60, false);
      expect(st.pan.x).toBeLessThanOrEqual(last + 1e-9);
      expect(st.pan.x).toBeGreaterThanOrEqual(x1 - SOFT_EDGE - 1e-6);
      last = st.pan.x;
    }
    expect(st.pan.x).toBeCloseTo(x1 - SOFT_EDGE, 1);
    expect(x0).toBeLessThan(x1);
  });

  it("leaves a pan in the middle alone when it is let go", () => {
    const st = wall();
    const m = createMotion(st, false);
    [st.pan.x, st.pan.y] = middle(st);
    run(m, 60);
    expect(st.pan.x).toBeCloseTo(middle(st)[0], 9);
    expect(st.pan.y).toBeCloseTo(middle(st)[1], 9);
  });

  it("freezes everything while a video is chosen", () => {
    const st = wall();
    const m = createMotion(st, false);
    const lim = pullLimits(st.plan, VW, VH);
    st.pan.x = lim.x[1] + 50; // out of limits: not touched either
    st.vel.x = 700;
    st.choice = { key: "0,0", idx: 0, live: true };
    const t = st.t;
    m.step(0.016, false);
    expect(st.vel.x).toBe(0);
    expect(st.pan.x).toBe(lim.x[1] + 50);
    expect(st.t).toBe(t);
  });
});

describe("createMotion step: the float and the clock", () => {
  it("advances the clock, and floats", () => {
    const st = wall();
    const m = createMotion(st, false);
    [st.pan.x, st.pan.y] = middle(st);
    run(m, 120);
    expect(st.t).toBeGreaterThan(1.5);
    const [fx, fy] = restFloat(st.t);
    expect(st.view.x).toBeCloseTo(st.pan.x + fx, 6);
    expect(st.view.y).toBeCloseTo(st.pan.y + fy, 6);
  });

  it("settles the float while you look at a tile (the clock slows to a stop)", () => {
    const st = wall();
    const m = createMotion(st, false);
    for (let i = 0; i < 300; i++) m.step(1 / 60, true);
    const t = st.t;
    for (let i = 0; i < 60; i++) m.step(1 / 60, true);
    expect(st.t - t).toBeLessThan(0.01);
  });

  it("settles it for the keyboard's tile too, and pans to keep that tile in view", () => {
    const st = wall();
    const m = createMotion(st, false);
    [st.pan.x, st.pan.y] = middle(st);
    st.kbd = { cx: 0, cy: 0 };
    for (let i = 0; i < 600; i++) m.step(1 / 60, false);
    const xc = 0 * st.size.pitchX - st.view.x + st.size.cw / 2;
    expect(xc).toBeGreaterThan(0);
    expect(xc).toBeLessThan(VW);
    expect(st.pan.x).toBeLessThan(middle(st)[0]);
  });
});

describe("createMotion under reduced motion", () => {
  it("snaps a pull back at once instead of easing, and zeroes the velocity at the limit", () => {
    const st = wall();
    const m = createMotion(st, true);
    const [, x1] = panRange(st.plan.width, VW);
    st.pan.x = pullLimits(st.plan, VW, VH).x[1];
    st.pan.y = middle(st)[1];
    st.vel.x = 500;
    m.step(1 / 60, false);
    expect(st.pan.x).toBeCloseTo(x1 - SOFT_EDGE, 6);
    expect(st.vel.x).toBe(0); // the pull at the limit stopped the momentum
  });

  it("has no float: the view is the soft-stopped pan, and the clock stands still", () => {
    const st = wall();
    const m = createMotion(st, true);
    [st.pan.x, st.pan.y] = middle(st);
    run(m, 240);
    expect(st.t).toBe(0);
    expect([st.view.x, st.view.y]).toEqual(clampPan(st.pan.x, st.pan.y, st.plan, VW, VH));
  });
});
