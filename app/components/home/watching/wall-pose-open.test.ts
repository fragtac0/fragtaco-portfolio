import { describe, expect, it } from "vitest";
import { blockPlan, centredPan, sizeOfPlan } from "./wall-block";
import { layoutTiles } from "./wall-math";
import { choiceLayout, countOverlaps, picturesSettled } from "./wall-choice";
import { createPose, type PoseChoice, type PoseInput } from "./wall-pose";
import { cameraPan, chosenRect, crosses, easeInOut, SPREAD_DIM, SPREAD_SCALE, textZone } from "./wall-spread";
import type { Tile } from "./wall-types";

/** The pose while a video is chosen (spec 8.1, the click): the wall opens around it. */

const videos = [{ channel: "A" }, { channel: "B" }, { channel: "A" }, { channel: "A" }];
// the block's own tiles at 1440 by 900: half of round 6's, so the chosen video (round 6's size) is twice a tile
const size = sizeOfPlan(blockPlan(109, 1440, 900));

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

describe("createPose with a chosen video", () => {
  const vw = 1440;
  const vh = 900;
  const rect = chosenRect(vw, vh, false);
  const choice = (over: Partial<PoseChoice> = {}): PoseChoice => ({
    key: "2,2",
    live: true,
    rect,
    zone: textZone(rect, vw),
    halfDiag: Math.hypot(vw / 2, vh / 2),
    ...over,
  });
  const rc = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  /** A wall of columns 0..7 by rows 0..4, the way layoutTiles lays them out. */
  const wall = (): Tile[] => {
    const out: Tile[] = [];
    let i = 0;
    for (let cx = 0; cx < 8; cx++) for (let cy = 0; cy < 5; cy++) out.push(tile(`${cx},${cy}`, i++ % 4));
    return out;
  };
  const run = (pose: ReturnType<typeof createPose>, list: Tile[], c: PoseChoice | null, secs: number, extra: Partial<PoseInput> = {}) => {
    let ghosts: Tile[] = [];
    for (let t = 0; t < secs; t += 0.016) {
      ghosts = pose.apply(list, input({ choice: c, hoverKey: c?.key ?? null, focusIdx: c ? 0 : null, ...extra }));
    }
    return ghosts;
  };

  it("takes the chosen tile to its box, about twice its size, drawn last", () => {
    const pose = createPose(videos);
    const list = wall();
    run(pose, list, choice(), 0.6);
    const top = list[list.length - 1];
    expect(top.key).toBe("2,2");
    expect(top.cx).toBeCloseTo(rc.x, 3);
    expect(top.cy).toBeCloseTo(rc.y, 3);
    expect(top.w).toBeCloseTo(rect.w, 3);
    expect(top.h).toBeCloseTo(rect.h, 3);
    expect(top.dim).toBeCloseTo(1, 6);
    expect(top.fade).toBeCloseTo(1, 6);
    expect(top.rad).toBeCloseTo(20, 3);
  });

  it("spreads the others away from the box, smaller and dimmer, and leaves the far ones in place", () => {
    const pose = createPose(videos);
    const list = wall();
    const before = new Map(list.map((t) => [t.key, { x: t.x + size.cw / 2, y: t.y + size.ch / 2 }]));
    run(pose, list, choice(), 0.6);
    for (const t of list) {
      if (t.key === "2,2") continue;
      expect(t.w).toBeCloseTo(size.cw * SPREAD_SCALE, 3);
      const b = before.get(t.key)!;
      const moved = Math.hypot(t.cx - b.x, t.cy - b.y);
      expect(moved).toBeLessThanOrEqual(140 + 1e-6);
      // farther from the middle than before (or no closer)
      expect(Math.hypot(t.cx - rc.x, t.cy - rc.y)).toBeGreaterThanOrEqual(Math.hypot(b.x - rc.x, b.y - rc.y) - 1e-6);
      if (Math.hypot(b.x - rc.x, b.y - rc.y) > 0.6 * Math.hypot(vw / 2, vh / 2)) expect(moved).toBeLessThan(1e-6);
    }
    // 0,1 (video 1, channel B) is far from the middle: not moved, not in the way, still drawn, at 55%
    const far = by(list, "0,1");
    expect(far.dim).toBeCloseTo(SPREAD_DIM, 3);
    expect(far.fade).toBe(1);
  });

  it("is still once open, and moving while it opens, closes or the choice changes", () => {
    const pose = createPose(videos);
    const list = wall();
    run(pose, list, choice(), 0.2);
    expect(pose.moving()).toBe(true);
    run(pose, list, choice(), 1.2);
    expect(pose.moving()).toBe(false);
    run(pose, list, choice({ key: "3,2" }), 0.05);
    expect(pose.moving()).toBe(true);
    run(pose, list, choice({ key: "3,2" }), 1.2);
    expect(pose.moving()).toBe(false);
    run(pose, list, choice({ key: "3,2", live: false }), 0.05);
    expect(pose.moving()).toBe(true);
    run(pose, list, null, 0.016);
    expect(pose.moving()).toBe(true);
  });

  it("keeps the channel's other videos bright, and dims the rest to 55%", () => {
    const pose = createPose(videos);
    const list = wall();
    // videos 0, 2 and 3 are channel A (the chosen one is video 0); video 1 is channel B
    run(pose, list, choice({ key: "0,0" }), 1);
    const same = list.filter((t) => (t.idx === 2 || t.idx === 3) && t.fade === 1);
    const other = list.filter((t) => t.idx === 1 && t.fade === 1);
    expect(same.length).toBeGreaterThan(0);
    expect(other.length).toBeGreaterThan(0);
    for (const t of same) expect(t.dim).toBeGreaterThan(0.95);
    for (const t of other) expect(t.dim).toBeCloseTo(SPREAD_DIM, 3);
  });

  it("fades out the tiles that would stand in the text block, and no visible tile is left there", () => {
    const pose = createPose(videos);
    const list = wall();
    run(pose, list, choice(), 1);
    const z = textZone(rect, vw);
    const faded = list.filter((t) => t.fade < 0.01);
    expect(faded.length).toBeGreaterThan(0);
    for (const t of list) {
      if (t.key === "2,2" || t.fade < 0.01) continue;
      const clear =
        t.cx + t.w / 2 <= z.x || t.cx - t.w / 2 >= z.x + z.w || t.cy + t.h / 2 <= z.y || t.cy - t.h / 2 >= z.y + z.h;
      expect(clear).toBe(true);
    }
  });

  it("opens in about 420 ms and closes in about 320 ms", () => {
    const pose = createPose(videos);
    const list = wall();
    run(pose, list, choice(), 0.2);
    const mid = by(list, "2,2").w;
    expect(mid).toBeGreaterThan(size.cw);
    expect(mid).toBeLessThan(rect.w);
    run(pose, list, choice(), 0.3); // 0.5 s in: open
    expect(by(list, "2,2").w).toBeCloseTo(rect.w, 3);
    run(pose, list, choice({ live: false }), 0.25);
    expect(by(list, "2,2").w).toBeLessThan(rect.w);
    run(pose, list, choice({ live: false }), 0.1); // 0.35 s into the close: settled
    for (const t of list) {
      expect(t.w).toBeCloseTo(size.cw, 3);
      expect(t.dim).toBeCloseTo(1, 3);
      expect(t.fade).toBeCloseTo(1, 3);
      expect(t.cx).toBeCloseTo(t.x + size.cw / 2, 3);
    }
  });

  it("moves the choice: the old tile goes back, the new one travels", () => {
    const pose = createPose(videos);
    const list = wall();
    run(pose, list, choice(), 0.6);
    run(pose, list, choice({ key: "3,2" }), 0.7);
    expect(by(list, "3,2").w).toBeCloseTo(rect.w, 3);
    expect(by(list, "3,2").cx).toBeCloseTo(rc.x, 3);
    expect(by(list, "2,2").w).toBeLessThan(size.cw);
    expect(list[list.length - 1].key).toBe("3,2");
  });

  it("with reduced motion nothing moves or scales: the chosen video fades in at its box, its tile fades out", () => {
    const pose = createPose(videos);
    const list = wall();
    const ghosts = run(pose, list, choice(), 0.1, { reduced: true });
    const mid = by(list, "2,2");
    expect(mid.cx).toBeCloseTo(rc.x, 6);
    expect(mid.w).toBeCloseTo(rect.w, 6);
    expect(mid.fade).toBeGreaterThan(0);
    expect(mid.fade).toBeLessThan(1);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].cx).toBeCloseTo(ghosts[0].x + size.cw / 2, 6);
    expect(ghosts[0].fade).toBeCloseTo(1 - mid.fade, 6);
    run(pose, list, choice(), 0.6, { reduced: true });
    for (const t of list) {
      if (t.key === "2,2") continue;
      expect(t.cx).toBeCloseTo(t.x + size.cw / 2, 9);
      expect(t.cy).toBeCloseTo(t.y + size.ch / 2, 9);
      expect(t.w).toBeCloseTo(size.cw, 9);
    }
    expect(by(list, "0,1").dim).toBeCloseTo(SPREAD_DIM, 3);
    expect(run(pose, list, choice(), 0.1, { reduced: true })).toHaveLength(0);
  });

  it("has no effect with no choice, and forgets the opening on reset", () => {
    const pose = createPose(videos);
    const list = wall();
    run(pose, list, choice(), 0.6);
    pose.reset();
    run(pose, list, null, 0.016);
    for (const t of list) {
      expect(t.dim).toBe(1);
      expect(t.fade).toBe(1);
      expect(t.c).toBe(0);
      expect(t.w).toBe(size.cw);
    }
  });
});

