import { describe, expect, it } from "vitest";
import { HEIGHT, OVERVIEW, PITCH, SCLIMB, YAW, pictureOpacity, planeTransform, project, viewOf, type Cam, type Stage } from "./view";
import { lowerTrail, sampleTrail, type Point } from "./trail";

const ROUTE: Point[] = [[639.5, 329.6], [619.2, 329.0], [604.8, 330.2], [589.7, 332.4], [579.2, 349.4], [565.5, 377.2], [542.1, 400.1], [511.4, 402.0], [487.3, 393.1], [468.9, 380.4], [458.1, 366.2]];
const SUMMIT: Point = [500, 325];
const STAGE: Stage = { w: 1440, h: 900 };

/** The trail with a height that grows toward the summit end, so a view that lifts the camera (tz) is tested too. */
const flat = sampleTrail(lowerTrail(ROUTE, SUMMIT), 200);
const hilly = flat.map((p, i) => ({ ...p, n: 0.55 * (i / 200) }));
const cam = (trail = flat): Cam => ({ ...OVERVIEW, trail });

type M = number[][];
const IDENT = (): M => [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
const mul = (a: M, b: M): M => a.map((row, i) => b[0].map((_, j) => row.reduce((s, _v, k) => s + a[i][k] * b[k][j], 0)));

/** The matrix of a CSS transform list (column vectors, the last function applied first), for the functions `planeTransform` uses. */
function parse(css: string): M {
  let m = IDENT();

  for (const [, name, arg] of css.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const n = arg.split(",").map((s) => parseFloat(s));
    const f = IDENT();

    if (name === "translate") {
      f[0][3] = n[0];
      f[1][3] = n[1];
    } else if (name === "translateZ") {
      f[2][3] = n[0];
    } else if (name === "perspective") {
      f[3][2] = -1 / n[0];
    } else if (name === "scale") {
      f[0][0] = n[0];
      f[1][1] = n[0];
    } else if (name === "rotateX") {
      const [c, s] = [Math.cos(n[0]), Math.sin(n[0])];

      f[1][1] = c; f[1][2] = -s; f[2][1] = s; f[2][2] = c;
    } else if (name === "rotateZ") {
      const [c, s] = [Math.cos(n[0]), Math.sin(n[0])];

      f[0][0] = c; f[0][1] = -s; f[1][0] = s; f[1][1] = c;
    } else {
      throw new Error(`unexpected ${name}`);
    }
    m = mul(m, f);
  }

  return m;
}

/** Where a point of the flat picture (x, y, z 0) lands on the stage. */
function through(m: M, x: number, y: number): [number, number] {
  const p = [x, y, 0, 1];
  const o = m.map((row) => row.reduce((s, v, i) => s + v * p[i], 0));

  return [o[0] / o[3], o[1] / o[3]];
}

describe("viewOf: the overview", () => {
  it("puts the summit in the middle of the stage when the camera looks at it", () => {
    const v = viewOf({ ...cam(), ax: 500, ay: 325 }, 0, 1, STAGE);
    const [x, y] = project(v, SUMMIT[0], SUMMIT[1], 0);

    expect(x).toBeCloseTo(STAGE.w / 2, 9);
    expect(y).toBeCloseTo(STAGE.h / 2, 9);
  });

  it("looks 30 units west of the summit with the preview's numbers (470, 325): the summit sits a little right of the middle", () => {
    const v = viewOf(cam(), 0, 1, STAGE);
    const [x, y] = project(v, SUMMIT[0], SUMMIT[1], 0);

    expect(v.S).toBeCloseTo(1.44 * 1.1, 9);
    expect(x).toBeCloseTo(STAGE.w / 2 + 30 * 1.44 * 1.1, 9);
    expect(y).toBeCloseTo(STAGE.h / 2, 9);
  });

  it("covers the stage: the picture at zoom 1.1 is at least 1.1 times the smallest that fills it, on a wide and on a tall stage", () => {
    for (const stage of [{ w: 1440, h: 900 }, { w: 390, h: 844 }, { w: 2000, h: 700 }]) {
      const v = viewOf(cam(), 0, 1, stage);

      expect(1000 * v.S).toBeGreaterThanOrEqual(1.1 * stage.w - 1e-9);
      expect(650 * v.S).toBeGreaterThanOrEqual(1.1 * stage.h - 1e-9);
      // and the picture's four corners, projected, lie outside the stage (the stage is inside the picture)
      const [left, top] = project(v, 0, 0, 0);
      const [right, bottom] = project(v, 1000, 650, 0);

      expect(left).toBeLessThanOrEqual(0);
      expect(top).toBeLessThanOrEqual(0);
      expect(right).toBeGreaterThanOrEqual(stage.w);
      expect(bottom).toBeGreaterThanOrEqual(stage.h);
    }
  });

  it("has no tilt, no turn, no rise and no night", () => {
    const v = viewOf(cam(), 0, 1, STAGE);

    for (const n of [v.pitch, v.yaw, v.rise, v.night, v.tz]) expect(n).toBeCloseTo(0, 12);
    expect(v.CY).toBe(STAGE.h / 2);
  });
});

describe("viewOf: My climb", () => {
  const v = viewOf(cam(), 1, 1, STAGE);

  it("tilts 61 degrees, turns -14, zooms to 3, sits a little low and has risen and gone dark", () => {
    expect(v.pitch).toBeCloseTo(PITCH, 12);
    expect(PITCH).toBeCloseTo((61 * Math.PI) / 180, 12);
    expect(v.yaw).toBeCloseTo(YAW, 12);
    expect(v.s).toBeCloseTo(SCLIMB, 12);
    expect(v.CY).toBeCloseTo(STAGE.h * 0.62, 9);
    expect(v.rise).toBe(1);
    expect(v.night).toBe(1);
    expect(v.DIST).toBeCloseTo(450, 9);
    expect(HEIGHT).toBe(84);
  });

  it("looks a little way from the trail toward the middle of the mountain", () => {
    const end = flat[200];

    expect(v.tx).toBeCloseTo(end.x + (487 - end.x) * 0.22, 9);
    expect(v.ty).toBeCloseTo(end.y + (320 - end.y) * 0.22, 9);
  });

  it("follows u along the trail", () => {
    const a = viewOf(cam(), 1, 0, STAGE);
    const b = viewOf(cam(), 1, 1, STAGE);

    expect(a.tx).not.toBeCloseTo(b.tx, 0);
  });

  it("lifts the camera with the ground under it", () => {
    expect(viewOf(cam(hilly), 1, 1, STAGE).tz).toBeCloseTo(0.55 * HEIGHT * 0.9, 6);
    expect(viewOf(cam(hilly), 1, 0, STAGE).tz).toBeCloseTo(0, 9);
  });
});

describe("the steps between", () => {
  it("rise: 0 up to k 0.2, 1 at k 1; night: 0 up to k 0.08, 1 from k 0.62", () => {
    const at = (k: number) => viewOf(cam(), k, 1, STAGE);

    expect(at(0.2).rise).toBe(0);
    expect(at(1).rise).toBe(1);
    expect(at(0.6).rise).toBeGreaterThan(0);
    expect(at(0.6).rise).toBeLessThan(1);
    expect(at(0.08).night).toBe(0);
    expect(at(0.62).night).toBe(1);
    expect(at(0.35).night).toBeCloseTo(0.5, 6);
  });

  it("the zoom changes by one ratio over k", () => {
    const at = (k: number) => viewOf(cam(), k, 1, STAGE).s;

    expect(at(0.5)).toBeCloseTo(Math.sqrt(1.1 * 3), 9);
  });

  it("the picture fades as the night comes: 1 up to night 0.12, 0 from 0.85", () => {
    expect(pictureOpacity(0)).toBe(1);
    expect(pictureOpacity(0.12)).toBe(1);
    expect(pictureOpacity(0.85)).toBe(0);
    expect(pictureOpacity(1)).toBe(0);
    expect(pictureOpacity(0.485)).toBeCloseTo(0.5, 6);
  });
});

describe("planeTransform", () => {
  const corners: [number, number][] = [[0, 0], [1000, 0], [0, 650], [1000, 650]];

  for (const k of [0, 0.3, 0.6]) {
    for (const [name, trail] of [["flat ground", flat], ["rising ground", hilly]] as const) {
      for (const u of [1, 0.4]) {
        it(`agrees with project at the four corners of the picture (k ${k}, ${name}, u ${u})`, () => {
          const v = viewOf(cam(trail), k, u, STAGE);
          const m = parse(planeTransform(v));

          for (const [x, y] of corners) {
            const want = project(v, x, y, 0);
            const got = through(m, x, y);

            expect(Math.abs(got[0] - want[0])).toBeLessThan(0.5);
            expect(Math.abs(got[1] - want[1])).toBeLessThan(0.5);
          }
        });
      }
    }
  }

  it("agrees in the middle of the picture too, and on a phone", () => {
    const v = viewOf(cam(hilly), 0.45, 0.7, { w: 390, h: 844 });
    const m = parse(planeTransform(v));

    for (const [x, y] of [[500, 325], [250, 100], [800, 600]] as const) {
      const want = project(v, x, y, 0);
      const got = through(m, x, y);

      expect(got[0]).toBeCloseTo(want[0], 6);
      expect(got[1]).toBeCloseTo(want[1], 6);
    }
  });

  it("is a plain move and scale in the overview", () => {
    expect(planeTransform(viewOf(cam(), 0, 1, STAGE))).toMatch(/^translate\(720px, 450px\) perspective\(\S+px\) rotateX\(0rad\) rotateZ\(0rad\) translateZ\(0px\) scale\(1\.584\) translate\(-470px, -325px\)$/);
  });
});

describe("project", () => {
  it("raises a point on screen as its height grows, more as the camera tilts", () => {
    const v = viewOf(cam(), 1, 1, STAGE);
    const low = project(v, 500, 325, 0);
    const high = project(v, 500, 325, 84);

    expect(high[1]).toBeLessThan(low[1] - 50);
  });

  it("keeps a point at the camera's own target at the centre", () => {
    const v = viewOf(cam(), 1, 0.5, STAGE);
    const [x, y] = project(v, v.tx, v.ty, v.tz);

    expect(x).toBeCloseTo(v.CX, 9);
    expect(y).toBeCloseTo(v.CY, 9);
  });
});
