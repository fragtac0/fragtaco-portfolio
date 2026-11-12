import { isDrag, pressIsStale, startsPress } from "../reading/shelf-drag";
import { columnOffset } from "./wall-math";
import { nearestInDirection } from "./wall-spread";
import type { Tile, WallCtx } from "./wall-types";
import { edgeUnwarp, edgeWarp } from "./wall-warp";

/**
 * The wall's pointer, wheel and keyboard. Touch: a tap opens the video straight away. Fine
 * pointers: hover focuses, a click opens. Keyboard (spec 8.10), while the wall runs: the arrow
 * keys move a focus highlight over the tiles (the same lens as hover, panning to keep it in view)
 * and Enter on the stage opens the focused video. Esc is HomePage's, through the hooks
 * WatchingScene registers.
 *
 * `attachWallInput` decides which events matter (modifier keys, the stage having focus, the loop
 * running); `createWallInput` holds the handler bodies, which read and write the engine's state
 * through the context. Every listener is removed when `signal` aborts.
 *
 * Once a video is chosen (`st.choice`) the wall takes no pointer input (the detail view's own
 * layer catches a click outside); only the arrow keys work, moving the choice to the nearest tile
 * in that direction among those on screen, or leaving it if there is none.
 *
 * The wall is shown through a fish-eye at its borders (wall-warp.ts), so a pointer position is put
 * through `edgeUnwarp` before it is used to hit or focus a tile; a tile's rectangle for the detail
 * view to fly from is where its corners show after `edgeWarp`.
 *
 * A press is the primary pointer's, and for a mouse only button 0 (a right-click never opens a
 * video). It is captured from the press, so its release always lands on the stage, and a mouse that
 * moves with no button held drops it (its release went elsewhere), as on the shelf (shelf-drag.ts).
 */

export type WallInputHandlers = {
  /** The frame loop is running. */
  running: () => boolean;
  /** A video is chosen (opening, open or closing). */
  locked: () => boolean;
  pointerMove: (e: PointerEvent) => void;
  pointerDown: (e: PointerEvent) => void;
  pointerUp: (e: PointerEvent) => void;
  pointerCancel: (e: PointerEvent) => void;
  pointerLeave: () => void;
  wheel: (e: WheelEvent) => void;
  /** The stage lost focus. */
  blur: () => void;
  /** Move the keyboard highlight one tile: (1, 0) right, (0, 1) down. */
  arrow: (dx: number, dy: number) => void;
  /** Open the focused video. */
  enter: () => void;
  /** The window was resized while running. */
  resize: () => void;
};

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function attachWallInput(
  canvas: HTMLCanvasElement,
  h: WallInputHandlers,
  signal: AbortSignal,
): void {
  const on = { signal };
  canvas.addEventListener("pointermove", h.pointerMove, on);
  canvas.addEventListener("pointerdown", h.pointerDown, on);
  canvas.addEventListener("pointerup", h.pointerUp, on);
  canvas.addEventListener("pointercancel", h.pointerCancel, on);
  canvas.addEventListener("pointerleave", h.pointerLeave, on);
  canvas.addEventListener("wheel", h.wheel, { passive: false, signal });
  canvas.addEventListener("blur", h.blur, on);
  window.addEventListener(
    "keydown",
    (e) => {
      if (!h.running() || e.altKey || e.ctrlKey || e.metaKey) return;
      const move = ARROWS[e.key];
      if (move) {
        e.preventDefault();
        // a chosen video has the keyboard focus on its own layer: leave it there
        if (!h.locked() && document.activeElement !== canvas) canvas.focus({ preventScroll: true });
        h.arrow(move[0], move[1]);
      } else if (e.key === "Enter" && !h.locked() && document.activeElement === canvas) {
        e.preventDefault();
        h.enter();
      }
    },
    on,
  );
  window.addEventListener("resize", () => h.running() && h.resize(), on);
}

export type WallInput = {
  /** Wire these to `attachWallInput`. */
  handlers: WallInputHandlers;
  focusNext: (dx: number, dy: number) => void;
  openFocused: () => void;
  /** The tile's current rectangle in viewport coordinates, or null when it is not in view. */
  rectOf: (key: string) => DOMRect | null;
};

