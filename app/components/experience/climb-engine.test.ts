import { describe, expect, it } from "vitest";
import { IN_MS, OUT_MS, FADE_MS } from "./climb-change";
import { NIGHT_ON } from "./climb-engine";
import { setup, smoothNight, started, terrain } from "./climb-engine-fixtures";

describe("the loop", () => {
  it("keeps a frame going for the radar while the page is visible, and asks for none while nothing moves under reduced motion", () => {
    const { engine, f } = setup();

    expect(f.pending()).toBe(0);
    engine.resize(1440, 900, 2);
    expect(f.pending()).toBe(1);
    expect(f.run(100)).toBeGreaterThan(5); // a frame every vsync
    expect(f.pending()).toBe(1);

    const calm = setup({ reduced: true });

    calm.engine.resize(1440, 900, 2);
    expect(calm.f.run(100)).toBe(1); // one for the new size, then none
    expect(calm.f.pending()).toBe(0);
  });

  it("draws the radar's rings about 30 times a second (R102), and the trail only when the view changes", () => {
    const { engine, f, radarCalls, trailCalls } = setup();

    started(engine, f);

    const [strokes, trails] = [radarCalls.stroke, trailCalls.stroke];

    f.run(500);
    expect(radarCalls.stroke - strokes).toBeGreaterThanOrEqual(2 * 14); // two rings, every other frame at 60 Hz (500 ms: 15 draws)
    expect(radarCalls.stroke - strokes).toBeLessThanOrEqual(2 * 17);
    expect(trailCalls.stroke).toBe(trails); // nothing moved: the trail was not drawn again
    engine.go("climb");
    f.run(500);
    expect(trailCalls.stroke).toBeGreaterThan(trails);
  });

  it("holds the radar still under reduced motion", () => {
    const { engine, f, radarCalls } = setup({ reduced: true });

    started(engine, f);

    const n = radarCalls.stroke;

    f.run(1000);
    expect(radarCalls.stroke).toBe(n);
  });

  it("waits for the heights: a change asked for before them starts when they arrive", () => {
    const { engine, f, layers } = setup();

    engine.resize(1440, 900, 2);
    engine.go("climb");
    f.run(100);
    expect(engine.state()).toMatchObject({ k: 0, mode: "climb", moving: false, ready: false });
    engine.setTerrain(terrain());
    expect(engine.state().moving).toBe(true);
    f.run(IN_MS + 100);
    expect(engine.state()).toMatchObject({ k: 1, moving: false });
    expect(layers.plane.style.opacity).toBe("0");
  });

  it("is 3.6 s in and 3.2 s out", () => {
    const { engine, f } = setup();

    started(engine, f);
    engine.go("climb");
    f.run(IN_MS - 200);
    expect(engine.state().moving).toBe(true);
    f.run(400);
    expect(engine.state()).toMatchObject({ k: 1, moving: false });
    engine.go("overview");
    f.run(OUT_MS - 200);
    expect(engine.state().moving).toBe(true);
    f.run(400);
    expect(engine.state()).toMatchObject({ k: 0, moving: false });
  });

  it("sets the plane's size once it has a size, and the canvas's pixels at the pixel ratio", () => {
    const { engine, layers } = setup();

    engine.resize(1440, 900, 2);
    expect(layers.plane.style.width).toBe("1000px");
    expect(layers.plane.style.height).toBe("650px");
    expect([layers.terrain.width, layers.terrain.height]).toEqual([2880, 1800]);
    expect([layers.trail.width, layers.trail.height]).toEqual([2880, 1800]);
    expect(layers.radar.width).toBe(layers.radar.height); // a small square round "now"
    expect(layers.radar.width).toBeLessThan(600);
  });

  it("gives a canvas its size only when the size changed, so a resize does not blank the night map", () => {
    const { engine, f, layers } = setup();
    let sets = 0;

    started(engine, f);
    engine.go("climb");
    f.run(IN_MS + 100);
    for (const c of [layers.terrain, layers.trail, layers.radar]) {
      let width = c.width;

      Object.defineProperty(c, "width", { get: () => width, set: (v: number) => ((width = v), sets++), configurable: true });
    }
    engine.resize(1440, 900, 2); // the same size again (the window's resize event after the observer's)
    expect(sets).toBe(0);
    engine.resize(1200, 800, 2);
    expect(sets).toBe(3);
  });

  it("draws the night map again at once in a resize, before the next frame is asked for", () => {
    const { engine, f, fills } = setup();

    started(engine, f);
    engine.go("climb");
    f.run(IN_MS + 100);

    const before = fills.length;

    engine.resize(1200, 800, 2);
    expect(fills.length).toBeGreaterThan(before); // no frame has run: it was drawn inside the resize
  });

  it("treats a missing 2D context as a failure and draws nothing", () => {
    const { engine, f, fails, layers } = setup({ noTerrainContext: true });

    expect(fails).toHaveLength(1);
    engine.resize(1440, 900, 2);
    engine.setTerrain(terrain());
    engine.go("climb");
    expect(f.pending()).toBe(0);
    expect(layers.plane.style.opacity).toBe("");
  });

  it("asks for no frames in a hidden tab and draws one when it comes back", () => {
    const { engine, f, layers } = setup();

    started(engine, f);
    engine.go("climb");
    f.run(300);
    engine.setVisible(false);
    expect(f.pending()).toBe(0);
    expect(f.run(1000)).toBe(0);
    f.jump(1000);
    engine.setVisible(true);
    expect(f.pending()).toBe(1);
    f.run(20);
    expect(Number(layers.plane.style.opacity)).toBeLessThan(1);
  });

  it("draws nothing after it is destroyed", () => {
    const { engine, f } = setup();

    started(engine, f);
    engine.go("climb");
    engine.destroy();
    expect(f.pending()).toBe(0);
  });
});

