import { clamp, flatFrame, LINE_PX } from "./shelf-math";
import { placeMarker } from "./shelf-hud";
import { headerBottom } from "./shelf-head";
import type { ShelfCtx } from "./shelf-open";
import type { Book } from "./shelf-scene-types";

/**
 * Sizes the renderer and the orthographic camera to the canvas (`flatFrame`: the tallest spine at
 * most 78% of the height and under the layer's header, the row at most 88% of the width, the row
 * pans when that would make it smaller than 70%), puts the line the books stand on at its row, and works out how far the camera
 * may pan, how much of the row is on screen, and where the position marker goes (just under the
 * line), and has the spines repainted at their new size on
 * screen (`fitSpines`). Nothing happens when the size and the header's height are
 * unchanged since the last call. An open book is put back first, because its pose was laid out for the old size.
 */
/** Read by scripts/audit: every book's cover width in pixels, wanted (`coverPx`) and painted (the texture's canvas). */
export function readCovers(canvas: HTMLCanvasElement, books: Book[]): void {
  canvas.dataset.coverWant = books.map((b) => b.coverPx).join(",");
  canvas.dataset.coverTex = books.map((b) => (b.coverTex.image as HTMLCanvasElement | undefined)?.width ?? 0).join(",");
}

export function fitShelf(ctx: ShelfCtx, closeBook: (refocus: boolean) => void): void {
  const gl = ctx.scene();
  const els = ctx.els();
  if (!gl || !els) return;
  const { canvas, st, cam } = ctx;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  const top = headerBottom(canvas);
  if (w === st.fitW && h === st.fitH && top === st.fitTop) return;
  const first = st.fitW === 0; // the first fit of a mount repaints the spines at once, a resize waits for the size to settle
  st.fitW = w;
  st.fitH = h;
  st.fitTop = top;
  if (st.opened) closeBook(true);
  const { renderer: r, camera, span, line } = gl;
  r.setSize(w, h, false);
  const tallest = Math.max(...gl.books.map((b) => b.H));
  const f = flatFrame({ vw: w, vh: h, span, tallest, top });
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
  canvas.dataset.headBottom = String(top);
  canvas.dataset.pans = String(f.pans);
  // the spines are drawn at their size on screen (times the pixel ratio): repaint when the size changed
  const tallBook = gl.books.reduce((a, b) => (b.H > a.H ? b : a));
  const readSpine = () => {
    // read by scripts/audit/shelf.json: the tallest book's spine canvas, in pixels
    canvas.dataset.spinePx = `${tallBook.spine.canvas.width}x${tallBook.spine.canvas.height}`;
    // and every author's font size in CSS pixels, in book order (never under 10)
    canvas.dataset.authorPx = gl.books.map((b) => (b.spine.authorPx / b.spine.dpr).toFixed(1)).join(",");
  };
  gl.fitSpines(f.scale, first, () => {
    readSpine();
    st.dirty = true;
  });
  readSpine();
  readCovers(canvas, gl.books);
  st.dirty = true;
}
