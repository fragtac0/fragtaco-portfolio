import { layoutTiles, tileSize } from "./wall-math";

/**
 * Where the flat placeholder's tiles stand: the wall as it is on a cold open (no pan, no drift yet,
 * no pointer), so when the real wall draws its first frame the tiles are where the placeholder had them.
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
    .map((tl) => ({
      key: tl.key,
      left: tl.x,
      top: tl.y,
      width: cw,
      height: ch,
      radius: 12,
    }));
}
