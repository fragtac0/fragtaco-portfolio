import type { SiteBook } from "~/types";
import { clamp, fitCamera, visibleFraction } from "./shelf-math";
import { placeMarker } from "./shelf-hud";
import type { ShelfCtx } from "./shelf-open";
import { placeholderLayout } from "./shelf-placeholder-layout";

/**
 * Sizes the renderer and camera to the canvas and works out how far the camera may pan, how much
 * of the shelf is on screen, and where the position marker goes (under the plank, where the flat
 * placeholder draws it). Nothing happens when the size is unchanged since the last call. An open
 * book is put back first, because its pose was laid out for the old size.
 */
export function fitShelf(
  ctx: ShelfCtx,
  books: SiteBook[],
  closeBook: (refocus: boolean) => void,
): void {
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
  const { renderer: r, camera, span } = gl;
  r.setSize(w, h, false);
  camera.aspect = w / h;
  const f = fitCamera({ fovDeg: camera.fov, aspect: camera.aspect, span });
  gl.dist = f.dist;
  gl.maxX = f.maxX;
  gl.visible = visibleFraction(f.dist, camera.aspect, camera.fov, span);
  cam.x = clamp(cam.x, -f.maxX, f.maxX);
  const lay = placeholderLayout(books, { w, h });
  if (lay) placeMarker(els.marker, lay.plank.top + lay.plank.height + 14);
  camera.updateProjectionMatrix();
  st.dirty = true;
}
