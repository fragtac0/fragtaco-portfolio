import { describe, expect, it } from "vitest";
import {
  CLEAR_AT,
  MAX_MS,
  MOST_UNDER,
  MAX_FRAME_MS,
  PEAK_RATE,
  RAMP_MS,
  chooseWay,
  clearAtOnce,
  clearFromDock,
  needsClearing,
  pressure,
  turnRate,
  underShare,
  type Box,
  type Frames,
  type Turner,
} from "./ring-focus";

const dock: Box = { l: 500, t: 780, r: 940, b: 880 };
const tile = (x: number, y = 800, w = 200, h = 112): Box => ({ l: x, t: y, r: x + w, b: y + h });

describe("underShare", () => {
  it("is the share of the tile's area inside the dock", () => {
    expect(underShare(tile(600), dock)).toBeCloseTo(80 / 112, 6); // the tile is 112 tall, the dock's foot cuts 32 off
    expect(underShare(tile(400), dock)).toBeCloseTo((100 * 80) / (200 * 112), 6); // half its width out to the left, the dock's foot cuts it
    expect(underShare(tile(100), dock)).toBe(0);
    expect(underShare(tile(600, 100), dock)).toBe(0);
  });
  it("is 0 with no dock or a tile of no size", () => {
    expect(underShare(tile(600), null)).toBe(0);
    expect(underShare({ l: 5, t: 5, r: 5, b: 9 }, dock)).toBe(0);
  });
  it("is 1 for a tile wholly inside the dock", () => {
    expect(underShare({ l: 520, t: 790, r: 620, b: 840 }, dock)).toBe(1);
  });
});

describe("needsClearing", () => {
  it("is true only for more than half under the dock", () => {
    expect(MOST_UNDER).toBe(0.5);
    expect(needsClearing(tile(600), dock)).toBe(true);
    expect(needsClearing({ l: 0, t: 800, r: 100, b: 850 }, { l: 50, t: 0, r: 200, b: 900 })).toBe(false); // exactly half
    expect(needsClearing({ l: 0, t: 800, r: 100, b: 850 }, { l: 49, t: 0, r: 200, b: 900 })).toBe(true);
    expect(needsClearing(tile(100), dock)).toBe(false);
  });
});

describe("turnRate", () => {
  it("starts at the ring's own speed, builds to the peak and eases back to 1 as the tile comes out", () => {
    expect(turnRate(0, 1)).toBe(1);
    expect(turnRate(RAMP_MS, 1)).toBeCloseTo(PEAK_RATE, 9);
    expect(turnRate(RAMP_MS * 4, 0.9)).toBeCloseTo(PEAK_RATE, 9);
    expect(turnRate(RAMP_MS * 4, CLEAR_AT)).toBe(1);
    const out = [0.7, 0.6, 0.5, 0.4, 0.3].map((s) => turnRate(RAMP_MS * 4, s));
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeLessThanOrEqual(out[i - 1]);
  });
  it("never goes below 1 or above the peak", () => {
    for (let ms = 0; ms < 3000; ms += 70) for (const s of [0, 0.2, 0.3, 0.55, 0.8, 1]) {
      const r = turnRate(ms, s);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(PEAK_RATE);
    }
  });
});

/** A tile that moves right by `pxPerMs` of ring time, and frames that a test steps by hand. */
function world(startX: number, pxPerMs = 0.017, d: Box | null = dock, labelW = 0) {
  let x = startX;
  const turner: Turner & { advanced: number; moved: number } = {
    advanced: 0,
    moved: 0,
    box: () => tile(x),
    // a label on the tile's right, 14 px off, 30 tall at the tile's middle (as work.css draws it on the right side)
    label: labelW ? () => ({ l: x + 214, t: 800 + 41, r: x + 214 + labelW, b: 800 + 71 }) : undefined,
    dock: () => d,
    advance(ms) {
      this.advanced += Math.abs(ms);
      this.moved += ms;
      x += ms * pxPerMs;
    },
  };
  let queued: ((now: number) => void) | null = null;
  const frames: Frames & { tick(now: number): void; pending(): boolean } = {
    request(cb) {
      queued = cb;
      return 1;
    },
    cancel() {
      queued = null;
    },
    tick(now) {
      const cb = queued;
      queued = null;
      cb?.(now);
    },
    pending: () => queued !== null,
  };
  return { turner, frames, x: () => x };
}

