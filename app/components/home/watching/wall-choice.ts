import { chosenRect, crosses, overlaps, textZone, type Rect } from "./wall-spread";
import type { PoseChoice } from "./wall-pose";
import type { Tile, WallState } from "./wall-types";

/**
 * The chosen video's place on the wall, in flat wall coordinates, for the pose: where it goes
 * (`chosenRect`) and where the text block stands (`textZone`). Worked out again only when the
 * screen's size changes; the object returned is reused, so a frame allocates nothing. The camera
 * writes `shift` into it each frame.
 */

/** The phone layout starts below this width (as `tileSize` in wall-math.ts). */
export const NARROW = 700;

export type ChoiceLayout = { rect: Rect; zone: Rect };

/** The chosen video's box and its text block's for a screen, the same one the detail view uses. */
export function choiceLayout(vw: number, vh: number): ChoiceLayout {
  const rect = chosenRect(vw, vh, vw < NARROW);
  return { rect, zone: textZone(rect, vw) };
}

export function createChoiceLayout(): (st: WallState) => PoseChoice | null {
  let out: PoseChoice | null = null;
  let at = "";
  return (st) => {
    const c = st.choice;
    if (!c) return null;
    const sig = `${st.vw}x${st.vh}`;
    if (!out || sig !== at) {
      at = sig;
      const l = choiceLayout(st.vw, st.vh);
      out = {
        key: c.key,
        live: c.live,
        rect: l.rect,
        zone: l.zone,
        halfDiag: Math.hypot(st.vw / 2, st.vh / 2),
        shift: out?.shift ?? { x: 0, y: 0 },
      };
    }
    out.key = c.key;
    out.live = c.live;
    return out;
  };
}

/** How many visible tiles other than the chosen one stand in the text block's box (the audit reads it). */
export function countUnderText(list: readonly Tile[], choice: PoseChoice): number {
  let n = 0;
  for (const tl of list) {
    if (tl.key === choice.key || tl.fade < 0.02) continue;
    if (overlaps({ x: tl.cx - tl.w / 2, y: tl.cy - tl.h / 2, w: tl.w, h: tl.h }, choice.zone)) n++;
  }
  return n;
}

/** How many pairs of visible tiles (the chosen one left out) overlap; the audit reads it, and it must be 0 once open. */
export function countOverlaps(list: readonly Tile[], choice: PoseChoice): number {
  const box = (t: Tile) => ({ x: t.cx - t.w / 2, y: t.cy - t.h / 2, w: t.w, h: t.h });
  const shown = list.filter((t) => t.key !== choice.key && t.fade >= 0.02);
  let n = 0;
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) if (crosses(box(shown[i]), box(shown[j]))) n++;
  }
  return n;
}

/**
 * True when every picture is on the atlas and its arrival fade (and the placeholder's shimmer
 * before it) is over, so a still wall needs no new frames. A picture that failed for good (`failedAt`,
 * a removed video) counts as settled once `settleMs` has passed since it failed, so one dead video
 * does not keep a still wall redrawing every frame. False for no pictures at all.
 */
export function picturesSettled(
  loadedAt: ArrayLike<number> | undefined,
  now: number,
  settleMs = 1200,
  failedAt?: ArrayLike<number>,
): boolean {
  if (!loadedAt || loadedAt.length === 0) return false;
  let latest = 0;
  for (let i = 0; i < loadedAt.length; i++) {
    const at = loadedAt[i] > 0 ? loadedAt[i] : (failedAt?.[i] ?? 0);
    if (!(at > 0)) return false;
    if (at > latest) latest = at;
  }
  return now - latest > settleMs;
}
