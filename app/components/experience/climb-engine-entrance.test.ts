import { describe, expect, it } from "vitest";
import { ENTRANCE, TRACE_END_MS, beadDelay } from "./entrance";
import { setup, started } from "./climb-engine-fixtures";
import { MILESTONE_SHARES } from "./trail";

/** The strokes of the trail's own lines in one drawing: the dark line, the cream line and the dotted way ahead (the chart's grid is also on that canvas). */
const TRAIL_STROKES = 3;

describe("the entrance in the engine (spec 8)", () => {
  it("draws the chart but no trail, no bead and no radar before the entrance starts; a map with no entrance draws all of them", () => {
    const waiting = setup({ entrance: true });
    const plain = setup();

    started(waiting.engine, waiting.f);
    started(plain.engine, plain.f);
    const drawings = (plain.trailCalls.clearRect ?? 0) - (waiting.trailCalls.clearRect ?? 0);

    expect(drawings).toBe(0); // both drew the same number of times: only what was drawn differs
    expect((plain.trailCalls.stroke - waiting.trailCalls.stroke) % TRAIL_STROKES).toBe(0);
    expect(plain.trailCalls.stroke - waiting.trailCalls.stroke).toBeGreaterThanOrEqual(TRAIL_STROKES);
    expect(waiting.radarCalls.stroke ?? 0).toBe(0);
    expect(plain.radarCalls.stroke).toBeGreaterThan(0);
    expect(waiting.layers.pins.every((p) => p.attrs.has("data-wait"))).toBe(true);
    expect(plain.layers.pins.every((p) => p.attrs.size === 0)).toBe(true);
    expect(waiting.frameCalls.stroke).toBeGreaterThan(0); // the frame of the chart is there
  });

  it("traces the trail from the time it is given, opens each bead as the tip reaches it, starts the radar when it arrives and is quiet after", () => {
    const { engine, f, layers, trailCalls, radarCalls } = setup({ entrance: true });

    started(engine, f); // the clock is at 50 ms
    const before = trailCalls.stroke;

    engine.startEntrance(1000);
    f.run(900);
    expect(trailCalls.stroke).toBe(before); // nothing is drawn again while the reveal runs
    expect(layers.pins[0].attrs.has("data-wait")).toBe(true);

    f.run(150); // 1050: the trace has begun
    expect(layers.pins[0].attrs.has("data-wait")).toBe(false);
    expect(layers.pins[1].attrs.has("data-wait")).toBe(true);
    // the tip reaches the second milestone at beadDelay(0.3) after the trace began (about 1000 + 930 ms)
    f.run(beadDelay(MILESTONE_SHARES[1]) - 100);
    expect(layers.pins[1].attrs.has("data-wait")).toBe(true);
    f.run(250);
    expect(layers.pins[1].attrs.has("data-wait")).toBe(false);
    expect(layers.pins[8].attrs.has("data-wait")).toBe(true);
    expect(radarCalls.stroke ?? 0).toBe(0);
    f.run(ENTRANCE.traceMs - 400);
    expect(layers.pins.every((p) => !p.attrs.has("data-wait"))).toBe(true);
    expect(radarCalls.stroke).toBeGreaterThan(0);
    f.run(TRACE_END_MS);
    expect(layers.pins.every((p) => !p.attrs.has("data-wait") && !p.attrs.has("data-enter"))).toBe(true);
  });

  it("starts the trace at the first frame when the reveal ended before the map was ready", () => {
    const { engine, f, layers } = setup({ entrance: true });

    started(engine, f);
    f.run(3000);
    engine.startEntrance(100); // long past
    f.run(20);
    expect(layers.pins[0].attrs.has("data-wait")).toBe(false); // the first bead is at the start of the trail
    expect(layers.pins[1].attrs.has("data-wait")).toBe(true);
  });

  it("finishes at once: every bead is shown with no transition and the whole trail is drawn at the next frame", () => {
    const waiting = setup({ entrance: true });
    const plain = setup();

    started(waiting.engine, waiting.f);
    started(plain.engine, plain.f);
    waiting.engine.startEntrance(1000);
    waiting.f.run(1500);
    waiting.engine.finishEntrance();
    waiting.f.run(20);
    expect(waiting.layers.pins.every((p) => !p.attrs.has("data-wait") && p.attrs.has("data-instant"))).toBe(true);

    const full = waiting.trailCalls.stroke;

    waiting.f.run(200);
    expect(waiting.trailCalls.stroke).toBe(full); // drawn once, then nothing moves
    expect(waiting.radarCalls.stroke).toBeGreaterThan(0);
  });

  it("under reduced motion draws no trace: the beads open together and the loop stops once it is over", () => {
    const { engine, f, layers } = setup({ entrance: true, reduced: true });

    started(engine, f);
    engine.startEntrance(1000);
    f.run(1010);
    expect(layers.pins.every((p) => !p.attrs.has("data-wait"))).toBe(true);
    f.run(1000);
    expect(f.pending()).toBe(0);
  });

  it("takes the beads' no-transition mark off a moment after a finish and then stops asking for frames, also under reduced motion (the loop used to stop with the mark still on)", () => {
    for (const reduced of [false, true]) {
      const { engine, f, layers } = setup({ entrance: true, reduced });

      started(engine, f);
      engine.startEntrance(1000);
      f.run(100);
      engine.finishEntrance();
      f.run(30);
      expect(layers.pins.every((p) => p.attrs.has("data-instant"))).toBe(true);
      f.run(300);
      expect(layers.pins.every((p) => !p.attrs.has("data-instant") && !p.attrs.has("data-wait"))).toBe(true);
      if (reduced) expect(f.pending()).toBe(0); // and the loop has stopped
    }
  });

  it("tells onEntranceEnd once, when the trace has drawn its last frame", () => {
    const ended: number[] = [];
    const { engine, f } = setup({ entrance: true, onEntranceEnd: () => ended.push(1) });

    started(engine, f);
    engine.startEntrance(1000);
    f.run(1000 + TRACE_END_MS - 100 - 50);
    expect(ended).toEqual([]);
    f.run(400);
    expect(ended).toEqual([1]);
    f.run(2000);
    expect(ended).toEqual([1]);
  });

  it("does not hold the loop for an entrance that has not been told when to start (a map waiting for its reveal draws nothing again)", () => {
    const { engine, f, trailCalls } = setup({ entrance: true, reduced: true });

    started(engine, f);
    expect(f.pending()).toBe(0);

    const n = trailCalls.stroke;

    f.run(1000);
    expect(trailCalls.stroke).toBe(n);
  });
});
