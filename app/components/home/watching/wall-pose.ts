import { echoSet, type TileSize } from "./wall-math";
import { proximity } from "./wall-proximity";
import {
  CLOSE_MS,
  easeInOut,
  FADE_MS,
  OPEN_MS,
  hiddenTiles,
  spread,
  SPREAD_DIM,
  SPREAD_SCALE,
  stepToward,
  type Rect,
} from "./wall-spread";
import type { Tile } from "./wall-types";

/**
 * Each frame's pose of the tiles. All tiles are one size and one brightness; the only things that
 * move them are the pointer's nearness (`proximity`: a tile within 220 px grows up to 4% and eases
 * away up to 4 px, nothing lifts and nothing dims), the hover weight that eases toward the focused
 * tile (it drives the glow and the chip), and the channel echo of the focused video. The tiles are
 * then sorted so the focused one is drawn last.
 *
 * While a video is chosen (`choice`, spec 7 "Click") the wall opens: the chosen tile travels to
 * `choice.rect` and grows to fit it, and the others move away from its middle, shrink and dim
 * (`spread`), the ones from the focused channel staying bright. A tile that would stand in the text
 * block's way, mostly behind the chosen video or on top of another tile fades out (`hiddenTiles`),
 * so no two visible tiles overlap. With reduced
 * motion nothing travels: the chosen video fades in at its place while its tile fades out, the
 * others only dim, and the ones in the way fade.
 */

/** The chosen video's resting place and the text block's, in flat wall coordinates. */
export type PoseChoice = {
  key: string;
  /** False while it closes. */
  live: boolean;
  rect: Rect;
  zone: Rect;
  /** The screen's half-diagonal, which the spread's reach is measured against. */
  halfDiag: number;
};

/** The chosen video's corner radius, px (a tile's is 12). */
const RAD_BIG = 20;

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
  /** The chosen video (the wall is open), or null. */
  choice?: PoseChoice | null;
};

export type Pose = {
  /** The other videos from the focused video's channel, by index (cached per focused video). */
  echoFor(focusIdx: number | null): ReadonlySet<number>;
  /**
   * False when the last `apply` left the wall still: a video is open, nothing travels, nothing is
   * easing, so the frame would be the one already on the screen.
   */
  moving(): boolean;
  /**
   * Poses every tile in place and sorts the list for drawing. Returns the tiles that only fade
   * out where they were (reduced motion's stand-in for a travelling tile), to be drawn first.
   */
  apply(list: Tile[], p: PoseInput): Tile[];
  reset(): void;
};

/**
 * Where a tile sorts in the draw: any focused tile last (the more focused, the later), the chosen
 * one (`c`, how far it has travelled) after those.
 */
export const drawRank = (f: number, c = 0): number => (f > 0.01 ? 1 + f : 0) + (c > 0.001 ? 3 + c : 0);

/** Sorts tiles for drawing, in place; tiles of equal rank keep their order. */
export function sortForDraw<T extends { f: number; c?: number }>(tiles: T[]): T[] {
  return tiles.sort((a, b) => drawRank(a.f, a.c) - drawRank(b.f, b.c));
}

