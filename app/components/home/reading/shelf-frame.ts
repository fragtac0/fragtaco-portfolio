import { clearPlacement, noTransition, windowSize, type FrameBox } from "../layer/frame-box";
import { COARSE_STEP, coarseBuffer, dotPlacement, placeRegion, subWindow } from "../layer/frame-math";
import { containFraming, dotRegion, dotRes, framingRect, shelfFraming, type Rect, type Row } from "./box-framing";
import type { ShelfCtx, ShelfState } from "./shelf-open";
import { RENDER_DPR_MAX } from "./shelf-math";
import { newBag, type ShelfScene } from "./shelf-scene";

/**
 * The shelf's picture in a frame (layer/frame-math.ts). The row is always fitted to the window the open page would fill
 * (`stageSize`); a frame only changes how much of that picture the canvas shows: the renderer is the frame's size and the
 * orthographic camera looks at the part of the picture the frame covers (`setViewOffset`), so the ledge, the books and their shadows are drawn
 * as they are in the open page. Which part is the box framing (box-framing.ts, `viewFor`): the whole row on its ledge in the box, easing over
 * a move to the whole window; before the first fit (no row yet) the window's picture scaled to cover the frame, centred. The dot field is a
 * canvas of its own behind the row: it is placed by the same maths (`placeDots`).
 */

/** What a frame shows of the open page's picture: the part (it may stick out of the window) and the part the dot field is painted over. */
export type ShelfView = { sub: Rect; region: Rect | null; /** `dotRes` of the box's framing: how fine the dot field is painted (1 when not framed). */ res: number };

/**
 * The view for the frame in force. Framed, with the row of the last fit: the box framing at the move's position (a frame that says nothing of
 * a move is the open page if it covers the window, else a box at rest), the row sliding with the camera (`scale` CSS pixels per world unit).
 * Framed without a row: the cover. Not framed: the whole window.
 */
export function viewFor(ctx: ShelfCtx, scale: number, vw: number, vh: number): ShelfView {
  const f = ctx.box.frame();
  const row = ctx.st.row;
  if (!f || !row) return { sub: subWindow(f, vw, vh), region: null, res: 1 };
  const shift = -(ctx.cam?.x ?? 0) * scale;
  const slid: Row = { ...row, left: row.left + shift, right: row.right + shift };
  const win = { w: vw, h: vh };
  const mv = ctx.box.move();
  const covers = f.width >= vw && f.height >= vh;
  const box = mv ? { w: mv.box.width, h: mv.box.height } : { w: f.width, h: f.height };
  const t = mv ? mv.t : covers ? 1 : 0;
  return {
    sub: framingRect(shelfFraming(box, win, slid, t), { w: f.width, h: f.height }),
    region: dotRegion(box, win, slid),
    res: dotRes(containFraming(box, slid).scale),
  };
}

/** A hair added to a whole device pixel count before it is divided by the ratio, so three's `floor(size * ratio)` never lands one short. */
const BUFFER_EPS = 0.01;

/** The size the row is fitted to: the canvas's own when nothing is framed, else the window. */
export function stageSize(canvas: HTMLCanvasElement, box: FrameBox): [number, number] {
  return box.frame() ? windowSize() : [canvas.clientWidth, canvas.clientHeight];
}

/**
 * Sizes the renderer for the frame in force and points the camera at what it shows. Only when something changed: setting a canvas
 * size clears it, and the caller draws right after.
 */
