import { describe, expect, it } from "vitest";
import type { Reveal } from "../../lib/change-state";
import { ENGINE_GRACE_MS, END_SLACK_MS, PICTURE_MAX_AGE_MS, WAITING, endDelay, nextEntrance, quietLength, shownAtOf, type EntranceState } from "./entrance-state";
import { entranceEnd } from "./entrance";

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

describe("endDelay", () => {
  const play = { t0: 1000, ms: 2250 };

  it("where no map draws a trace, is the entrance's nominal end and a slack", () => {
    expect(endDelay(play, 1000, false)).toBe(entranceEnd(2250) + END_SLACK_MS);
    expect(endDelay(play, 4000, false)).toBe(entranceEnd(2250) + END_SLACK_MS - 3000);
  });

  it("where the map draws it, waits for the map to say it is over: the page's clock is a failsafe a grace past the nominal end (a trace that began late is not cut)", () => {
    expect(endDelay(play, 1000, true)).toBe(entranceEnd(2250) + ENGINE_GRACE_MS);
    expect(ENGINE_GRACE_MS).toBeGreaterThan(END_SLACK_MS * 10);
  });

  it("is never negative", () => {
    expect(endDelay(play, 1e6, true)).toBe(0);
  });
});

describe("the first load counts from the picture's showing", () => {
  it("plays from `at`, with the time since as its lag, not from the moment the script woke", () => {
    expect(nextEntrance(WAITING, { type: "picture", now: 1500, at: 400, reduced: false })).toEqual({ phase: "play", t0: 400, ms: 2250, lag: 1100 });
    expect(nextEntrance(WAITING, { type: "picture", now: 1500, reduced: false })).toEqual({ phase: "play", t0: 1500, ms: 2250, lag: 0 });
    expect(nextEntrance(WAITING, { type: "picture", now: 1500, at: 400, reduced: true })).toMatchObject({ ms: 0, t0: 400 });
  });

  it("never plays from the future", () => {
    expect(nextEntrance(WAITING, { type: "picture", now: 100, at: 400, reduced: false })).toMatchObject({ t0: 100, lag: 0 });
  });

  it("shownAtOf reads when the picture finished arriving from the last timeline entry", () => {
    expect(shownAtOf([{ responseEnd: 200 }, { responseEnd: 450 }], 900)).toBe(450);
    expect(shownAtOf([{ responseEnd: 450 }], 300)).toBe(300);
  });

  it("shownAtOf says now where it cannot know: no entry, an entry with no end, or one older than the page's wake", () => {
    expect(shownAtOf([], 900)).toBe(900);
    expect(shownAtOf([{ responseEnd: 0 }], 900)).toBe(900);
    expect(shownAtOf([{ responseEnd: 100 }], 100 + PICTURE_MAX_AGE_MS + 1)).toBe(100 + PICTURE_MAX_AGE_MS + 1);
    expect(shownAtOf([{ responseEnd: 100 }], 100 + PICTURE_MAX_AGE_MS)).toBe(100);
  });
});
