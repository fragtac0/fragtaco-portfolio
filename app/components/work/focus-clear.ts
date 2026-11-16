// The browser's side of ring-focus.ts (R56.4): when a video tile gets keyboard focus while more than half of it is under the dock, turn its ring on until
// it is clear. Browser only (it reads boxes and animations): call it from an event handler, never while rendering.
import { DOCK_SELECTOR } from "../experience/keep-out";
import { clearAtOnce, clearFromDock, type Box, type Frames, type Turner } from "./ring-focus";

const SPIN = "work-spin";
const UNSPIN = "work-unspin";

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { l: r.left, t: r.top, r: r.right, b: r.bottom };
};

/** The dock's glass as it is on the screen, or null where it is not (hidden, or not on this page). */
function dockBox(): Box | null {
  const glass = document.querySelector(DOCK_SELECTOR);
  if (!glass) return null;
  const box = boxOf(glass);
  return box.r > box.l && box.b > box.t ? box : null;
}

const frames: Frames = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

/**
 * The ring's own turn, for a ring that animates: its CSS animation and its items' turn-back are moved on together (their `currentTime`), which works
 * while the focus has paused them, and leaves the ring where it is when it is let go (it resumes from there).
 */
function animatedTurner(turn: Element, anims: Animation[]): Turner {
  return {
    box: () => boxOf(turn),
    dock: dockBox,
    advance(ms) {
      for (const a of anims) a.currentTime = Number(a.currentTime ?? 0) + ms;
    },
  };
}

/** For a ring that stands still (reduced motion): the ring and its items are turned by `rotate`, a way and its way back, by the share of the period `ms` is. */
function stillTurner(turn: Element, ring: HTMLElement): { turner: Turner; periodMs: number } {
  const cs = getComputedStyle(ring);
  const period = Number.parseFloat(cs.getPropertyValue("--dur")) * 1000 || 150000;
  const dir = Number.parseFloat(cs.getPropertyValue("--turn")) < 0 ? -1 : 1;
  let angle = Number.parseFloat(ring.style.rotate) || 0;
  const items = [...ring.querySelectorAll<HTMLElement>(".work-item-turn")];
  return {
    periodMs: period,
    turner: {
      box: () => boxOf(turn),
      dock: dockBox,
      advance(ms) {
        angle += (dir * 360 * ms) / period;
        ring.style.rotate = `${angle}deg`;
        for (const item of items) item.style.rotate = `${-angle}deg`;
      },
    },
  };
}

/**
 * Called when `face` (a video tile's link) has keyboard focus. If more than half of its tile is under the dock the ring is turned on until it is clear;
 * otherwise nothing moves. Returns what stops the turn (focus has left, or the page is going).
 */
export function bringClearOfDock(face: Element): () => void {
  const turn = face.closest(".work-item-turn");
  const ring = face.closest<HTMLElement>(".work-ring");
  if (!turn || !ring) return () => undefined;
  const anims = (typeof ring.getAnimations === "function" ? ring.getAnimations({ subtree: true }) : []).filter((a) => {
    const name = (a as CSSAnimation).animationName;
    return name === SPIN || name === UNSPIN;
  });
  if (anims.length > 0) return clearFromDock(animatedTurner(turn, anims), frames);
  const { turner, periodMs } = stillTurner(turn, ring);
  clearAtOnce(turner, periodMs / 120, 121); // 3 degrees a step, a whole turn at most
  return () => undefined;
}
