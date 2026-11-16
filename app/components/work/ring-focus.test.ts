import { describe, expect, it } from "vitest";
import {
  CLEAR_AT,
  MAX_MS,
  MOST_UNDER,
  PEAK_RATE,
  RAMP_MS,
  clearAtOnce,
  clearFromDock,
  needsClearing,
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
function world(startX: number, pxPerMs = 0.017, d: Box | null = dock) {
  let x = startX;
  const turner: Turner & { advanced: number } = {
    advanced: 0,
    box: () => tile(x),
    dock: () => d,
    advance(ms) {
      this.advanced += ms;
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
    w.frames.tick(0);
    w.frames.tick(5000); // a 5 s frame
    expect(w.turner.advanced).toBeLessThanOrEqual(50 * PEAK_RATE);
  });
});

describe("clearAtOnce", () => {
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
