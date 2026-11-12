import { clamp, flatFrame, LINE_PX } from "./shelf-math";
import { placeMarker } from "./shelf-hud";
import type { ShelfCtx } from "./shelf-open";

/**
 * Sizes the renderer and the orthographic camera to the canvas (`flatFrame`: the tallest spine at
 * most 78% of the height, the row at most 88% of the width, the row pans when that would make it
 * smaller than 56%), puts the line the books stand on at its row, and works out how far the camera
 * may pan, how much of the row is on screen, and where the position marker goes (just under the
 * line, where the flat placeholder draws it). Nothing happens when the size is unchanged since the
 * last call. An open book is put back first, because its pose was laid out for the old size.
 */
export function fitShelf(ctx: ShelfCtx, closeBook: (refocus: boolean) => void): void {
  const gl = ctx.scene();
  const els = ctx.els();
  if (!gl || !els) return;
  const { canvas, st, cam } = ctx;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  if (w === st.fitW && h === st.fitH) return;
  st.fitW = w;
  st.fitH = h;
  if (st.opened) closeBook(true);
  const { renderer: r, camera, span, line } = gl;
  r.setSize(w, h, false);
  const tallest = Math.max(...gl.books.map((b) => b.H));
  const f = flatFrame({ vw: w, vh: h, span, tallest });
  gl.scale = f.scale;
  gl.maxX = f.maxX;
  gl.visible = f.visible;
  cam.x = clamp(cam.x, -f.maxX, f.maxX);
  // one world unit is `scale` pixels: the frustum is the stage, and world y 0 (the books' feet) is at `baseRow`
  camera.left = -w / 2 / f.scale;
  camera.right = w / 2 / f.scale;
  camera.top = h / 2 / f.scale;
  camera.bottom = -h / 2 / f.scale;
  camera.position.y = (f.baseRow - h / 2) / f.scale;
  camera.updateProjectionMatrix();
  // the hairline runs the row's reach, just under the books' feet
  line.scale.set(f.reach, LINE_PX / f.scale, 1);
  line.position.set(0, -LINE_PX / f.scale / 2, line.position.z);
  placeMarker(els.marker, f.baseRow + LINE_PX + 14);
  // read by scripts/audit/shelf.json: the tallest spine's share of the height, the row's of the width, the feet's row
  canvas.dataset.tall = ((f.scale * tallest) / h).toFixed(4);
  canvas.dataset.row = ((f.scale * span) / w).toFixed(4);
  canvas.dataset.baseRow = String(f.baseRow);
  canvas.dataset.pans = String(f.pans);
  st.dirty = true;
}
