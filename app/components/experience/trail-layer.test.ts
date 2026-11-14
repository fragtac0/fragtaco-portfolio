import { describe, expect, it } from "vitest";
import { RADAR_MS, STEMS_FROM, TRAIL_LIFT, drawRadar, drawTrail, pinPlaces, radarFoot, radarPhases, radarRing, radarSide, trailLift } from "./trail-layer";
import { liftOf } from "./heights";
import { MILESTONE_SHARES, aheadTrail, lowerTrail, sampleTrail, trailAt, type Point } from "./trail";
import { OVERVIEW, STEM, project, viewOf, type Cam, type Stage } from "./view";

const ROUTE: Point[] = [[639.5, 329.6], [619.2, 329.0], [604.8, 330.2], [589.7, 332.4], [579.2, 349.4], [565.5, 377.2], [542.1, 400.1], [511.4, 402.0], [487.3, 393.1], [468.9, 380.4], [458.1, 366.2]];
const STAGE: Stage = { w: 1440, h: 900 };
const trail = sampleTrail(lowerTrail(ROUTE, [500, 325]), 200).map((p, i) => ({ ...p, n: 0.5 * (i / 200) }));
const ahead = aheadTrail([trail[200].x, trail[200].y], [500, 325]).map((p) => ({ ...p, n: 0.7 }));
const cam: Cam = { ...OVERVIEW, trail };
const spots = MILESTONE_SHARES.map((u) => trailAt(trail, u));

type Call = [string, ...number[]];

/** A context that records the path's points, the strokes (with the style and width at the time) and the fills. */
function recorder() {
  const calls: Call[] = [];
  const strokes: { style: unknown; width: number; dash: number[]; points: number }[] = [];
  let path: number[][] = [];
  const state: { strokeStyle: unknown; lineWidth: number; dash: number[] } = { strokeStyle: "", lineWidth: 1, dash: [] };
  const paths: number[][][] = [];
  const c = {
    setTransform: () => {},
    clearRect: (...a: number[]) => calls.push(["clear", ...a]),
    beginPath: () => void (path = []),
    moveTo: (x: number, y: number) => path.push([x, y]),
    lineTo: (x: number, y: number) => path.push([x, y]),
    ellipse: (x: number, y: number, rx: number, ry: number) => calls.push(["ellipse", x, y, rx, ry]),
    setLineDash: (d: number[]) => void (state.dash = d),
    stroke: () => {
      strokes.push({ style: state.strokeStyle, width: state.lineWidth, dash: state.dash, points: path.length });
      paths.push(path);
    },
    fill: () => calls.push(["fill"]),
    set strokeStyle(v: unknown) { state.strokeStyle = v; },
    set lineWidth(v: number) { state.lineWidth = v; },
    set fillStyle(_v: unknown) {},
    set lineCap(_v: unknown) {},
    set lineJoin(_v: unknown) {},
  } as unknown as CanvasRenderingContext2D;

  return { c, calls, strokes, paths };
}

describe("pinPlaces", () => {
  it("puts each foot on the trail at the same height as the trail's line, and the head STEM units above it", () => {
    const v = viewOf(cam, 1, 0.8, STAGE);
    const pins = pinPlaces(v, spots);

    spots.forEach((m, i) => {
      const z = liftOf(m.n, v.rise) + TRAIL_LIFT * v.rise;

      expect(pins[i].foot).toEqual(project(v, m.x, m.y, z));
      expect(pins[i].head).toEqual(project(v, m.x, m.y, z + STEM * v.rise));
    });
  });

  it("has the head on the foot in the overview (no stem before the lines rise)", () => {
    const pins = pinPlaces(viewOf(cam, 0, 1, STAGE), spots);

    pins.forEach((p) => expect(p.head).toEqual(p.foot));
  });

  it("trailLift is 0.8 of the rise", () => {
    expect(trailLift(viewOf(cam, 1, 1, STAGE))).toBeCloseTo(TRAIL_LIFT, 10);
    expect(trailLift(viewOf(cam, 0, 1, STAGE))).toBe(0);
  });
});

