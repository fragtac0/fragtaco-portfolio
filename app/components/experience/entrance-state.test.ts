import { describe, expect, it } from "vitest";
import type { Reveal } from "../../lib/change-state";
import { WAITING, nextEntrance, quietLength, type EntranceState } from "./entrance-state";

const reveal = (over: Partial<Reveal>): Reveal => ({ phase: "run", at: 1000, ms: 2250, skipped: false, ...over });

describe("nextEntrance", () => {
  it("waits while the change holds its reveal", () => {
    expect(nextEntrance(WAITING, { type: "reveal", reveal: reveal({ phase: "hold", at: null }), now: 900 })).toEqual(WAITING);
  });

  it("plays from the reveal's start, for the reveal's length, with the lag of learning of it", () => {
    expect(nextEntrance(WAITING, { type: "reveal", reveal: reveal({}), now: 1016 })).toEqual({ phase: "play", t0: 1000, ms: 2250, lag: 16 });
    expect(nextEntrance(WAITING, { type: "reveal", reveal: reveal({ ms: 120 }), now: 1000 })).toEqual({ phase: "play", t0: 1000, ms: 120, lag: 0 });
  });

  it("does not start again when the reveal's phase changes while it plays, and the natural end of the change changes nothing", () => {
    const playing: EntranceState = { phase: "play", t0: 1000, ms: 2250, lag: 0 };

    expect(nextEntrance(playing, { type: "reveal", reveal: reveal({}), now: 1500 })).toBe(playing);
    expect(nextEntrance(playing, { type: "reveal", reveal: reveal({ phase: "over" }), now: 3250 })).toBe(playing);
  });

  it("is done at once when the change was cut short, whether it was waiting, playing or had not begun", () => {
    const cut = reveal({ phase: "over", skipped: true });

    expect(nextEntrance(WAITING, { type: "reveal", reveal: cut, now: 2000 })).toEqual({ phase: "done" });
    expect(nextEntrance({ phase: "play", t0: 1000, ms: 2250, lag: 0 }, { type: "reveal", reveal: cut, now: 2000 })).toEqual({ phase: "done" });
    expect(nextEntrance(WAITING, { type: "reveal", reveal: reveal({ phase: "over", at: null, skipped: true }), now: 2000 })).toEqual({ phase: "done" });
  });

  it("plays when a late page learns of a reveal that has already run its length", () => {
    expect(nextEntrance(WAITING, { type: "reveal", reveal: reveal({ phase: "over" }), now: 3300 })).toEqual({ phase: "play", t0: 1000, ms: 2250, lag: 2300 });
  });

  it("counts a first load or a deep link from the moment the picture is shown, with the same length (none under reduced motion)", () => {
    expect(nextEntrance(WAITING, { type: "picture", now: 500, reduced: false })).toEqual({ phase: "play", t0: 500, ms: 2250, lag: 0 });
    expect(nextEntrance(WAITING, { type: "picture", now: 500, reduced: true })).toEqual({ phase: "play", t0: 500, ms: 0, lag: 0 });
    expect(quietLength(false)).toBe(2250);
    expect(quietLength(true)).toBe(0);
  });

  it("ignores a picture once playing", () => {
    const playing: EntranceState = { phase: "play", t0: 1000, ms: 2250, lag: 0 };

    expect(nextEntrance(playing, { type: "picture", now: 1200, reduced: false })).toBe(playing);
  });

  it("finishes at once on a press, from waiting or playing, and is then done for good", () => {
    expect(nextEntrance(WAITING, { type: "press" })).toEqual({ phase: "done" });
    expect(nextEntrance({ phase: "play", t0: 1, ms: 2, lag: 0 }, { type: "press" })).toEqual({ phase: "done" });

    const done = nextEntrance(WAITING, { type: "press" });

    expect(nextEntrance(done, { type: "picture", now: 5, reduced: false })).toBe(done);
    expect(nextEntrance(done, { type: "reveal", reveal: reveal({}), now: 1 })).toBe(done);
  });

  it("ends when it has run its length, but not before it began", () => {
    expect(nextEntrance({ phase: "play", t0: 1, ms: 2, lag: 0 }, { type: "end" })).toEqual({ phase: "done" });
    expect(nextEntrance(WAITING, { type: "end" })).toEqual(WAITING);
  });
});
