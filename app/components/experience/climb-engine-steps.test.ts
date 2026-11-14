// The engine's steps in My climb (Task 18, fix round 1): a second press during the change in carries on with the same move (I2), a
// reduced-motion step redraws the night map across a short dip (I1), the engine leaves nothing behind (I3), and a bead near the
// right edge opens its label to the left (M5).
import { describe, expect, it } from "vitest";
import { IN_MS, kOf } from "./climb-change";
import { FLIP_AT, WAIT_ENTRY } from "./climb-engine";
import { HOP_MS } from "./climb-hop";
import { setup, started } from "./climb-engine-fixtures";

describe("a press during the change into My climb", () => {
  it("keeps the one camera move: k's step never stalls, and the card waits for what time is left", () => {
    const { engine, f, selects } = setup();

    started(engine, f);
    engine.go("climb", 8);
    f.run(1800 - 100); // about halfway: where the ease is fastest

    const ks: number[] = [];
    const frame = () => {
      f.run(1000 / 60);
      ks.push(engine.state().k);
    };

    for (let i = 0; i < 6; i++) frame();

    const pressed = ks.length;

    engine.go("climb", 2);
    expect(selects[1][0]).toBe(2);
    expect(Math.abs(selects[1][1] - (WAIT_ENTRY - 1700 - 6 * (1000 / 60)))).toBeLessThan(30);
    for (let i = 0; i < 6; i++) frame();
    while (engine.state().moving) frame();

    const steps = ks.slice(1).map((v, i) => v - ks[i]);
    const before = steps[pressed - 2];

    // the step right after the press is the step before it, not a new start from rest
    expect(steps[pressed - 1]).toBeGreaterThan(before * 0.9);
    expect(steps.slice(0, steps.length - 2).every((d, i) => i === 0 || d > steps[i - 1] * 0.5 || ks[i] > 0.9)).toBe(true);
    expect(ks[ks.length - 1]).toBe(1);
  });

  it("still starts a change when the target differs, or none is running and k is off target", () => {
    const { engine, f } = setup();

    started(engine, f);
    engine.go("climb", 4);
    f.run(1000);
    engine.go("overview");
    f.run(100);
    expect(engine.state().k).toBeLessThan(0.5);
    f.run(4000);
    expect(engine.state().k).toBe(kOf("overview"));
    engine.go("climb", 4);
    f.run(IN_MS + 100);
    expect(engine.state().k).toBe(1);
  });
});

describe("a step under reduced motion", () => {
  it("draws the night map again at the new place, across a dip of the layers, with no travel", () => {
    const { engine, f, layers, fills, selects } = setup({ reduced: true });

    started(engine, f);
    engine.go("climb", 0);
    f.run(1500);
    expect(layers.pinBox.style.opacity).toBe("1");
    expect(layers.terrain.style.opacity).toBe("1");

    const before = fills.length;
    const goal = engine.state().goal;

    engine.go("climb", 8);
    expect(engine.state().goal).not.toBe(goal);
    expect(selects[selects.length - 1][0]).toBe(8);
    f.run(HOP_MS / 4);
    expect(Number(layers.pinBox.style.opacity)).toBeGreaterThan(0.3);
    expect(Number(layers.pinBox.style.opacity)).toBeLessThan(1);
    expect(engine.state().u).toBe(goal); // not yet: it jumps in the middle of the dip
    f.run(HOP_MS / 4 + 40);
    expect(Number(layers.pinBox.style.opacity)).toBeLessThan(0.3);
    expect(engine.state().u).toBe(engine.state().goal);
    expect(Number(layers.terrain.style.opacity)).toBeLessThan(0.3);
    f.run(HOP_MS);
    expect(layers.pinBox.style.opacity).toBe("1");
    expect(layers.trail.style.opacity).toBe("1");
    expect(layers.terrain.style.opacity).toBe("1");
    expect(fills.length).toBeGreaterThan(before); // the night map was drawn again
    expect(engine.state().moving).toBe(false);
    expect(f.pending()).toBe(0);
  });

  it("makes no dip for a milestone already in view", () => {
    const { engine, f, layers } = setup({ reduced: true });

    started(engine, f);
    engine.go("climb", 8);
    f.run(1500);
    engine.go("climb", 8);
    f.run(HOP_MS / 2);
    expect(layers.pinBox.style.opacity).toBe("1");
  });

  it("goes on from where a dip is when another step comes, with no jump in the layers' strength", () => {
    const { engine, f, layers } = setup({ reduced: true });

    started(engine, f);
    engine.go("climb", 0);
    f.run(1500);
    engine.go("climb", 8);
    f.run(HOP_MS * 0.75); // past the middle: the camera has jumped, the layers are coming back
    expect(engine.state().moving).toBe(true);

    const seen = Number(layers.pinBox.style.opacity);

    engine.go("climb", 0);
    f.run(1000 / 60);
    expect(Math.abs(Number(layers.pinBox.style.opacity) - seen)).toBeLessThan(0.2);
    f.run(HOP_MS * 2);
    expect(layers.pinBox.style.opacity).toBe("1");
    expect(engine.state().u).toBe(engine.state().goal);
  });
});

describe("the engine's teardown", () => {
  it("clears the trail, the radar and the night map, and the beads' box", () => {
    const { engine, f, layers, trailCalls, radarCalls, terrainCalls } = setup();

    started(engine, f);
    engine.go("climb");
    f.run(IN_MS + 100);
    expect(layers.pinBox.style.opacity).toBe("1");

    const [t, r, g] = [trailCalls.clearRect, radarCalls.clearRect, terrainCalls.clearRect];

    engine.destroy();
    expect(trailCalls.clearRect).toBe(t + 1);
    expect(radarCalls.clearRect).toBe(r + 1);
    expect(terrainCalls.clearRect).toBe(g + 1);
    expect(layers.pinBox.style.opacity).toBe("");
    expect(f.pending()).toBe(0);
  });
});

describe("the beads' labels", () => {
  it("open to the left once the bead's head is past the middle of the stage", () => {
    const { engine, f, layers, heads } = setup();

    started(engine, f);
    engine.go("climb");
    f.run(IN_MS + 100);

    const last = heads[heads.length - 1];

    last.forEach(([x], i) => expect(layers.pins[i].style.props["--flip"]).toBe(x > FLIP_AT * 1440 ? "1" : "0"));
  });
});