describe("no two visible tiles overlap once the wall is open", () => {
  const SIZES: Array<[number, number]> = [
    [320, 568],
    [390, 844],
    [820, 1180],
    [1024, 768],
    [1440, 900],
    [2560, 1440],
  ];
  const vids = Array.from({ length: 109 }, (_, i) => ({ channel: `c${i % 9}` }));
  it.each(SIZES)("at %i by %i, whichever tile is chosen and however the wall has drifted", (vw, vh) => {
    const plan = blockPlan(vids.length, vw, vh);
    const sz = sizeOfPlan(plan);
    const [cx0, cy0] = centredPan(plan, vw, vh);
    const { rect, zone } = choiceLayout(vw, vh);
    const place = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    for (const pan of [0, 137, 311]) {
      const start = { x: cx0 + pan, y: cy0 + pan / 3 };
      const view = { viewX: start.x, viewY: start.y, vw, vh, plan, count: vids.length };
      const base = layoutTiles(view);
      const near = [...base].sort(
        (a, b) =>
          Math.hypot(a.x - vw / 2, a.y - vh / 2) - Math.hypot(b.x - vw / 2, b.y - vh / 2),
      );
      // the tile nearest the middle, one at the far corner and one in between
      for (const pick of [near[0], near[Math.floor(near.length / 2)], near[near.length - 1]]) {
        const pose = createPose(vids);
        const end = cameraPan({ idx: pick.idx, plan, place, vw, vh });
        const c: PoseChoice = {
          key: pick.key,
          live: true,
          rect,
          zone,
          halfDiag: Math.hypot(vw / 2, vh / 2),
          shift: { x: 0, y: 0 },
        };
        // the camera travels from the drifted pan to the tile's, the tiles laid out afresh each frame
        let list: Tile[] = [];
        const FRAMES = 40;
        for (let i = 0; i < FRAMES + 50; i++) {
          const e = easeInOut(Math.min(1, i / FRAMES));
          const v = { x: start.x + (end.x - start.x) * e, y: start.y + (end.y - start.y) * e };
          list = layoutTiles({ ...view, viewX: v.x, viewY: v.y, also: [start, end] }).map(
            (l): Tile => ({ ...l, f: 0, e: 0, c: 0, dim: 1, fade: 1, cx: 0, cy: 0, w: 0, h: 0, rad: 0 }),
          );
          c.shift = { x: v.x - end.x, y: v.y - end.y };
          pose.apply(list, { dt: 0.016, size: sz, hoverKey: c.key, point: null, focusIdx: pick.idx, reduced: false, choice: c });
        }
        const others = list.filter((l) => l.key !== pick.key && l.fade >= 0.02);
        expect(others.length).toBeGreaterThan(0);
        const box = (l: Tile) => ({ x: l.cx - l.w / 2, y: l.cy - l.h / 2, w: l.w, h: l.h });
        for (let i = 0; i < others.length; i++) {
          for (let j = i + 1; j < others.length; j++) {
            expect(crosses(box(others[i]), box(others[j]))).toBe(false);
          }
          expect(crosses(box(others[i]), zone)).toBe(false);
        }
        expect(countOverlaps(list, c)).toBe(0);
        // the chosen tile ends on the chosen place and the picture's size
        const chosen = list.find((l) => l.key === pick.key) as Tile;
        expect(chosen.cx).toBeCloseTo(place.x, 3);
        expect(chosen.cy).toBeCloseTo(place.y, 3);
        expect(chosen.w).toBeCloseTo(rect.w, 3);
      }
    }
  });
});

describe("picturesSettled", () => {
  it("needs every picture up and its fade over", () => {
    expect(picturesSettled(undefined, 5000)).toBe(false);
    expect(picturesSettled(new Float64Array(0), 5000)).toBe(false);
    expect(picturesSettled(Float64Array.from([100, 0, 200]), 5000)).toBe(false);
    expect(picturesSettled(Float64Array.from([100, 300, 200]), 1000)).toBe(false);
    expect(picturesSettled(Float64Array.from([100, 300, 200]), 1600)).toBe(true);
  });

  it("counts a picture that failed for good as settled, once its own wait is over", () => {
    const loaded = Float64Array.from([100, 0, 200]);
    const failed = Float64Array.from([0, 400, 0]);
    expect(picturesSettled(loaded, 5000)).toBe(false); // the dead one alone keeps the wall busy
    expect(picturesSettled(loaded, 5000, undefined, failed)).toBe(true);
    expect(picturesSettled(loaded, 1500, undefined, failed)).toBe(false); // 400 + 1200 not over yet
    expect(picturesSettled(Float64Array.from([100, 0, 0]), 5000, undefined, failed)).toBe(false); // another still loading
  });
});
