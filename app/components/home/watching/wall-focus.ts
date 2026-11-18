import { hitTile } from "./wall-math";
import type { Tile, WallState } from "./wall-types";

/**
 * Which tile is in focus this frame, and the point the tiles near it answer to. Sets `st.hoverKey`:
 * the chosen video when one is chosen (its channel's others stay lit), else the tile nearest the
 * pointer (gaps included, so the focus never drops between two videos), else the keyboard's tile.
 * `point` is the pointer, or the centre of the keyboard's tile, in flat wall coordinates; null while a
 * video is chosen (the wall's attention is on it) or when nothing is near.
 */
export function focusOf(
  st: WallState,
  list: readonly Tile[],
  hovering: boolean,
): { ft: Tile | null; point: { x: number; y: number } | null } {
  const { mouse, size } = st;
  if (st.choice) {
    st.hoverKey = st.choice.key;
  } else {
    st.hoverKey = hovering ? hitTile(list, mouse.x, mouse.y, size) : null;
    if (st.hoverKey === null && st.kbd && !st.dragging) st.hoverKey = `${st.kbd.cx},${st.kbd.cy}`;
  }
  const ft = st.hoverKey === null ? null : (list.find((tl) => tl.key === st.hoverKey) ?? null);
  const point = st.choice
    ? null
    : hovering
      ? { x: mouse.x, y: mouse.y }
      : st.kbd && ft
        ? { x: ft.x + size.cw / 2, y: ft.y + size.ch / 2 }
        : null;
  return { ft, point };
}