export function applyView(ctx: ShelfCtx, gl: ShelfScene, vw: number, vh: number, view?: ShelfView): void {
  const f = ctx.box.frame();
  const sub = (view ?? viewFor(ctx, gl.scale, vw, vh)).sub;
  let cw = f ? f.width : vw;
  let ch = f ? f.height : vh;
  // a moving frame (the box opening or closing) keeps its drawing buffer larger than it is, allocated every few frames and not at every one
  // (`coarseBuffer`); the picture is drawn into the whole buffer and the canvas shows it at the frame's size, so its geometry is the frame's
  const pr = gl.renderer.getPixelRatio();
  if (f && ctx.box.coarse()) {
    // the buffer the window itself gets is `floor(vw * pr)` (three's setSize floors): that is the most a move's buffer ever is, so the end
    // of the opening (the window's own size) is the very buffer it already holds, also where `vw * pr` is not whole (dpr 1.75 at 1366 or 390)
    const held = gl.renderer.domElement;
    const capW = Math.floor(vw * pr);
    const capH = Math.floor(vh * pr);
    // `+ BUFFER_EPS` keeps a whole number of device pixels whole through the division by the ratio and three's multiplication and floor
    cw = (coarseBuffer(Math.min(cw * pr, capW), held.width, COARSE_STEP, capW) + BUFFER_EPS) / pr;
    ch = (coarseBuffer(Math.min(ch * pr, capH), held.height, COARSE_STEP, capH) + BUFFER_EPS) / pr;
  }
  const key = `${cw}x${ch}|${sub.x},${sub.y},${sub.w},${sub.h}|${vw}x${vh}`;
  if (key === ctx.st.viewKey) return;
  ctx.st.viewKey = key;
  // the buffer is allocated only when its size in device pixels changes (a coarse frame often leaves it as it is; the end of a move
  // that lands on the window's own buffer leaves it too); a new pixel ratio clears it (syncRatio)
  const size = `${Math.floor(cw * pr)}x${Math.floor(ch * pr)}`;
  if (size !== ctx.st.sizeKey) {
    ctx.st.sizeKey = size;
    gl.renderer.setSize(cw, ch, false);
  }
  const whole = sub.x === 0 && sub.y === 0 && sub.w === vw && sub.h === vh;
  if (whole) gl.camera.clearViewOffset();
  else gl.camera.setViewOffset(vw, vh, sub.x, sub.y, sub.w, sub.h);
  gl.camera.updateProjectionMatrix();
}

/**
 * Sets the renderer's pixel ratio: the screen's (`device`) up to `RENDER_DPR_MAX`, and up to `cap` while docked with a cap. A new
 * ratio makes the next `applyView` size the renderer again and has the shelf drawn.
 */
export function syncRatio(gl: ShelfScene, st: ShelfState, device: number, cap: number | undefined): void {
  const ratio = Math.min(device || 1, RENDER_DPR_MAX, cap ?? Infinity);
  if (gl.renderer.getPixelRatio() === ratio) return;
  gl.renderer.setPixelRatio(ratio);
  st.viewKey = "";
  st.sizeKey = "";
  st.dirty = true;
}

const DOT_STYLES = ["position", "left", "top", "width", "height", "transform", "transform-origin", "clip-path", "--dot-res"] as const;

/**
 * Puts the dot field where the frame's picture has it (or back to the stylesheet's place with no frame). In a frame the caller
 * places (`place: false`) it is positioned absolutely from the frame's own corner instead, in the canvas's offset parent.
 */
export function placeDots(
  dots: HTMLElement | undefined,
  box: FrameBox,
  vw: number,
  vh: number,
  ledgeTop: number,
  view?: ShelfView,
): void {
  if (!dots) return;
  const f = box.frame();
  const own = box.placed();
  const at = f && (own ? f : { ...f, left: 0, top: 0 });
  const p = at && (view?.region ? placeRegion(at, view.sub, view.region) : dotPlacement(at, vw, vh, ledgeTop));
  const s = dots.style;
  if (!p) {
    clearPlacement(dots, DOT_STYLES, () => box.frame() !== null);
    return;
  }
  s.position = own ? "fixed" : "absolute";
  s.left = `${p.left}px`;
  s.top = `${p.top}px`;
  s.width = `${p.width}px`;
  s.height = `${p.height}px`;
  s.transformOrigin = "0 0";
  s.transform = `scale(${p.scale})`;
  // the dot field's own hook paints at this share of its pixel ratio (use-dot-field.ts)
  if (view?.region && view.res < 1) s.setProperty("--dot-res", String(view.res));
  else s.removeProperty("--dot-res");
  const [t, r, b, l] = p.inset;
  s.clipPath = `inset(${t}px ${r}px ${b}px ${l}px)`;
  noTransition(dots);
}

/**
 * Docks or undocks the shelf's canvas: out of the tab order and let the pointer through while docked, the hover and the press
 * forgotten, and an open book put away at once (without its closing animation, which would keep the docked shelf drawing).
 */
export function dockStage(
  canvas: HTMLCanvasElement,
  st: ShelfState,
  on: boolean,
  gl?: Pick<ShelfScene, "books"> | null,
  closeBook?: (refocus: boolean) => void,
): void {
  canvas.style.pointerEvents = on ? "none" : "";
  canvas.tabIndex = on ? -1 : 0;
  if (!on) {
    canvas.removeAttribute("aria-hidden");
    return;
  }
  canvas.setAttribute("aria-hidden", "true");
  canvas.blur();
  st.inside = false;
  st.hoverHit = null;
  st.focusIdx = -1;
  st.down = null;
  st.flickV = 0;
  st.dirty = true;
  canvas.classList.remove("dragging");
  closeBook?.(false);
  gl?.books.forEach((b) => (b.anim = newBag()));
}
