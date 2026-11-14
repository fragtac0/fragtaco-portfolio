import { describe, expect, it } from "vitest";
import { MAX_DT, MIDDLE, OMEGA, inMiddle, settle, springStep, type Milestone } from "./camera";
import { liftOf } from "./heights";
import { lowerTrail, MILESTONE_SHARES, sampleTrail, trailAt, type Point } from "./trail";
import { OVERVIEW, STEM, project, viewOf, type Cam, type Stage } from "./view";

const ROUTE: Point[] = [[639.5, 329.6], [619.2, 329.0], [604.8, 330.2], [589.7, 332.4], [579.2, 349.4], [565.5, 377.2], [542.1, 400.1], [511.4, 402.0], [487.3, 393.1], [468.9, 380.4], [458.1, 366.2]];
const STAGE: Stage = { w: 1440, h: 900 };
const trail = sampleTrail(lowerTrail(ROUTE, [500, 325]), 200).map((p, i) => ({ ...p, n: 0.5 * (i / 200) }));
const cam: Cam = { ...OVERVIEW, trail };
const milestone = (i: number): Milestone => ({ ...trailAt(trail, MILESTONE_SHARES[i]), u: MILESTONE_SHARES[i] });

describe("inMiddle", () => {
  it("is true when the head is 25% to 75% across and 40% to 80% down, and false outside", () => {
    // Put the camera on the milestone: its head is near the centre horizontally.
    const m = milestone(4);

    expect(inMiddle(cam, m, m.u, STAGE)).toBe(true);

    const v = viewOf(cam, 1, m.u, STAGE);
    const [x, y] = project(v, m.x, m.y, liftOf(m.n, 1) + STEM);

    expect(x).toBeGreaterThan(STAGE.w * MIDDLE.x0);
    expect(x).toBeLessThan(STAGE.w * MIDDLE.x1);
    expect(y).toBeGreaterThan(STAGE.h * MIDDLE.y0);
    expect(y).toBeLessThan(STAGE.h * MIDDLE.y1);
    expect(inMiddle(cam, milestone(0), 1, STAGE)).toBe(false);
  });
});

describe("settle", () => {
  it("keeps the camera where it is for a milestone in the middle of the view", () => {
    // From the place of milestone 5 (u 0.66), milestones 4 and 6 are a few steps along the trail: in the middle.
    const goal = MILESTONE_SHARES[5];

    for (const i of [4, 5, 6]) {
      expect(inMiddle(cam, milestone(i), goal, STAGE)).toBe(true);
      expect(settle(cam, goal, milestone(i), STAGE)).toBe(goal);
    }
  });

  it("moves along the trail, toward a milestone that is outside the middle", () => {
    const far = milestone(0); // the start, with the camera at the end
    const to = settle(cam, 1, far, STAGE);

    expect(inMiddle(cam, far, 1, STAGE)).toBe(false);
    expect(to).toBeLessThan(1);
    expect(to).toBeGreaterThanOrEqual(0);
    expect(inMiddle(cam, far, to, STAGE)).toBe(true);
  });

  it("moves forward for a milestone ahead, backward for one behind", () => {
    expect(settle(cam, 0, milestone(8), STAGE)).toBeGreaterThan(0);
    expect(settle(cam, 1, milestone(1), STAGE)).toBeLessThan(1);
  });

  it("goes a little past the first place the milestone is in the middle, so the next one is likely in view too", () => {
    const m = milestone(1);
    const to = settle(cam, 1, m, STAGE);
    let first = 1;

    while (first > 0 && !inMiddle(cam, m, first, STAGE)) first -= 0.02;
    expect(to).toBeCloseTo(first - 0.05, 6);
  });

  it("goes to the milestone's own place when none along the way shows it, and stays inside 0 to 1", () => {
    const nowhere: Milestone = { x: 5000, y: 5000, n: 0, u: 0.5 };

    expect(settle(cam, 1, nowhere, STAGE)).toBe(0.5);
    for (let i = 0; i < 9; i++) {
      const to = settle(cam, 0.5, milestone(i), STAGE);

      expect(to).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThanOrEqual(1);
    }
  });
});

