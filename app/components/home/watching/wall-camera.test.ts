import { describe, expect, it } from "vitest";
import { blockPlan, clampPan, panRange, restFloat, sizeOfPlan } from "./wall-block";
import { createCamera } from "./wall-camera";
import { choiceLayout, createChoiceLayout, countOverlaps } from "./wall-choice";
import { layoutTiles } from "./wall-math";
import { createPose } from "./wall-pose";
import { cameraPan } from "./wall-spread";
import { createWallState, type Tile, type WallState } from "./wall-types";

/** The camera and the pose together, run the way the engine's frame runs them (no GL). */

const COUNT = 109;
const videos = Array.from({ length: COUNT }, (_, i) => ({ channel: `c${i % 7}` }));

function rig(vw: number, vh: number, reduced = false) {
  const st: WallState = createWallState();
  st.vw = vw;
  st.vh = vh;
  st.plan = blockPlan(COUNT, vw, vh);
  st.size = sizeOfPlan(st.plan);
  const [x, y] = [(st.plan.width - vw) / 2 + 40, (st.plan.height - vh) / 2 + 25];
  st.pan.x = x;
  st.pan.y = y;
  st.t = 3.3; // the block is mid float
  const [fx, fy] = restFloat(st.t);
  st.view.x = x + fx;
  st.view.y = y + fy;
  const camera = createCamera(st, reduced);
  const pose = createPose(videos);
  const choiceOf = createChoiceLayout();
  let list: Tile[] = [];
  const frame = (dt = 0.016) => {
    camera.step(dt);
    list = layoutTiles({
      viewX: st.view.x,
      viewY: st.view.y,
      vw,
      vh,
      plan: st.plan,
      count: COUNT,
      also: camera.views(),
    }) as Tile[];
    const choice = choiceOf(st);
    if (choice?.shift) camera.shiftInto(choice.shift);
    pose.apply(list, { dt, size: st.size, hoverKey: st.choice?.key ?? null, point: null, focusIdx: null, reduced, choice });
    return choice;
  };
  const run = (secs: number) => {
    let c = null as ReturnType<typeof frame>;
    for (let t = 0; t < secs; t += 0.016) c = frame();
    return c;
  };
  const choose = (cx: number, cy: number, live = true) => {
    const idx = cy * st.plan.cols + cx;
    st.choice = { key: `${cx},${cy}`, idx, live };
  };
  const by = (key: string) => list.find((t) => t.key === key) as Tile;
  return { st, camera, pose, frame, run, choose, by, list: () => list };
}