describe("clearFromDock", () => {
  it("does nothing for a tile that is already clear (the ring never lurches when focus moves to it)", () => {
    const w = world(100);
    let done = 0;
    clearFromDock(w.turner, w.frames, () => done++);
    expect(w.frames.pending()).toBe(false);
    expect(w.turner.advanced).toBe(0);
    expect(done).toBe(0);
  });

  it("also leaves a tile that is only partly under the dock (up to half) where it is", () => {
    const w = world(400); // 100 of 200 px under the dock's side, the foot cuts it: well under half
    clearFromDock(w.turner, w.frames);
    expect(w.frames.pending()).toBe(false);
  });

  it("turns the ring until at most CLEAR_AT of the tile is under the dock, then stops and says so", () => {
    const w = world(620);
    let done = 0;
    clearFromDock(w.turner, w.frames, () => done++);
    let now = 0;
    for (let i = 0; i < 2000 && w.frames.pending(); i++, now += 16.67) w.frames.tick(now);
    expect(w.frames.pending()).toBe(false);
    expect(done).toBe(1);
    expect(underShare(tile(w.x()), dock)).toBeLessThanOrEqual(CLEAR_AT);
    expect(needsClearing(tile(w.x()), dock)).toBe(false);
  });

  it("starts gently: the first frame turns the ring by no more than a frame of its own time, and no frame jumps more than the peak allows", () => {
    const w = world(620);
    clearFromDock(w.turner, w.frames);
    w.turner.advanced = 0; // what looking for the way out turned and put back does not count
    w.frames.tick(1000);
    expect(w.turner.advanced).toBe(0); // the first frame only sets the clock
    let last = 0;
    let max = 0;
    for (let now = 1016; w.frames.pending() && now < 9000; now += 16) {
      w.frames.tick(now);
      max = Math.max(max, w.turner.advanced - last);
      last = w.turner.advanced;
    }
    expect(max).toBeLessThanOrEqual(16 * PEAK_RATE + 1e-6);
  });

  it("is stopped by the returned function (focus left), and does not call done twice", () => {
    const w = world(620);
    let done = 0;
    const stop = clearFromDock(w.turner, w.frames, () => done++);
    w.frames.tick(0);
    w.frames.tick(16);
    stop();
    stop();
    expect(w.frames.pending()).toBe(false);
    expect(done).toBe(1);
  });

  it("gives up after MAX_MS for a tile that never gets clear", () => {
    const w = world(620, 0);
    clearFromDock(w.turner, w.frames);
    let now = 0;
    for (; w.frames.pending() && now < MAX_MS * 2; now += 50) w.frames.tick(now);
    expect(w.frames.pending()).toBe(false);
    expect(now).toBeLessThanOrEqual(MAX_MS + 150);
  });

  it("caps a long frame, so a busy tab does not throw the ring on", () => {
    const w = world(620);
    clearFromDock(w.turner, w.frames);
    w.turner.advanced = 0;
    w.frames.tick(0);
    w.frames.tick(5000); // a 5 s frame
    expect(w.turner.advanced).toBeLessThanOrEqual(MAX_FRAME_MS * PEAK_RATE);
  });

  it("counts the turn's time by the frames' own capped times: a tab that was hidden for a minute does not end the turn at once", () => {
    const w = world(620, 0.002); // slow: the tile needs a long turn
    clearFromDock(w.turner, w.frames);
    w.frames.tick(0);
    w.frames.tick(16);
    w.frames.tick(60_000); // back after a minute: one capped frame, not 60 s of the turn
    expect(w.frames.pending()).toBe(true);
    w.frames.tick(60_016);
    expect(w.frames.pending()).toBe(true);
  });

  it("takes the shorter way out when it is at most half the ring's own way (a tile that has just entered goes back the way it came)", () => {
    const w = world(520); // the tile's left edge is 20 px in: 136 px back, 336 px on
    clearFromDock(w.turner, w.frames);
    let now = 0;
    for (let i = 0; i < 2000 && w.frames.pending(); i++, now += 16.67) w.frames.tick(now);
    expect(w.x()).toBeLessThan(520);
    expect(underShare(tile(w.x()), dock)).toBeLessThanOrEqual(CLEAR_AT);
    expect(w.turner.moved).toBeLessThan(0);
  });

  it("goes on the ring's own way when the other is not at most half as far", () => {
    const w = world(620); // 236 px either way
    clearFromDock(w.turner, w.frames);
    let now = 0;
    for (let i = 0; i < 2000 && w.frames.pending(); i++, now += 16.67) w.frames.tick(now);
    expect(w.x()).toBeGreaterThan(620);
    expect(w.turner.moved).toBeGreaterThan(0);
  });

  it("brings a tile whose label is under the dock clear, though the tile itself is not under it", () => {
    const w = world(300, 0.017, dock, 120); // the tile ends at 500, the dock's edge; its label (514 to 634) is under the glass
    expect(underShare(w.turner.box(), dock)).toBe(0);
    expect(needsClearing(w.turner.box(), dock, w.turner.label?.() ?? null)).toBe(true);
    let done = 0;
    clearFromDock(w.turner, w.frames, () => done++);
    let now = 0;
    for (let i = 0; i < 2000 && w.frames.pending(); i++, now += 16.67) w.frames.tick(now);
    expect(done).toBe(1);
    const label = w.turner.label?.();
    expect(label && underShare(label, dock)).toBe(0);
    expect(w.turner.moved).toBeLessThan(0); // back, away from the dock
  });

  it("ignores a label that no turn can clear (it is wider than the way round), and leaves such a tile alone when it is not more than half under", () => {
    const stuck = world(300, 0, dock, 120); // the ring does not move the tile at all
    stuck.turner.label = () => ({ l: 600, t: 830, r: 700, b: 860 });
    expect(chooseWay(stuck.turner, { stepMs: 400, maxSteps: 50 })).toBeNull();
    clearFromDock(stuck.turner, stuck.frames);
    expect(stuck.frames.pending()).toBe(false);
  });

  it("leaves the ring as it found it when it only looks for the way out", () => {
    const w = world(520);
    expect(chooseWay(w.turner, { stepMs: 400, maxSteps: 400 })).toEqual({ sign: -1, label: false });
    expect(w.x()).toBeCloseTo(520, 6);
  });
});

