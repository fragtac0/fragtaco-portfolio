import { describe, expect, it } from "vitest";
import type { Level } from "./contours";
import { liftOf } from "./heights";
import { drawTerrain, redChannel } from "./terrain-canvas";
import { OVERVIEW, project, viewOf, type Cam } from "./view";

type Call = [string, ...unknown[]];

/** A 2D context that only writes down what it is asked to do (and what the fill and stroke styles were at each fill and stroke). */
function recorder() {
  const calls: Call[] = [];
  const c = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "",
    setTransform: (...a: number[]) => calls.push(["setTransform", ...a]),
    clearRect: (...a: number[]) => calls.push(["clearRect", ...a]),
    beginPath: () => calls.push(["beginPath"]),
    moveTo: (...a: number[]) => calls.push(["moveTo", ...a]),
    lineTo: (...a: number[]) => calls.push(["lineTo", ...a]),
    closePath: () => calls.push(["closePath"]),
    fill: (rule: string) => calls.push(["fill", rule, c.fillStyle]),
    stroke: () => calls.push(["stroke", c.strokeStyle, c.lineWidth]),
  };

  return { c: c as unknown as CanvasRenderingContext2D, calls };
}

const STAGE = { w: 1440, h: 900 };
const CAM: Cam = { ...OVERVIEW, trail: [{ x: 600, y: 330, n: 0.3 }, { x: 560, y: 330, n: 0.5 }] };
const ring = (...pts: [number, number][]) => Float32Array.from(pts.flat());
const LEVELS: Level[] = [
  { n: 0.1, fill: "#111", stroke: "rgba(1, 2, 3, 0.5)", width: 1.4, rings: [ring([400, 300], [600, 300], [500, 400]), ring([450, 320], [550, 320], [500, 360])] },
  { n: 0.8, fill: "#222", stroke: "rgb(9, 9, 9)", width: 0.8, rings: [ring([480, 310], [520, 310], [500, 340])] },
];

describe("drawTerrain", () => {
  const v = viewOf(CAM, 1, 1, STAGE);
  const { c, calls } = recorder();

  drawTerrain(c, LEVELS, v, STAGE, 2);

  it("sets the pixel ratio, clears the stage and draws the levels in the order it is given (low to high), each filled then stroked", () => {
    expect(calls[0]).toEqual(["setTransform", 2, 0, 0, 2, 0, 0]);
    expect(calls[1]).toEqual(["clearRect", 0, 0, 1440, 900]);

    const paints = calls.filter((x) => x[0] === "fill" || x[0] === "stroke");

    expect(paints).toEqual([
      ["fill", "evenodd", "#111"],
      ["stroke", "rgba(1, 2, 3, 0.5)", 1.4],
      ["fill", "evenodd", "#222"],
      ["stroke", "rgb(9, 9, 9)", 0.8],
    ]);
  });

  it("draws each ring as a closed path and a level as one path", () => {
    expect(calls.filter((x) => x[0] === "beginPath")).toHaveLength(2);
    expect(calls.filter((x) => x[0] === "closePath")).toHaveLength(3);
    expect(calls.filter((x) => x[0] === "moveTo")).toHaveLength(3);
    expect(calls.filter((x) => x[0] === "lineTo")).toHaveLength(2 + 2 + 2);
  });

  it("puts every point where `project` puts it, at its level's lifted height", () => {
    const moves = calls.filter((x) => x[0] === "moveTo");
    const [px, py] = project(v, 400, 300, liftOf(0.1, v.rise));
    const [qx, qy] = project(v, 480, 310, liftOf(0.8, v.rise));

    expect(moves[0][1]).toBeCloseTo(px, 3);
    expect(moves[0][2]).toBeCloseTo(py, 3);
    expect(moves[2][1]).toBeCloseTo(qx, 3);
    expect(moves[2][2]).toBeCloseTo(qy, 3);
  });

  it("stands a high level up the screen from where the same point would be on the ground (the rise)", () => {
    const high = calls.filter((x) => x[0] === "moveTo")[2][2] as number;
    const [, onGround] = project(v, 480, 310, 0);

    expect(high).toBeLessThan(onGround - 20);
  });

  it("does not lift anything while the camera is flat (k 0: the rise is 0)", () => {
    const flat = viewOf(CAM, 0, 1, STAGE);
    const e = recorder();

    drawTerrain(e.c, [LEVELS[1]], flat, STAGE, 1);

    const [x, y] = project(flat, 480, 310, 0);
    const first = e.calls.find((a) => a[0] === "moveTo")!;

    expect(first[1]).toBeCloseTo(x, 6);
    expect(first[2]).toBeCloseTo(y, 6);
  });

  it("draws nothing but the clear for no levels", () => {
    const e = recorder();

    drawTerrain(e.c, [], v, STAGE, 1);
    expect(e.calls.map((x) => x[0])).toEqual(["setTransform", "clearRect"]);
  });
});

describe("redChannel", () => {
  it("takes the red of each pixel", () => {
    expect(Array.from(redChannel([10, 99, 99, 255, 20, 1, 2, 255, 30, 0, 0, 0]))).toEqual([10, 20, 30]);
  });

  it("ignores a trailing partial pixel and is empty for nothing", () => {
    expect(redChannel([5, 0, 0, 255, 7, 0]).length).toBe(1);
    expect(redChannel([]).length).toBe(0);
  });
});