describe("drawTrail", () => {
  it("draws the trail as a dark line under a cream one, then the dotted way ahead", () => {
    const v = viewOf(cam, 1, 0.8, STAGE);
    const { c, strokes } = recorder();

    drawTrail(c, v, STAGE, 2, trail, ahead, pinPlaces(v, spots));
    expect(strokes.slice(0, 3).map((s) => [s.width, s.dash.length])).toEqual([[3.6, 0], [1.5, 0], [1.3, 2]]);
    expect(strokes[0].points).toBe(201);
    expect(strokes[2].points).toBe(ahead.length);
  });

  it("the pins' feet are on the line: each foot is a point the trail's stroke passes through", () => {
    const v = viewOf(cam, 1, 0.8, STAGE);
    const { c, paths } = recorder();
    const pins = pinPlaces(v, spots);

    drawTrail(c, v, STAGE, 2, trail, ahead, pins);
    // the milestones sit on whole steps of the 200-step trail (0.3 is step 60), and the line is drawn through those steps
    MILESTONE_SHARES.forEach((u, i) => {
      const [x, y] = paths[0][Math.round(u * 200)];

      expect(x).toBeCloseTo(pins[i].foot[0], 6);
      expect(y).toBeCloseTo(pins[i].foot[1], 6);
    });
  });

  it("draws a stem and a foot for each pin only once the lines have risen", () => {
    const risen = viewOf(cam, 1, 0.8, STAGE);
    const flat = viewOf(cam, 0, 1, STAGE);
    const a = recorder();
    const b = recorder();

    drawTrail(a.c, risen, STAGE, 2, trail, ahead, pinPlaces(risen, spots));
    drawTrail(b.c, flat, STAGE, 2, trail, ahead, pinPlaces(flat, spots));
    expect(a.strokes).toHaveLength(3 + spots.length); // plus a stem each
    expect(a.calls.filter((x) => x[0] === "fill")).toHaveLength(spots.length);
    expect(b.strokes).toHaveLength(3);
    expect(b.calls.filter((x) => x[0] === "fill")).toHaveLength(0);
    expect(risen.rise).toBeGreaterThan(STEMS_FROM);
  });

  it("clears the canvas first, at the stage's size", () => {
    const v = viewOf(cam, 1, 1, STAGE);
    const { c, calls } = recorder();

    drawTrail(c, v, STAGE, 2, trail, ahead, []);
    expect(calls[0]).toEqual(["clear", 0, 0, 1440, 900]);
  });
});

describe("the radar", () => {
  const now = spots[spots.length - 1];

  it("is two rings half a life apart", () => {
    expect(radarPhases(0)).toEqual([0, 0.5]);
    expect(radarPhases(RADAR_MS * 0.25)[1]).toBeCloseTo(0.75, 10);
    expect(radarPhases(RADAR_MS * 1.5)[0]).toBeCloseTo(0.5, 10);
  });

  it("a ring grows from 2 to 17 units (times 1.6, over the root of the zoom) and fades out", () => {
    const v = viewOf(cam, 0, 1, STAGE);
    const small = radarRing(v, now, 0);
    const big = radarRing(v, now, 1);
    const unitsAcross = (ring: { points: [number, number][] }) => Math.hypot(ring.points[0][0] - ring.points[20][0], ring.points[0][1] - ring.points[20][1]) / v.S;

    expect(unitsAcross(small)).toBeCloseTo((2 * 2 * 1.6) / Math.sqrt(v.s), 1);
    expect(unitsAcross(big)).toBeCloseTo((2 * 17 * 1.6) / Math.sqrt(v.s), 1);
    expect(small.alpha).toBeCloseTo(0.95, 10);
    expect(big.alpha).toBeCloseTo(0, 10);
    expect(small.points).toHaveLength(41);
  });

  it("is closed, and flatter on the screen as the camera tilts", () => {
    const flat = radarRing(viewOf(cam, 0, 1, STAGE), now, 0.5);
    const tilted = radarRing(viewOf(cam, 1, 1, STAGE), now, 0.5);
    const tall = (ring: { points: [number, number][] }) => Math.max(...ring.points.map((p) => p[1])) - Math.min(...ring.points.map((p) => p[1]));
    const wide = (ring: { points: [number, number][] }) => Math.max(...ring.points.map((p) => p[0])) - Math.min(...ring.points.map((p) => p[0]));

    expect(flat.points[0][0]).toBeCloseTo(flat.points[40][0], 6);
    expect(tall(flat) / wide(flat)).toBeCloseTo(1, 1);
    expect(tall(tilted) / wide(tilted)).toBeLessThan(0.7);
  });

  it("draws two rings, 1.6 wide, in the accent, centred on the foot in a canvas of the given side", () => {
    const v = viewOf(cam, 1, 1, STAGE);
    const foot = radarFoot(v, now);
    const side = radarSide(Math.max(STAGE.w / 1000, STAGE.h / 650));
    const { c, strokes, paths, calls } = recorder();

    drawRadar(c, v, now, foot, side, 2, radarPhases(1000));
    expect(calls[0]).toEqual(["clear", 0, 0, side, side]);
    expect(strokes).toHaveLength(2);
    expect(strokes.every((s) => s.width === 1.6 && String(s.style).startsWith("rgba(252, 76, 0,"))).toBe(true);
    for (const path of paths) {
      const xs = path.map((p) => p[0]);
      const ys = path.map((p) => p[1]);

      expect(Math.min(...xs)).toBeGreaterThan(0);
      expect(Math.max(...xs)).toBeLessThan(side);
      expect(Math.min(...ys)).toBeGreaterThan(0);
      expect(Math.max(...ys)).toBeLessThan(side);
    }
  });

  it("fits its canvas at every size the page has: the side covers the biggest ring of either state", () => {
    for (const stage of [{ w: 1440, h: 900 }, { w: 390, h: 844 }, { w: 2560, h: 1440 }, { w: 820, h: 1180 }]) {
      const base = Math.max(stage.w / 1000, stage.h / 650);
      const side = radarSide(base);

      for (const k of [0, 0.5, 1]) {
        const v = viewOf(cam, k, 1, stage);
        const foot = radarFoot(v, now);

        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
          for (const [x, y] of radarRing(v, now, t).points) {
            expect(Math.abs(x - foot[0])).toBeLessThan(side / 2);
            expect(Math.abs(y - foot[1])).toBeLessThan(side / 2);
          }
        }
      }
    }
  });
});
