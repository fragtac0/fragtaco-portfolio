// Stand-ins for the engine's tests (climb-engine.test.ts, climb-engine-camera.test.ts): a clock and a frame queue turned by hand,
// layers that record what the engine writes, 2D contexts that count their calls, and a small hill as the heights.
import { createClimbEngine, type ClimbEngine, type Host } from "./climb-engine";
import { buildLevels } from "./contours";
import { makeField } from "./heights";
import experience from "../../../content/site/experience.json";
import { SUMMIT_XY, xOf, yOf } from "./frame";
import { lowerTrail, sampleTrail } from "./trail";
import type { Terrain } from "./terrain-canvas";

/** A clock and a frame queue that the test turns by hand: `run(ms)` plays frames every 1000/fps ms. */
export function fakeHost() {
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

/** A 2D context whose calls are recorded by name. */
function recorder(counts: Record<string, number>, nothing = false) {
  const store: Record<string, unknown> = {};

  return nothing
    ? null
    : (new Proxy(store, {
        get: (o, key: string) => (key in o ? o[key] : () => void (counts[key] = (counts[key] ?? 0) + 1)),
        set: (o, key: string, v) => ((o[key] = v), true),
      }) as unknown as CanvasRenderingContext2D);
}

const style = () => ({ transform: "", opacity: "", width: "", height: "", visibility: "", zIndex: "", props: {} as Record<string, string>, setProperty(n: string, v: string) { this.props[n] = v; } });

type Setup = { reduced?: boolean; noTerrainContext?: boolean; count?: number };

export function setup({ reduced = false, noTerrainContext = false, count = 9 }: Setup = {}) {
  const terrainCalls: Record<string, number> = {};
  const trailCalls: Record<string, number> = {};
  const radarCalls: Record<string, number> = {};
  const classes = new Set<string>();
  const canvas = (calls: Record<string, number>, nothing = false) => ({ style: style(), width: 0, height: 0, writes: 0, getContext: () => recorder(calls, nothing) });
  const layers = {
    stage: { style: style(), classList: { toggle: (name: string, force?: boolean) => (force ? classes.add(name) : classes.delete(name)) } },
    plane: { style: style() },
    night: { style: style() },
    terrain: canvas(terrainCalls, noTerrainContext),
    trail: canvas(trailCalls),
    radar: canvas(radarCalls),
    pinBox: { style: style() },
    pins: Array.from({ length: count }, () => ({ style: style() })),
  };
  const fills = { get length() { return terrainCalls.fill ?? 0; } };
  const f = fakeHost();
  const rows: number[][] = [];
  const selects: [number | null, number][] = [];
  const heads: number[][][] = [];
  const fails: string[] = [];
  const trail = sampleTrail(lowerTrail(experience.route.map((p): [number, number] => [xOf(p.lon), yOf(p.lat)]), SUMMIT_XY));
  const engine = createClimbEngine(layers, {
    trail,
    reduced: () => reduced,
    host: f.host,
    trace: () => rows,
    onSelect: (i, wait) => selects.push([i, wait]),
    onHeads: (h) => heads.push(h),
    onFail: () => fails.push("fail"),
  });

  return { engine, layers, f, rows, fills, trail, terrainCalls, trailCalls, radarCalls, classes, selects, heads, fails };
}

/** A hill in the middle of a field, read as the heights (80 by 52 cells over the height frame, the summit at 500, 325). */
export function terrain(): Terrain {
  const [w, h] = [80, 52];
  const grey: number[] = [];

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) grey.push(240 * Math.max(0, 1 - Math.hypot(x - (w - 1) / 2, y - (h - 1) / 2) / 30));

  const field = makeField(grey, w, h, 0);

  return { field, levels: buildLevels(field) };
}

/** The night of the view at k (view.ts: smooth(0.08, 0.62, k)). */
export const smoothNight = (k: number) => {
  const t = Math.min(1, Math.max(0, (k - 0.08) / 0.54));

  return t * t * (3 - 2 * t);
};

export function started(e: ClimbEngine, f: ReturnType<typeof fakeHost>) {
  e.resize(1440, 900, 2);
  e.setTerrain(terrain());
  f.run(50);
}

