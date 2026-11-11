import { PLANE, layoutTiles, tileSize } from "./wall-math";
import { planeOfKey } from "./wall-planes";

/**
 * Where the flat placeholder's tiles stand: the wall as it is on a cold open (no pan, no drift yet,
 * no lean), so when the real wall draws its first frame the tiles are where the placeholder had them.
 * A far column's tiles are smaller about their own centre, as on the wall.
 */

export type PlaceholderTile = {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
};

export function placeholderTiles(vw: number, vh: number, count: number): PlaceholderTile[] {
  if (!(vw > 0) || !(vh > 0) || count <= 0) return [];
  const size = tileSize(vw);
  const { cw, ch, pitchX, pitchY } = size;
  return layoutTiles({ panX: 0, panY: 0, vw, vh, pitchX, pitchY, t: 0, count })
    .filter((tl) => tl.x < vw && tl.y < vh && tl.x + cw > 0 && tl.y + ch > 0)
    .map((tl) => {
      const s = PLANE[planeOfKey(tl.key)].scale;
      const width = cw * s;
      const height = ch * s;
      return {
        key: tl.key,
        left: tl.x + (cw - width) / 2,
        top: tl.y + (ch - height) / 2,
        width,
        height,
        radius: 12 * s,
      };
    });
}