describe("springStep", () => {
  /** Run the spring for `seconds` in steps of dt from (u, vel) toward goal; the places it passes through. */
  function run(u: number, vel: number, goal: number, dt: number, seconds: number): number[] {
    const out = [u];
    let state: [number, number] = [u, vel];

    for (let t = 0; t < seconds; t += dt) {
      state = springStep(state[0], state[1], goal, dt);
      out.push(state[0]);
    }

    return out;
  }

  for (const dt of [1 / 240, 1 / 144, 1 / 60, 1 / 30, MAX_DT]) {
    it(`never overshoots, and only ever moves toward the goal, from rest in steps of ${dt.toFixed(3)} s`, () => {
      for (const [from, goal] of [[0, 1], [1, 0], [0.3, 0.9]]) {
        const path = run(from, 0, goal, dt, 12);
        const dir = Math.sign(goal - from);

        for (const p of path) expect((goal - p) * dir).toBeGreaterThanOrEqual(-1e-12);
        for (let i = 1; i < path.length; i++) expect((path[i] - path[i - 1]) * dir).toBeGreaterThanOrEqual(-1e-12);
        expect(Math.abs(path[path.length - 1] - goal)).toBeLessThan(1e-3);
      }
    });
  }

  it("counts a step longer than MAX_DT as MAX_DT (a stalled tab does not throw the camera), and never goes back in time", () => {
    for (const long of [0.06, 0.25, 1, 60]) expect(springStep(0.2, 0.1, 0.9, long)).toEqual(springStep(0.2, 0.1, 0.9, MAX_DT));
    expect(springStep(0.2, 0.1, 0.9, -1)).toEqual(springStep(0.2, 0.1, 0.9, 0));
    // after a stall of a minute the camera is a step nearer its goal, not on it
    expect(springStep(0, 0, 1, 60)[0]).toBeLessThan(0.01);
  });

  it("starts gently (the speed grows from nothing) and settles", () => {
    const [u1, v1] = springStep(0, 0, 1, 1 / 60);
    const [, v2] = springStep(u1, v1, 1, 1 / 60);

    expect(u1).toBeGreaterThan(0);
    expect(u1).toBeLessThan(0.001);
    expect(v2).toBeGreaterThan(v1);
  });

  it("does not move when it is at the goal at rest, and does not change in a step of no time", () => {
    expect(springStep(0.7, 0, 0.7, 0.016)).toEqual([0.7, 0]);
    const [u, v] = springStep(0.3, 0.2, 0.9, 0);

    expect(u).toBeCloseTo(0.3, 12);
    expect(v).toBeCloseTo(0.2, 12);
  });

  it("agrees with the plain step the preview takes (acceleration w^2 (goal - u) - 2 w v) when the steps are tiny", () => {
    let u = 0;
    let v = 0;
    let state: [number, number] = [0, 0];

    for (let i = 0; i < 2000; i++) {
      v += (OMEGA * OMEGA * (1 - u) - 2 * OMEGA * v) * 0.001;
      u += v * 0.001;
      state = springStep(state[0], state[1], 1, 0.001);
    }
    expect(state[0]).toBeCloseTo(u, 2);
    expect(state[1]).toBeCloseTo(v, 2);
  });

  it("is critically damped: half way takes 1.68 / w seconds from rest (0.8 s)", () => {
    const path = run(0, 0, 1, 0.001, 3);
    const half = path.findIndex((p) => p >= 0.5) * 0.001;

    expect(half).toBeGreaterThan(1.6 / OMEGA);
    expect(half).toBeLessThan(1.76 / OMEGA);
  });

  it("bends the path without a jolt when the goal changes while it moves", () => {
    let state: [number, number] = [0, 0];

    for (let i = 0; i < 60; i++) state = springStep(state[0], state[1], 1, 1 / 60);

    const before = state;
    const after = springStep(before[0], before[1], 1.6, 1 / 60);

    // The place and the speed carry on: no jump in either.
    expect(Math.abs(after[0] - before[0])).toBeLessThan(0.03);
    expect(Math.abs(after[1] - before[1])).toBeLessThan(0.15);
    expect(after[1]).toBeGreaterThan(0);
    // And it never goes past the new, further goal.
    let s = after;

    for (let i = 0; i < 1200; i++) {
      s = springStep(s[0], s[1], 1.6, 1 / 60);
      expect(s[0]).toBeLessThanOrEqual(1.6 + 1e-12);
    }
  });
});
