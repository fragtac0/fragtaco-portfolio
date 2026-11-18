import { describe, expect, it } from "vitest";
import { ENTRANCE, TRACE_END_MS, beadDelay } from "./entrance";
import { INSTANT_MS, createEntrance, type BeadEl } from "./entrance-driver";
import { MILESTONE_SHARES } from "./trail";

function bead(): BeadEl & { attrs: Set<string> } {
  const attrs = new Set<string>();

  return { attrs, setAttribute: (n) => void attrs.add(n), removeAttribute: (n) => void attrs.delete(n) };
}
const make = (waiting = true, calm = false) => {
  const beads = MILESTONE_SHARES.map(() => bead());
  const ended: number[] = [];

  return { beads, ended, e: createEntrance(beads, MILESTONE_SHARES, () => calm, waiting, () => ended.push(1)), calm };
};

describe("the entrance driver", () => {
  it("starts with every bead hidden and nothing drawn, and does not ask for a frame until the reveal's end is known", () => {
    const { beads, e } = make();

    expect(beads.every((b) => b.attrs.has("data-wait"))).toBe(true);
    expect(e.step(100)).toEqual({ share: 0, ahead: 0, alpha: 0, radar: null });
    expect(e.live()).toBe(false);
    expect(e.wakes(100)).toBe(false);
  });

  it("draws nothing before the reveal ends, then begins at the first frame at or after it", () => {
    const { e } = make();

    e.start(2250);
    expect(e.live()).toBe(true);
    expect(e.wakes(2000)).toBe(false); // waiting: no frames drawn for it
    expect(e.step(2000).share).toBe(0);
    expect(e.wakes(2260)).toBe(true);
    expect(e.step(2260).share).toBe(0); // the first frame is the trace's own 0
    expect(e.step(2260 + 1100).share).toBeCloseTo(0.5, 6);
  });

  it("begins when the map is ready if that is after the reveal ended (the trace's clock starts at its first frame)", () => {
    const { e } = make();

    e.start(1000);
    expect(e.step(5000).share).toBe(0);
    expect(e.step(5000 + 1100).share).toBeCloseTo(0.5, 6);
  });

  it("opens each bead when the tip reaches it, the last when the trail arrives", () => {
    const { beads, e } = make();

    e.start(0);
    e.step(0);
    expect(beads[0].attrs.has("data-wait")).toBe(false); // the first is at the start of the trail
    expect(beads[0].attrs.has("data-enter")).toBe(true);
    expect(beads[1].attrs.has("data-wait")).toBe(true);
    MILESTONE_SHARES.forEach((u, i) => {
      e.step(beadDelay(u) - 1);
      expect(beads[i].attrs.has("data-wait")).toBe(i === 0 ? false : true);
      e.step(beadDelay(u) + 1);
      expect(beads[i].attrs.has("data-wait")).toBe(false);
    });
  });

  it("starts the radar when the trail arrives, not before, and draws the way ahead after it", () => {
    const { e } = make();

    e.start(0);
    e.step(0);
    expect(e.step(ENTRANCE.traceMs - 1).radar).toBeNull();
    expect(e.step(ENTRANCE.traceMs).radar).toBe(ENTRANCE.traceMs);
    expect(e.step(ENTRANCE.traceMs + 50).ahead).toBe(0);
    expect(e.step(ENTRANCE.traceMs + 400).ahead).toBeGreaterThan(0);
    expect(e.step(TRACE_END_MS).ahead).toBe(1);
  });

  it("is over once the way ahead has arrived: everything full, the radar kept, no more frames asked", () => {
    const { beads, e } = make();

    e.start(0);
    e.step(0);
    expect(e.step(TRACE_END_MS + 10)).toEqual({ share: 1, ahead: 1, alpha: 1, radar: ENTRANCE.traceMs });
    expect(e.live()).toBe(false);
    expect(e.wakes(TRACE_END_MS + 20)).toBe(false);
    expect(beads.every((b) => !b.attrs.has("data-wait") && !b.attrs.has("data-enter"))).toBe(true);
    expect(e.step(TRACE_END_MS + 5000).radar).toBe(ENTRANCE.traceMs); // the radar's clock does not change when the entrance is over
  });

  it("tells onEnd once when the trace has drawn its last frame, under reduced motion when the fade has ended, and never when it was finished early", () => {
    const full = make();

    full.e.start(0);
    full.e.step(0);
    full.e.step(TRACE_END_MS - 1);
    expect(full.ended).toEqual([]);
    full.e.step(TRACE_END_MS);
    full.e.step(TRACE_END_MS + 20);
    expect(full.ended).toEqual([1]);

    const calm = make(true, true);

    calm.e.start(0);
    calm.e.step(0);
    calm.e.step(ENTRANCE.reducedMs + 299);
    expect(calm.ended).toEqual([]);
    calm.e.step(ENTRANCE.reducedMs + 300);
    expect(calm.ended).toEqual([1]);

    const cut = make();

    cut.e.start(0);
    cut.e.step(100);
    cut.e.finish(200);
    cut.e.step(5000);
    expect(cut.ended).toEqual([]);
  });

  it("finishes at once: every bead shown with no transition, everything drawn, the radar from now", () => {
    const { beads, e } = make();

    e.start(500);
    e.step(500);
    e.step(900);
    e.finish(1234);
    expect(beads.every((b) => !b.attrs.has("data-wait") && b.attrs.has("data-instant"))).toBe(true);
    expect(e.step(1250)).toEqual({ share: 1, ahead: 1, alpha: 1, radar: 1234 });
    expect(e.live()).toBe(true); // until the beads' no-transition mark is off (below)
    e.step(1234 + INSTANT_MS);
    expect(e.live()).toBe(false);
  });

  it("keeps asking for frames after a finish until the no-transition mark is off, whatever the motion (a loop that stops with it on leaves the beads without their own transitions)", () => {
    for (const calm of [false, true]) {
      const { beads, e } = make(true, calm);

      e.finish(1000);
      expect(e.live()).toBe(true);
      expect(e.wakes(1000)).toBe(false); // nothing is drawn again for it: only the mark comes off
      e.settle(1000 + INSTANT_MS - 1);
      expect(e.live()).toBe(true);
      expect(beads.every((b) => b.attrs.has("data-instant"))).toBe(true);
      e.settle(1000 + INSTANT_MS);
      expect(beads.every((b) => !b.attrs.has("data-instant"))).toBe(true);
      expect(e.live()).toBe(false);
    }
  });

  it("takes the no-transition mark off again a moment after a finish, so the beads' own transitions are theirs afterwards", () => {
    const { beads, e } = make();

    e.finish(1000);
    e.step(1000 + INSTANT_MS - 1);
    expect(beads.every((b) => b.attrs.has("data-instant"))).toBe(true);
    e.step(1000 + INSTANT_MS);
    expect(beads.every((b) => !b.attrs.has("data-instant"))).toBe(true);
  });

  it("finishes at once before the reveal has ended too, and then ignores start", () => {
    const { beads, e } = make();

    e.finish(10);
    e.start(5000);
    expect(beads.every((b) => !b.attrs.has("data-wait"))).toBe(true);
    expect(e.step(20)).toEqual({ share: 1, ahead: 1, alpha: 1, radar: 10 });
    e.step(10 + INSTANT_MS);
    expect(e.live()).toBe(false);
  });

  it("is already over for a map made after the entrance (nothing hidden, the radar from the start)", () => {
    const { beads, e } = make(false);

    expect(beads.every((b) => b.attrs.size === 0)).toBe(true);
    expect(e.step(77)).toEqual({ share: 1, ahead: 1, alpha: 1, radar: 0 });
    e.start(100);
    expect(e.live()).toBe(false);
  });

  it("under reduced motion draws no trace: every bead opens together and the trail and its way ahead fade in over 200 ms, the radar then", () => {
    const { beads, e } = make(true, true);

    e.start(1000);
    expect(e.step(999).alpha).toBe(0);

    const first = e.step(1000);

    expect(first).toMatchObject({ share: 1, ahead: 1, alpha: 0, radar: null });
    expect(beads.every((b) => !b.attrs.has("data-wait"))).toBe(true);
    expect(e.step(1100).alpha).toBeCloseTo(0.5, 6);
    expect(e.step(1000 + ENTRANCE.reducedMs).radar).toBe(1000 + ENTRANCE.reducedMs);
    expect(e.step(1000 + ENTRANCE.reducedMs).alpha).toBe(1);
    e.step(1000 + ENTRANCE.reducedMs + 400);
    expect(e.live()).toBe(false);
  });
});