/** The tiles that fade out around a chosen video, judged from where they will rest once the wall is open. */
function hiddenFor(list: readonly Tile[], choice: PoseChoice, size: TileSize, reduced: boolean) {
  const { cw, ch } = size;
  const k = reduced ? 1 : SPREAD_SCALE;
  const mx = choice.rect.x + choice.rect.w / 2;
  const my = choice.rect.y + choice.rect.h / 2;
  const boxes: Array<Rect & { key: string }> = [];
  for (const tl of list) {
    if (tl.key === choice.key) continue;
    const end = spread({
      x: tl.x + cw / 2,
      y: tl.y + ch / 2,
      cx: mx,
      cy: my,
      halfDiag: choice.halfDiag,
      open: reduced ? 0 : 1,
    });
    boxes.push({ key: tl.key, x: end.x - (cw * k) / 2, y: end.y - (ch * k) / 2, w: cw * k, h: ch * k });
  }
  return hiddenTiles(boxes, choice.rect, choice.zone);
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
  // the wall's opening (0 closed to 1 open) and how far each tile is the chosen one; both linear
  // here and eased where they are used
  let open = 0;
  const travelled = new Map<string, number>();
  // set while anything is still easing during an `apply`
  let easing = false;
  let still = false;

  /** Eases `map[key]` toward `target`; drops it near zero so the map holds only live tiles. */
  const ease = (map: Map<string, number>, key: string, target: number, k: number): number => {
    let v = map.get(key) || 0;
    v += (target - v) * k;
    if (Math.abs(target - v) > 0.002) easing = true;
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


  /** Poses a tile while the wall is open: spread, dim, hidden, or on its way to the chosen place. */
  function openTile(
    tl: Tile,
    o: {
      base: { cx: number; cy: number; cw: number; th: number };
      choice: PoseChoice;
      rc: { x: number; y: number };
      eo: number;
      reduced: boolean;
      dt: number;
      secs: number;
      hidden: ReadonlySet<string>;
      ghosts: Tile[];
      kept: Set<string>;
    },
  ) {
    const { cx, cy, cw, th } = o.base;
    const { choice, rc, eo, reduced } = o;
    const sp = spread({ x: cx, y: cy, cx: rc.x, cy: rc.y, halfDiag: choice.halfDiag, open: reduced ? 0 : eo });
    const dim = 1 - (1 - SPREAD_DIM) * eo;
    tl.cx = sp.x;
    tl.cy = sp.y;
    tl.w = cw * sp.scale;
    tl.h = th * sp.scale;
    tl.rad = 12 * sp.scale;
    tl.dim = dim + (1 - dim) * tl.e; // the channel's other videos stay bright
    tl.fade = o.hidden.has(tl.key) ? 1 - eo : 1;
    const was = travelled.get(tl.key) || 0;
    const v = stepToward(was, choice.live && tl.key === choice.key ? 1 : 0, o.dt, o.secs);
    if (v !== was) easing = true;
    if (v <= 0) return;
    travelled.set(tl.key, v);
    o.kept.add(tl.key);
    const c = easeInOut(v);
    tl.c = c;
    tl.dim += (1 - tl.dim) * c;
    if (reduced) {
      if (c < 0.999) o.ghosts.push({ ...tl, f: 0, c: 0, fade: 1 - c });
      tl.fade = c;
      tl.cx = rc.x;
      tl.cy = rc.y;
      tl.w = choice.rect.w;
      tl.h = choice.rect.h;
    } else {
      tl.fade += (1 - tl.fade) * c;
      tl.cx += (rc.x - tl.cx) * c;
      tl.cy += (rc.y - tl.cy) * c;
      tl.w += (choice.rect.w - tl.w) * c;
      tl.h += (choice.rect.h - tl.h) * c;
    }
    tl.rad += (RAD_BIG - tl.rad) * c;
  }

  return {
    echoFor,
    moving: () => !still,
    apply(list, p) {
      easing = false;
      const { cw, ch: th } = p.size;
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
      const choice = p.choice ?? null;
      const live = choice?.live ?? false;
      const secs = (p.reduced ? FADE_MS : live ? OPEN_MS : CLOSE_MS) / 1000;
      open = stepToward(open, live ? 1 : 0, p.dt, secs);
      const eo = easeInOut(open);
      const rc = choice
        ? { x: choice.rect.x + choice.rect.w / 2, y: choice.rect.y + choice.rect.h / 2 }
        : null;
      const ghosts: Tile[] = [];
      const kept = new Set<string>();
      const hidden = choice ? hiddenFor(list, choice, p.size, p.reduced) : null;
      for (const tl of list) {
        const f = ease(fstate, tl.key, tl.key === p.hoverKey ? 1 : 0, kf);
        const wantEcho = echoNow.has(tl.idx) ? 1 : 0;
        tl.e = p.reduced ? wantEcho : ease(estate, tl.key, wantEcho, kf);
        const cx = tl.x + cw / 2;
        const cy = tl.y + th / 2;
        const pr = near > 0 ? proximity(cx - at.x, cy - at.y) : null;
        const s = pr ? 1 + (pr.scale - 1) * near : 1;
        const push = pr && !p.reduced ? near : 0;
        tl.f = f;
        tl.c = 0;
        tl.dim = 1;
        tl.fade = 1;
        tl.cx = cx + (pr ? pr.pushX * push : 0);
        tl.cy = cy + (pr ? pr.pushY * push : 0);
        tl.w = cw * s;
        tl.h = th * s;
        tl.rad = 12 * s;
        if (!choice || !rc || (open <= 0 && !travelled.has(tl.key) && tl.key !== choice.key)) continue;
        openTile(tl, {
          base: { cx, cy, cw, th },
          choice,
          rc,
          eo,
          reduced: p.reduced,
          dt: p.dt,
          secs,
          hidden: hidden ?? new Set(),
          ghosts,
          kept,
        });
      }
      for (const k of travelled.keys()) if (!kept.has(k)) travelled.delete(k);
      for (const m of [fstate, estate]) for (const k of m.keys()) if (!seen.has(k)) m.delete(k);
      sortForDraw(list);
      still = !!choice && choice.live && open >= 1 && !easing && near === 0;
      return ghosts;
    },
    reset() {
      fstate.clear();
      estate.clear();
      travelled.clear();
      near = 0;
      open = 0;
      still = false;
    },
  };
}