describe("pressure", () => {
  it("is the tile's own share when the label is clear, and above CLEAR_AT while any of the label is under the dock", () => {
    const labelClear: Box = { l: 100, t: 100, r: 200, b: 130 };
    expect(pressure(tile(100), dock, labelClear)).toBe(0);
    expect(pressure(tile(620), dock, labelClear)).toBeCloseTo(underShare(tile(620), dock), 9);
    const labelIn: Box = { l: 490, t: 800, r: 590, b: 830 }; // 90 of its 100 px under
    expect(pressure(tile(300), dock, labelIn)).toBeGreaterThan(CLEAR_AT);
    const labelEdge: Box = { l: 400, t: 800, r: 501, b: 830 }; // 1 px of 101 under
    expect(pressure(tile(300), dock, labelEdge)).toBeGreaterThan(CLEAR_AT);
    expect(pressure(tile(300), dock, labelEdge)).toBeLessThan(pressure(tile(300), dock, labelIn));
  });
});

describe("clearAtOnce", () => {
  it("does nothing for a tile that needs nothing, though some of it is under the dock (0.4 of it is under: not more than half)", () => {
    const w = world(400, 0.017, dock); // 100 of 200 px in; the dock's foot cuts it: well under half
    const share = underShare(w.turner.box(), dock);
    expect(share).toBeGreaterThan(CLEAR_AT);
    expect(share).toBeLessThan(MOST_UNDER);
    expect(clearAtOnce(w.turner, 400, 400)).toBe(0);
    expect(w.turner.advanced).toBe(0);
    expect(w.x()).toBe(400);
  });
  it("turns the ring in steps until the tile is clear, and reports the steps; none for a clear tile", () => {
    const w = world(620);
    const steps = clearAtOnce(w.turner, 400, 400);
    expect(steps).toBeGreaterThan(0);
    expect(needsClearing(tile(w.x()), dock)).toBe(false);
    expect(underShare(tile(w.x()), dock)).toBeLessThanOrEqual(CLEAR_AT);
    expect(clearAtOnce(world(100).turner, 400, 400)).toBe(0);
  });
  it("stops at its step limit", () => {
    expect(clearAtOnce(world(620, 0).turner, 400, 12)).toBe(12);
  });
});
