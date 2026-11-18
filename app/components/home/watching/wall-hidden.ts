import type { TileSize } from "./wall-math";
import type { PoseChoice } from "./wall-pose";
import { hiddenTiles, spread, SPREAD_SCALE, type Rect } from "./wall-spread";
import type { Tile } from "./wall-types";

/**
 * Which tiles fade out around a chosen video (the pose's business, split out of wall-pose.ts):
 * judged from where the tiles will rest once the wall is open and the camera has arrived, and
 * remembered while that does not change.
 */

/** Two resting positions closer than this, px, are the same (rounding while the camera travels). */
const REST_EPS = 0.01;

/** The tiles that fade out around a chosen video, judged from where they will rest once the wall is open and the camera has arrived. */
function hiddenFor(list: readonly Tile[], choice: PoseChoice, size: TileSize, reduced: boolean) {
  const { cw, ch } = size;
  const k = reduced ? 1 : SPREAD_SCALE;
  const mx = choice.rect.x + choice.rect.w / 2;
  const my = choice.rect.y + choice.rect.h / 2;
  const sx = choice.shift?.x ?? 0;
  const sy = choice.shift?.y ?? 0;
  const boxes: Array<Rect & { key: string }> = [];
  for (const tl of list) {
    if (tl.key === choice.key) continue;
    const end = spread({
      x: tl.x + sx + cw / 2,
      y: tl.y + sy + ch / 2,
      cx: mx,
      cy: my,
      halfDiag: choice.halfDiag,
      open: reduced ? 0 : 1,
    });
    boxes.push({ key: tl.key, x: end.x - (cw * k) / 2, y: end.y - (ch * k) / 2, w: cw * k, h: ch * k });
  }
  return hiddenTiles(boxes, choice.rect, choice.zone);
}

/**
 * `hiddenFor` remembered while its inputs hold (a wall that is open and still asks every frame with the
 * same choice, size and resting tile positions): the choice, the size, the mode and every tile's
 * resting position (where it is plus the camera's shift, which does not change while the camera
 * travels, to within rounding).
 */
export function hiddenCache() {
  let sig = "";
  let pos = new Float64Array(0);
  let set: Set<string> = new Set();
  return (list: readonly Tile[], choice: PoseChoice, size: TileSize, reduced: boolean): Set<string> => {
    const { rect: r, zone: z } = choice;
    const next = `${choice.key}|${r.x},${r.y},${r.w},${r.h}|${z.x},${z.y},${z.w},${z.h}|${choice.halfDiag}|${size.cw}x${size.ch}|${reduced}|${list.length}`;
    const sx = choice.shift?.x ?? 0;
    const sy = choice.shift?.y ?? 0;
    let same = next === sig && pos.length === list.length * 2;
    for (let i = 0; same && i < list.length; i++) {
      same = Math.abs(pos[2 * i] - (list[i].x + sx)) < REST_EPS && Math.abs(pos[2 * i + 1] - (list[i].y + sy)) < REST_EPS;
    }
    if (same) return set;
    sig = next;
    pos = new Float64Array(list.length * 2);
    list.forEach((tl, i) => {
      pos[2 * i] = tl.x + sx;
      pos[2 * i + 1] = tl.y + sy;
    });
    set = hiddenFor(list, choice, size, reduced);
    return set;
  };
}
