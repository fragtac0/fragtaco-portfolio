import { describe, expect, it } from "vitest";
import { IN_MS, OUT_MS, FADE_MS } from "./climb-change";
import { ENTRY_U, WAIT_ENTRY, WAIT_MOVE, WAIT_STAY } from "./climb-engine";
import { OMEGA } from "./camera";
import { setup, started, terrain } from "./climb-engine-fixtures";

describe("the camera along the trail", () => {
  it("goes into My climb at the last milestone by default, with the card waiting for the change", () => {
    const { engine, f, selects } = setup();

    started(engine, f);
    engine.go("climb");
    expect(selects).toEqual([[8, WAIT_ENTRY]]);
    expect(engine.state()).toMatchObject({ index: 8 });
  });

  it("goes in at the milestone that was chosen, and leaves with a null selection", () => {
    const { engine, f, selects } = setup();

    started(engine, f);
    engine.go("climb", 2);
    expect(selects[0]).toEqual([2, WAIT_ENTRY]);
    f.run(IN_MS + 100);
    engine.go("overview");
    expect(selects[1]).toEqual([null, 0]);
  });

  it("waits for the heights before it says anything about the card", () => {
    const { engine, f, selects } = setup();

    engine.resize(1440, 900, 2);
    engine.go("climb", 4);
    expect(selects).toEqual([]);
    engine.setTerrain(terrain());
    f.run(50);
    expect(selects).toEqual([[4, WAIT_ENTRY]]);
  });

  it("follows its goal without overshooting it, from rest, and stops there exactly", () => {
    const { engine, f, trail } = setup();

    started(engine, f);
    engine.go("climb", 0);
    f.run(IN_MS + 100);

    const first = engine.state();

    engine.go("climb", 8);

    const goal = engine.state().goal;

    expect(goal).not.toBe(first.goal); // milestone 0 and "now" are far apart: the camera has to travel
    expect(trail.length).toBeGreaterThan(0);

    const us: number[] = [];

    for (let t = 0; t < 6000; t += 1000 / 60) {
      f.run(1000 / 60);
      us.push(engine.state().u);
    }

    const dir = Math.sign(goal - first.goal);

    expect(us.every((u, i) => i === 0 || (u - us[i - 1]) * dir >= -1e-9)).toBe(true); // one way only
    expect(us.every((u) => (u - goal) * dir <= 1e-9)).toBe(true); // never past the goal
    expect(engine.state().u).toBe(goal);
    expect(engine.state().moving).toBe(false);
    expect(OMEGA).toBeGreaterThan(0);
  });

  it("tells the card to wait the short time for a milestone in view, and the long one for one it must travel to", () => {
    const { engine, f, selects } = setup();

    started(engine, f);
    engine.go("climb", 8);
    f.run(IN_MS + 100);
    selects.length = 0;
    engine.go("climb", 8); // the same one again: it is in view
    expect(selects[0]).toEqual([8, WAIT_STAY]);

    // somewhere the camera is not: it moves, the card waits for it
    let travelled = 0;

    for (const i of [0, 8, 0]) {
      engine.go("climb", i);
      f.run(WAIT_MOVE * 3);
      if (selects[selects.length - 1][1] === WAIT_MOVE) travelled++;
    }
    expect(travelled).toBeGreaterThan(0);
  });

  it("jumps with no travel under reduced motion", () => {
    const { engine, f } = setup({ reduced: true });

    started(engine, f);
    engine.go("climb", 0);
    f.run(FADE_MS + 100);
    engine.go("climb", 8);
    f.run(20);
    expect(engine.state().u).toBe(engine.state().goal);
  });

  it("moves the beads each frame the view changes, half size in the overview and full size in My climb", () => {
    const { engine, f, layers, heads } = setup();

    started(engine, f);
    expect(layers.pins[0].style.props["--bs"]).toBe("0.5");
    expect(layers.pins[0].style.transform).toMatch(/^translate\(/);
    engine.go("climb");
    f.run(IN_MS + 100);
    expect(layers.pins[0].style.props["--bs"]).toBe("1");
    expect(heads[heads.length - 1]).toHaveLength(9);
    expect(layers.pins.every((p) => p.style.zIndex !== "")).toBe(true);
  });

  it("traces the final frame of a change too, so the last row is at k = 1", () => {
    const { engine, f, rows } = setup();

    started(engine, f);
    engine.go("climb");
    f.run(IN_MS + 200);
    expect(rows[rows.length - 1][1]).toBe(1);
  });

  it("hides the picture once it is gone, and shows it again", () => {
    const { engine, f, layers } = setup();

    started(engine, f);
    expect(layers.plane.style.visibility).toBe("visible");
    engine.go("climb");
    f.run(IN_MS + 100);
    expect(layers.plane.style.opacity).toBe("0");
    expect(layers.plane.style.visibility).toBe("hidden");
    engine.go("overview");
    f.run(OUT_MS + 100);
    expect(layers.plane.style.visibility).toBe("visible");
  });

  it("renders the depth blurs only once the night has begun", () => {
    const { engine, f, classes } = setup();

    started(engine, f);
    expect(classes.has("is-night")).toBe(false);
    engine.go("climb");
    f.run(IN_MS + 100);
    expect(classes.has("is-night")).toBe(true);
    engine.go("overview");
    f.run(OUT_MS + 100);
    expect(classes.has("is-night")).toBe(false);
  });

  it("starts the camera at the entry's place and settles for the milestone", () => {
    const { engine, f } = setup();

    started(engine, f);
    engine.go("climb", 4);
    expect(Math.abs(engine.state().u - ENTRY_U)).toBeLessThan(1); // somewhere on the trail
    expect(engine.state().u).toBe(engine.state().goal);
    expect(WAIT_STAY).toBeLessThan(WAIT_MOVE);
  });
});

describe("fades the overlays across the change under reduced motion", () => {
  it("lets the trail, the radar and the beads fade out and back in while the picture crossfades", () => {
    const { engine, f, layers } = setup({ reduced: true });

    started(engine, f);
    expect(layers.pinBox.style.opacity).toBe("1");
    engine.go("climb");
    f.run(FADE_MS / 2);
    expect(Number(layers.pinBox.style.opacity)).toBeLessThan(0.2);
    f.run(FADE_MS);
    expect(layers.pinBox.style.opacity).toBe("1");
    expect(layers.trail.style.opacity).toBe("1");
  });
});