describe("the change", () => {
  it("never reverses: the camera's height on the screen, its tilt and its target only go one way, at 60 and at 20 frames a second", () => {
    for (const fps of [60, 20]) {
      const { engine, f, rows } = setup();

      started(engine, f);
      engine.go("climb");
      f.run(IN_MS + 200, fps);
      expect(rows.length).toBeGreaterThan(IN_MS / (1000 / fps) - 3);

      const col = (i: number) => rows.map((r) => r[i]);
      const monotone = (xs: number[], dir: number) => xs.every((x, i) => i === 0 || (x - xs[i - 1]) * dir >= -1e-6);

      expect(monotone(col(1), 1)).toBe(true); // k
      expect(monotone(col(2), 1)).toBe(true); // the camera's centre on the screen goes down
      expect(monotone(col(3), 1)).toBe(true); // the tilt
      expect(monotone(col(7), 1)).toBe(true); // the zoom
      for (const i of [4, 5, 6]) {
        const xs = col(i);
        const dir = Math.sign(xs[xs.length - 1] - xs[0]) || 1;

        expect(monotone(xs, dir)).toBe(true); // the target (x, y, height)
      }
    }
  });

  it("never reverses on the way out either", () => {
    const { engine, f, rows } = setup();

    started(engine, f);
    engine.go("climb");
    f.run(IN_MS + 100);
    rows.length = 0;
    engine.go("overview");
    f.run(OUT_MS + 100);

    const col = (i: number) => rows.map((r) => r[i]);
    const falling = (xs: number[]) => xs.every((x, i) => i === 0 || x - xs[i - 1] <= 1e-6);

    expect(falling(col(1))).toBe(true);
    expect(falling(col(2))).toBe(true);
    expect(falling(col(3))).toBe(true);
    expect(falling(col(7))).toBe(true);
  });

  it("fades the picture out as the night map comes in, and lays the plane by planeTransform while it can be seen", () => {
    const { engine, f, layers } = setup();

    started(engine, f);
    expect(layers.plane.style.opacity).toBe("1");
    expect(layers.plane.style.transform).toContain("perspective");
    expect(layers.stage.style.props["--night"]).toBe("0.000");
    engine.go("climb");
    f.run(IN_MS / 2);
    expect(Number(layers.plane.style.opacity)).toBeLessThan(1);
    expect(Number(layers.terrain.style.opacity)).toBeGreaterThan(0.5);
    f.run(IN_MS);
    expect(layers.plane.style.opacity).toBe("0");
    expect(layers.terrain.style.opacity).toBe("1");
    expect(layers.stage.style.props["--night"]).toBe("1.000");
  });

  it("draws the night map only while the night is on, and only when the view changed", () => {
    const { engine, f, fills } = setup();

    started(engine, f);
    expect(fills).toHaveLength(0); // the overview: no night
    engine.go("climb");
    f.run(300); // the night has barely begun: k under 0.1
    const early = fills.length;

    expect(early).toBe(0); // at 300 ms k is about 0.002 and the night under NIGHT_ON: nothing drawn
    f.run(IN_MS);
    expect(fills.length).toBeGreaterThan(early);

    const done = fills.length;

    f.run(1000); // nothing moves, nothing is drawn
    expect(fills.length).toBe(done);
    engine.resize(1200, 800, 2); // a new size is a change of view
    f.run(100);
    expect(fills.length).toBeGreaterThan(done);
  });

  it("draws nothing on the way out once the night is back under NIGHT_ON", () => {
    const { engine, f, fills } = setup();

    started(engine, f);
    engine.go("climb");
    f.run(IN_MS + 100);
    engine.go("overview");

    let last = fills.length;
    let late = 0;

    for (let t = 0; t < OUT_MS + 100; t += 17) {
      f.run(17);

      const dark = engine.state().k;

      if (fills.length > last && smoothNight(dark) <= NIGHT_ON) late++;
      last = fills.length;
    }
    expect(late).toBe(0);
  });

  it("takes a turn round part of the way from where it is, with no jump", () => {
    const { engine, f, rows } = setup();

    started(engine, f);
    engine.go("climb");
    f.run(1800);

    const mid = rows[rows.length - 1][1];

    engine.go("overview");
    f.run(200);
    expect(rows[rows.length - 1][1]).toBeLessThan(mid);
    expect(mid - rows[rows.length - 1][1]).toBeLessThan(0.2);
  });
});

describe("reduced motion", () => {
  it("crossfades in the short time with the picture flat and no camera travel", () => {
    const { engine, f, layers, rows } = setup({ reduced: true });

    started(engine, f);

    const flat = layers.plane.style.transform;

    engine.go("climb");
    f.run(FADE_MS / 2);
    expect(Number(layers.plane.style.opacity)).toBeLessThan(1);
    expect(Number(layers.plane.style.opacity)).toBeGreaterThan(0);
    expect(layers.plane.style.transform).toBe(flat);
    f.run(FADE_MS);
    expect(engine.state()).toMatchObject({ k: 1, moving: false });
    expect(layers.plane.style.opacity).toBe("0");
    expect(layers.terrain.style.opacity).toBe("1");
    expect(rows.length).toBeLessThan(60); // the fade is the 0.7 s, not the 3.6 s
  });

  it("draws the night map once for the whole fade, not for every frame", () => {
    const { engine, f, fills } = setup({ reduced: true });

    started(engine, f);
    engine.go("climb");
    f.run(FADE_MS + 200);

    const levels = terrain().levels.length;

    expect(fills.length).toBeGreaterThan(0);
    expect(fills.length).toBeLessThanOrEqual(levels * 2);
  });
});
