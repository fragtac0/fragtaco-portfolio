import { describe, expect, it } from "vitest";
import { IN_MS, OUT_MS, FADE_MS } from "./climb-change";
import { NIGHT_ON, createClimbEngine, type ClimbEngine, type Host } from "./climb-engine";
import { buildLevels } from "./contours";
import { makeField } from "./heights";
import { lowerTrail, sampleTrail } from "./trail";
import type { Terrain } from "./terrain-canvas";

/** A clock and a frame queue that the test turns by hand: `run(ms)` plays frames every 1000/fps ms. */
function fakeHost() {
  let t = 0;
  let id = 0;
  let queue = new Map<number, (now: number) => void>();
  const host: Host = {
    now: () => t,
    raf: (cb) => {
      queue.set(++id, cb);

      return id;
    },
    cancel: (n) => void queue.delete(n),
  };

  return {
    host,
    pending: () => queue.size,
    /** Play frames for `ms` of time (60 frames a second unless `fps` says otherwise). Returns how many frames ran. */
    run(ms: number, fps = 60) {
      let frames = 0;
      const end = t + ms;

      while (t < end) {
        t = Math.min(end, t + 1000 / fps);

        const due = queue;

        queue = new Map();
        due.forEach((cb) => {
          frames++;
          cb(t);
        });
        if (queue.size === 0) break;
      }

      return frames;
    },
    jump: (ms: number) => void (t += ms),
  };
}

function setup(reduced = false) {
  const fills: string[] = [];
  const style = () => ({ transform: "", opacity: "", width: "", height: "", props: {} as Record<string, string>, setProperty(n: string, v: string) { this.props[n] = v; } });
  const store: Record<string, unknown> = {};
  const ctx = new Proxy(store, {
    get: (o, key: string) => (key === "fill" ? () => fills.push("fill") : key in o ? o[key] : () => {}),
    set: (o, key: string, v) => ((o[key] = v), true),
  }) as unknown as CanvasRenderingContext2D;
  const layers = {
    stage: { style: style() },
    plane: { style: style() },
    night: { style: style() },
    terrain: { style: style(), width: 0, height: 0, getContext: () => ctx },
  };
  const f = fakeHost();
  const rows: number[][] = [];
  const trail = sampleTrail(lowerTrail([[640, 330], [600, 345], [570, 380], [550, 410], [545, 420]], [500, 325]));
  const engine = createClimbEngine(layers, { trail, reduced: () => reduced, host: f.host, trace: () => rows });

  return { engine, layers, f, rows, fills, trail };
}

/** A hill in the middle of a field, read as the heights (80 by 52 cells over the height frame, the summit at 500, 325). */
function terrain(): Terrain {
  const [w, h] = [80, 52];
  const grey: number[] = [];

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) grey.push(240 * Math.max(0, 1 - Math.hypot(x - (w - 1) / 2, y - (h - 1) / 2) / 30));

  const field = makeField(grey, w, h, 0);

  return { field, levels: buildLevels(field) };
}

function started(e: ClimbEngine, f: ReturnType<typeof fakeHost>) {
  e.resize(1440, 900, 2);
  e.setTerrain(terrain());
  f.run(50);
}

describe("the loop", () => {
  it("asks for no frame while nothing moves: one for a new size, then none", () => {
    const { engine, f } = setup();

    expect(f.pending()).toBe(0);
    engine.resize(1440, 900, 2);
    expect(f.pending()).toBe(1);
    expect(f.run(100)).toBe(1);
    expect(f.pending()).toBe(0);
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
    expect(f.pending()).toBe(0);
  });

  it("is 3.6 s in and 3.2 s out, and stops asking for frames when each is over", () => {
    const { engine, f } = setup();

    started(engine, f);
    engine.go("climb");
    f.run(IN_MS - 200);
    expect(engine.state().moving).toBe(true);
    f.run(400);
    expect(engine.state()).toMatchObject({ k: 1, moving: false });
    expect(f.pending()).toBe(0);
    engine.go("overview");
    f.run(OUT_MS - 200);
    expect(engine.state().moving).toBe(true);
    f.run(400);
    expect(engine.state()).toMatchObject({ k: 0, moving: false });
    expect(f.pending()).toBe(0);
  });

  it("sets the plane's size once it has a size, and the canvas's pixels at the pixel ratio", () => {
    const { engine, layers } = setup();

    engine.resize(1440, 900, 2);
    expect(layers.plane.style.width).toBe("1000px");
    expect(layers.plane.style.height).toBe("650px");
    expect([layers.terrain.width, layers.terrain.height]).toEqual([2880, 1800]);
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

    f.run(IN_MS);
    expect(fills.length).toBeGreaterThan(early);

    const done = fills.length;

    f.run(1000); // nothing moves, nothing is drawn
    expect(fills.length).toBe(done);
    engine.resize(1200, 800, 2); // a new size is a change of view
    f.run(100);
    expect(fills.length).toBeGreaterThan(done);
    expect(NIGHT_ON).toBeGreaterThan(0);
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
    const { engine, f, layers, rows } = setup(true);

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
    const { engine, f, fills } = setup(true);

    started(engine, f);
    engine.go("climb");
    f.run(FADE_MS + 200);

    const levels = terrain().levels.length;

    expect(fills.length).toBeGreaterThan(0);
    expect(fills.length).toBeLessThanOrEqual(levels * 2);
  });
});
