import { echoSet, type TileSize } from "./wall-math";
import { proximity } from "./wall-proximity";
import type { Tile } from "./wall-types";

/**
 * Each frame's pose of the tiles. All tiles are one size and one brightness; the only things that
 * move them are the pointer's nearness (`proximity`: a tile within 220 px grows up to 4% and eases
 * away up to 4 px, nothing lifts and nothing dims), the hover weight that eases toward the focused
 * tile (it drives the glow and the chip), and the channel echo of the focused video. The tiles are
 * then sorted so the focused one is drawn last.
 */

export type PoseInput = {
  dt: number;
  size: TileSize;
  hoverKey: string | null;
  /**
   * Where the nearness comes from, in flat wall coordinates: the pointer, or the centre of the tile
   * the keyboard is on. Null: nothing is near, and the tiles ease back to rest.
   */
  point: { x: number; y: number } | null;
  /** The video index in focus, whose channel's other videos are the echo (null for none). */
  focusIdx: number | null;
  /**
   * Reduced motion: no easing and no push. The growth stays (it is feedback, not travel), and the
   * echo is a static state.
   */
  reduced: boolean;
};

export type Pose = {
  /** The other videos from the focused video's channel, by index (cached per focused video). */
  echoFor(focusIdx: number | null): ReadonlySet<number>;
  /** Poses every tile in place and sorts the list for drawing. */
  apply(list: Tile[], p: PoseInput): void;
  reset(): void;
};

/** Where a tile sorts in the draw: any focused tile last (the more focused, the later). */
export const drawRank = (f: number): number => (f > 0.01 ? 1 + f : 0);

/** Sorts tiles for drawing, in place; tiles of equal rank keep their order. */
export function sortForDraw<T extends { f: number }>(tiles: T[]): T[] {
  return tiles.sort((a, b) => drawRank(a.f) - drawRank(b.f));
}

export function createPose(videos: ReadonlyArray<{ channel: string }>): Pose {
  const fstate = new Map<string, number>();
  const estate = new Map<string, number>();
  const seen = new Set<string>();
  let echoIdx: number | null = null;
  let echo: ReadonlySet<number> = new Set();
  // the pointer's nearness: how strongly it is felt, and the (eased) point it is felt from
  let near = 0;
  const at = { x: 0, y: 0 };

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
      const { cw, ch } = p.size;
      const echoNow = echoFor(p.focusIdx);
      seen.clear();
      const kf = p.reduced ? 1 : Math.min(1, p.dt * 9);
      // the nearness fades with the pointer; the point it comes from follows the pointer closely
      const was = near;
      near += ((p.point ? 1 : 0) - near) * (p.reduced ? 1 : Math.min(1, p.dt * 7));
      if (near < 0.002) near = 0;
      if (p.point) {
        if (was < 0.02 || p.reduced) {
          at.x = p.point.x;
          at.y = p.point.y;
        } else {
          const k = Math.min(1, p.dt * 12);
          at.x += (p.point.x - at.x) * k;
          at.y += (p.point.y - at.y) * k;
        }
      }
      for (const tl of list) {
        const f = ease(fstate, tl.key, tl.key === p.hoverKey ? 1 : 0, kf);
        const wantEcho = echoNow.has(tl.idx) ? 1 : 0;
        tl.e = p.reduced ? wantEcho : ease(estate, tl.key, wantEcho, kf);
        const cx = tl.x + cw / 2;
        const cy = tl.y + ch / 2;
        const pr = near > 0 ? proximity(cx - at.x, cy - at.y) : null;
        const s = pr ? 1 + (pr.scale - 1) * near : 1;
        const push = pr && !p.reduced ? near : 0;
        tl.f = f;
        tl.cx = cx + (pr ? pr.pushX * push : 0);
        tl.cy = cy + (pr ? pr.pushY * push : 0);
        tl.w = cw * s;
        tl.h = ch * s;
        tl.rad = 12 * s;
      }
      for (const m of [fstate, estate]) for (const k of m.keys()) if (!seen.has(k)) m.delete(k);
      sortForDraw(list);
    },
    reset() {
      fstate.clear();
      estate.clear();
      near = 0;
    },
  };
}
