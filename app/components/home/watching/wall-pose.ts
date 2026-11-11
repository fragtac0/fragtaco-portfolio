import { echoSet, focusWeight, tileTransform, type TileSize } from "./wall-math";
import { sortForDraw, tileLook } from "./wall-planes";
import type { Tile } from "./wall-types";

/**
 * Each frame's pose of the tiles: the hover weight and the channel echo weight, which ease toward
 * their targets, then the focus effect, the depth plane's size and the look (brightness and
 * softness) of every tile, and finally the order they are drawn in.
 */

export type PoseInput = {
  dt: number;
  size: TileSize;
  hoverKey: string | null;
  /** How strongly something is in focus, 0 to 1, and the centre the focus effect pulls toward. */
  lens: number;
  focus: { x: number; y: number };
  /** The video index in focus, whose channel's other videos are the echo (null for none). */
  focusIdx: number | null;
  /** Reduced motion: the echo is a static state, not an animation. */
  reduced: boolean;
};

export type Pose = {
  /** The other videos from the focused video's channel, by index (cached per focused video). */
  echoFor(focusIdx: number | null): ReadonlySet<number>;
  /** Poses every tile in place and sorts the list for drawing. */
  apply(list: Tile[], p: PoseInput): void;
  reset(): void;
};

export function createPose(videos: ReadonlyArray<{ channel: string }>): Pose {
  const fstate = new Map<string, number>();
  const estate = new Map<string, number>();
  const seen = new Set<string>();
  let echoIdx: number | null = null;
  let echo: ReadonlySet<number> = new Set();

  /** Eases `map[key]` toward `target`; drops it near zero so the map holds only live tiles. */
  const ease = (map: Map<string, number>, key: string, target: number, k: number): number => {
    let v = map.get(key) || 0;
    v += (target - v) * k;
    if (v > 0.002) {
      map.set(key, v);
      seen.add(key);
      return v;
    }
    map.delete(key);
    return 0;
  };

  const echoFor: Pose["echoFor"] = (focusIdx) => {
    if (focusIdx !== echoIdx) {
      echoIdx = focusIdx;
      echo = echoSet(videos, focusIdx);
    }
    return echo;
  };

  return {
    echoFor,
    apply(list, p) {
      const { cw, ch, pitchX } = p.size;
      const echoNow = echoFor(p.focusIdx);
      seen.clear();
      const kf = Math.min(1, p.dt * 9);
      for (const tl of list) {
        const f = ease(fstate, tl.key, tl.key === p.hoverKey ? 1 : 0, kf);
        const wantEcho = echoNow.has(tl.idx) ? 1 : 0;
        tl.e = p.reduced ? wantEcho : ease(estate, tl.key, wantEcho, kf);
        const cx = tl.x + cw / 2;
        const cy = tl.y + ch / 2;
        const dx = cx - p.focus.x;
        const dy = cy - p.focus.y;
        const weight = p.lens * focusWeight(dx, dy, pitchX);
        const tr = tileTransform({ cx, cy, dx, dy, f, weight, cw, ch });
        const look = tileLook({ plane: tl.plane, f, lens: p.lens, e: tl.e });
        tl.f = f;
        tl.cx = tr.cx;
        tl.cy = tr.cy;
        tl.w = tr.w * look.scale;
        tl.h = tr.h * look.scale;
        tl.rad = tr.rad * look.scale;
        tl.dim = look.dim;
        tl.bias = look.bias;
      }
      for (const m of [fstate, estate]) for (const k of m.keys()) if (!seen.has(k)) m.delete(k);
      sortForDraw(list);
    },
    reset() {
      fstate.clear();
      estate.clear();
    },
  };
}