describe("the camera", () => {
  it("does nothing with no video chosen, and under reduced motion", () => {
    const r = rig(1440, 900);
    const before = { ...r.st.view };
    r.run(0.2);
    expect(r.st.view).toEqual(before);
    expect(r.camera.views()).toEqual([]);
    const q = rig(1440, 900, true);
    q.choose(2, 2);
    const v0 = { ...q.st.view };
    q.run(1);
    expect(q.st.view).toEqual(v0);
    const shift = { x: 9, y: 9 };
    q.camera.shiftInto(shift);
    expect(shift).toEqual({ x: 0, y: 0 });
  });

  it("slides the wall so the chosen tile's centre is at the chosen place, in 420 ms, with the float gone", () => {
    const r = rig(1440, 900);
    r.choose(5, 5);
    const choice = r.run(0.1);
    expect(choice).not.toBeNull();
    const mid = { ...r.st.view };
    r.run(0.5);
    const { rect } = choiceLayout(1440, 900);
    const t = r.by("5,5");
    expect(t.cx - t.w / 2 + 0).toBeLessThan(rect.x + rect.w); // sanity: on the screen
    // the tile is exactly at the middle of the chosen rect (no travel of its own: it is a middle tile)
    expect(t.cx).toBeCloseTo(rect.x + rect.w / 2, 3);
    expect(t.cy).toBeCloseTo(rect.y + rect.h / 2, 3);
    expect(r.st.view.x).not.toBeCloseTo(mid.x, 0);
    const end = cameraPan({ idx: 5 * r.st.plan.cols + 5, plan: r.st.plan, place: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, vw: 1440, vh: 900 });
    expect(r.st.view.x).toBeCloseTo(end.x, 6);
    expect(r.st.view.y).toBeCloseTo(end.y, 6);
  });

  it("is half way at about 210 ms and has not arrived before 420 ms", () => {
    const r = rig(1440, 900);
    const start = { ...r.st.view };
    r.choose(7, 7);
    r.run(0.21);
    const half = r.st.view.x - start.x;
    r.run(0.4);
    const full = r.st.view.x - start.x;
    expect(Math.abs(half / full)).toBeGreaterThan(0.35);
    expect(Math.abs(half / full)).toBeLessThan(0.65);
    const r2 = rig(1440, 900);
    r2.choose(7, 7);
    r2.run(0.3);
    expect(r2.pose.moving()).toBe(true);
    r2.run(0.8);
    expect(r2.pose.moving()).toBe(false);
  });

  it("leaves the tile's own travel to the little the block's edge keeps from the camera (a corner tile)", () => {
    const r = rig(1440, 900);
    r.choose(0, 0);
    r.run(1);
    const { rect } = choiceLayout(1440, 900);
    const t = r.by("0,0");
    // the camera could not bring it all the way (the range stops it), but the tile ends on the place all the same
    const rest = r.st.size.cw / 2 - r.st.view.x;
    expect(rest).toBeGreaterThan(0);
    expect(t.cx).toBeCloseTo(rect.x + rect.w / 2, 3);
    expect(t.cy).toBeCloseTo(rect.y + rect.h / 2, 3);
    expect(t.w).toBeCloseTo(rect.w, 3);
  });

  it("never takes the block's edge past the middle third, on the way or when it has arrived", () => {
    for (const [cx, cy] of [
      [0, 0],
      [9, 0],
      [0, 10],
      [8, 10],
    ]) {
      const r = rig(1440, 900);
      r.choose(cx, cy);
      const [x0, x1] = panRange(r.st.plan.width, 1440);
      const [y0, y1] = panRange(r.st.plan.height, 900);
      for (let t = 0; t < 1; t += 0.016) {
        r.frame();
        expect(r.st.view.x).toBeGreaterThanOrEqual(Math.min(x0, 0) - 5);
        expect(r.st.view.x).toBeLessThanOrEqual(Math.max(x1, 0) + 5);
        expect(r.st.view.y).toBeGreaterThanOrEqual(Math.min(y0, 0) - 5);
        expect(r.st.view.y).toBeLessThanOrEqual(Math.max(y1, 0) + 5);
      }
      const [hx, hy] = clampPan(r.st.view.x, r.st.view.y, r.st.plan, 1440, 900);
      expect(Math.abs(hx - r.st.view.x)).toBeLessThanOrEqual(80);
      expect(Math.abs(hy - r.st.view.y)).toBeLessThanOrEqual(80);
    }
  });

  it("goes back to the pan it had when the video closes, and leaves the pulled pan alone", () => {
    const r = rig(1440, 900);
    const pan = { ...r.st.pan };
    const was = { ...r.st.view }; // the pan and the float it had
    const home = clampPan(pan.x, pan.y, r.st.plan, 1440, 900);
    expect(Math.abs(was.x - home[0])).toBeLessThanOrEqual(4.5);
    r.choose(4, 6);
    r.run(0.6);
    expect(r.st.view.x).not.toBeCloseTo(home[0], 0);
    r.st.choice = { ...(r.st.choice as NonNullable<typeof r.st.choice>), live: false };
    r.run(0.4);
    expect(r.st.view.x).toBeCloseTo(was.x, 6);
    expect(r.st.view.y).toBeCloseTo(was.y, 6);
    expect(r.st.pan).toEqual(pan);
    // every tile is back where the wall had it
    for (const t of r.list()) {
      expect(t.cx).toBeCloseTo(t.x + r.st.size.cw / 2, 3);
      expect(t.w).toBeCloseTo(r.st.size.cw, 3);
    }
  });

  it("starts from the view as it was (no jump when the video is chosen) and fades the float out", () => {
    const r = rig(1440, 900);
    const was = { ...r.st.view };
    r.choose(3, 3);
    r.frame(0.001);
    expect(Math.hypot(r.st.view.x - was.x, r.st.view.y - was.y)).toBeLessThan(0.5);
  });

  it("follows the choice when it moves: a new leg from where the camera is, no jump", () => {
    const r = rig(1440, 900);
    r.choose(4, 5);
    r.run(0.6);
    const a = { ...r.st.view };
    r.choose(5, 5);
    r.frame();
    expect(Math.hypot(r.st.view.x - a.x, r.st.view.y - a.y)).toBeLessThan(2);
    r.run(0.6);
    const b = { ...r.st.view };
    expect(b.x - a.x).toBeCloseTo(r.st.size.pitchX, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
    const t = r.by("5,5");
    const { rect } = choiceLayout(1440, 900);
    expect(t.cx).toBeCloseTo(rect.x + rect.w / 2, 3);
  });
});

describe("the wall opening with the camera", () => {
  it("moves no tile across the wall (a middle tile): the chosen one stays where the camera takes it", () => {
    const r = rig(1440, 900);
    r.choose(5, 5);
    for (let t = 0; t < 0.6; t += 0.016) {
      r.frame();
      const tl = r.by("5,5");
      // the tile sits at its place in the wall (its layout place), only grown: no travel of its own
      // (a hundredth of a pixel at the very first frame, where the push has not quite gone)
      expect(Math.abs(tl.cx - (tl.x + r.st.size.cw / 2))).toBeLessThan(0.02);
      expect(Math.abs(tl.cy - (tl.y + r.st.size.ch / 2))).toBeLessThan(0.02);
    }
  });

  it("opens with no two visible tiles overlapping, a corner tile included, and nothing standing in the text", () => {
    for (const [cx, cy] of [
      [0, 0],
      [9, 10],
      [4, 5],
      [9, 0],
    ]) {
      const r = rig(1440, 900);
      r.choose(cx, cy);
      const choice = r.run(1.2)!;
      expect(countOverlaps(r.list(), choice)).toBe(0);
      expect(r.pose.moving()).toBe(false);
    }
  });

  it("never lets a tile jump between frames while the choice moves along a row", () => {
    const r = rig(1440, 900);
    r.choose(4, 5);
    r.run(1);
    const track = () => new Map(r.list().map((t) => [t.key, { x: t.cx, y: t.cy, w: t.w, fade: t.fade }]));
    let prev = track();
    r.choose(5, 5);
    let worst = 0;
    let fadeJump = 0;
    for (let t = 0; t < 0.7; t += 0.016) {
      r.frame();
      const now = track();
      for (const [k, v] of now) {
        const p = prev.get(k);
        if (!p) continue;
        worst = Math.max(worst, Math.hypot(v.x - p.x, v.y - p.y));
        fadeJump = Math.max(fadeJump, Math.abs(v.fade - p.fade));
      }
      prev = now;
    }
    // the camera moves one pitch (about 148 px) in 420 ms: a frame never carries a tile further than about a tenth of that
    expect(worst).toBeLessThan(26);
    expect(fadeJump).toBeLessThan(0.45);
  });

  it("is steady at the six Review Focus sizes: opens, then holds with the chosen tile on the place", () => {
    for (const [vw, vh] of [
      [320, 568],
      [390, 844],
      [844, 390],
      [820, 1180],
      [1440, 900],
      [2560, 1440],
    ]) {
      const r = rig(vw, vh);
      const plan = r.st.plan;
      const mid = Math.floor(plan.rows / 2) * plan.cols + Math.floor(plan.cols / 2);
      for (const idx of [0, mid, COUNT - 1]) {
        r.pose.reset();
        r.st.choice = null;
        r.frame();
        r.choose(idx % plan.cols, Math.floor(idx / plan.cols));
        const choice = r.run(1.2)!;
        const tl = r.by(r.st.choice!.key);
        const { rect } = choiceLayout(vw, vh);
        expect(tl.cx).toBeCloseTo(rect.x + rect.w / 2, 2);
        expect(tl.cy).toBeCloseTo(rect.y + rect.h / 2, 2);
        expect(countOverlaps(r.list(), choice)).toBe(0);
        // close and come back
        r.st.choice = { ...r.st.choice!, live: false };
        r.run(0.5);
        r.st.choice = null;
        r.frame();
      }
    }
  });
});