export function createWallInput(
  ctx: WallCtx,
  onPick: (index: number, rect: DOMRect, key: string) => void,
  /** Re-fits the canvas (the engine owns it). */
  resize: () => void,
): WallInput {
  const { canvas, st } = ctx;
  const { pan, vel, mouse } = st;

  const kbdKey = () => (st.kbd ? `${st.kbd.cx},${st.kbd.cy}` : null);
  const locked = () => st.choice !== null;

  /** The topmost displaced tile under a point (the list is sorted, hovered last). */
  const hitAt = (x: number, y: number): Tile | null => {
    for (let k = st.tiles.length - 1; k >= 0; k--) {
      const tl = st.tiles[k];
      if (Math.abs(x - tl.cx) <= tl.w / 2 && Math.abs(y - tl.cy) <= tl.h / 2) return tl;
    }
    return null;
  };
  /** A viewport point, in flat wall coordinates. */
  const toWall = (clientX: number, clientY: number) =>
    edgeUnwarp(clientX - st.ox, clientY - st.oy, st.vw, st.vh);
  /** Where the tile shows in the viewport: the box around its warped corners. */
  const rectOfTile = (tl: Tile) => {
    const l = tl.cx - tl.w / 2;
    const t = tl.cy - tl.h / 2;
    const pts = [
      edgeWarp(l, t, st.vw, st.vh),
      edgeWarp(l + tl.w, t, st.vw, st.vh),
      edgeWarp(l, t + tl.h, st.vw, st.vh),
      edgeWarp(l + tl.w, t + tl.h, st.vw, st.vh),
    ];
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    return new DOMRect(st.ox + x0, st.oy + y0, Math.max(...xs) - x0, Math.max(...ys) - y0);
  };

  /** Forgets the press: the pointer is up, cancelled, or never had its release. */
  function endPress() {
    st.down = null;
    st.dragging = false;
  }

  /** Chooses the tile right here, so a second click cannot land while the detail view is opening. */
  function pick(tl: Tile) {
    st.choice = { key: tl.key, idx: tl.idx, live: true };
    st.hoverKey = tl.key;
    onPick(tl.idx, rectOfTile(tl), tl.key);
  }

  /** The arrow keys while a video is chosen: the choice moves to the nearest tile that way. */
  function moveChoice(dx: number, dy: number) {
    const cur = st.choice;
    if (!cur?.live) return;
    const { size, vw, vh } = st;
    const here = st.tiles.find((tl) => tl.key === cur.key);
    if (!here) return;
    const from = { x: here.x + size.cw / 2, y: here.y + size.ch / 2 };
    const near = st.tiles
      .map((tl) => ({ tl, x: tl.x + size.cw / 2, y: tl.y + size.ch / 2 }))
      .filter((c) => c.tl.key !== cur.key && c.x >= 0 && c.x <= vw && c.y >= 0 && c.y <= vh);
    const to = nearestInDirection(from, near, dx, dy)?.tl;
    if (!to) return;
    st.choice = { key: to.key, idx: to.idx, live: true };
    st.hoverKey = to.key;
    onPick(to.idx, rectOfTile(to), to.key);
  }

  function focusNext(dx: number, dy: number) {
    if (!ctx.running() || !st.tiles.length) return;
    if (st.choice) return moveChoice(dx, dy);
    const { size, vw, vh, t } = st;
    if (!st.kbd) {
      // start from the tile nearest the middle of the view
      let best: Tile | null = null;
      let bd = Infinity;
      for (const tl of st.tiles) {
        const d = Math.hypot(tl.x + size.cw / 2 - vw / 2, tl.y + size.ch / 2 - vh / 2);
        if (d < bd) {
          bd = d;
          best = tl;
        }
      }
      if (!best) return;
      const [cx, cy] = best.key.split(",").map(Number);
      st.kbd = { cx, cy };
    } else if (dx) {
      // the next column drifts on its own: take the tile nearest this one's height
      const ncx = st.kbd.cx + Math.sign(dx);
      const y = st.kbd.cy * size.pitchY - columnOffset(t, st.kbd.cx);
      st.kbd = {
        cx: ncx,
        cy: Math.round((y + columnOffset(t, ncx)) / size.pitchY),
      };
    } else if (dy) {
      st.kbd = { cx: st.kbd.cx, cy: st.kbd.cy + Math.sign(dy) };
    }
    mouse.inside = false; // the keyboard leads until the pointer moves again
  }

  function openFocused() {
    if (!ctx.running() || locked()) return;
    const key = st.kbd ? kbdKey() : st.hoverKey;
    if (key === null) return;
    const tl = st.tiles.find((x) => x.key === key);
    if (tl) pick(tl);
  }

  const handlers: WallInputHandlers = {
    running: ctx.running,
    locked,
    pointerMove(e) {
      [mouse.x, mouse.y] = toWall(e.clientX, e.clientY);
      mouse.inside = e.pointerType === "mouse";
      if (mouse.inside) st.kbd = null; // the pointer takes the focus back
      // a mouse moving with no button held has no press: its release went elsewhere
      if (pressIsStale(st.down, e)) endPress();
      const down = st.down;
      if (!down || down.id !== e.pointerId) return;
      const dx = e.clientX - down.lx;
      const dy = e.clientY - down.ly;
      down.lx = e.clientX;
      down.ly = e.clientY;
      if (!st.dragging && isDrag(Math.hypot(e.clientX - down.x, e.clientY - down.y))) {
        st.dragging = true;
      }
      if (st.dragging) {
        pan.x -= dx;
        pan.y -= dy;
        const dts = Math.max(1, e.timeStamp - down.ts) / 1000;
        vel.x = -dx / dts;
        vel.y = -dy / dts;
        down.ts = e.timeStamp;
      }
    },
    pointerDown(e) {
      if (locked() || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (!startsPress(st.down, e)) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // the pointer is already gone: the press simply ends with it
      }
      st.down = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        lx: e.clientX,
        ly: e.clientY,
        ts: e.timeStamp,
      };
      vel.x = vel.y = 0;
    },
    pointerUp(e) {
      if (!st.down || st.down.id !== e.pointerId) return;
      const wasDrag = st.dragging;
      endPress();
      if (wasDrag || locked()) return;
      vel.x = vel.y = 0;
      const [wx, wy] = toWall(e.clientX, e.clientY);
      const tl = hitAt(wx, wy);
      if (tl) pick(tl);
    },
    pointerCancel(e) {
      if (st.down?.id === e.pointerId) endPress();
    },
    pointerLeave: () => (mouse.inside = false),
    wheel(e) {
      e.preventDefault();
      if (locked()) return;
      const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? st.vh : 1;
      pan.x += e.deltaX * m;
      pan.y += e.deltaY * m;
    },
    blur() {
      // the highlight lives only while the stage has focus (opening a video moves focus on)
      if (locked()) return;
      st.kbd = null;
    },
    arrow: focusNext,
    enter: openFocused,
    resize,
  };

  return {
    handlers,
    focusNext,
    openFocused,
    rectOf(key) {
      const tl = st.tiles.find((x) => x.key === key);
      return tl ? rectOfTile(tl) : null;
    },
  };
}
