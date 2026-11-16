// The browser's side of ring-focus.ts (R56.4): when a video tile gets keyboard focus while more than half of it is under the dock, turn its ring on until
// it is clear. Browser only (it reads boxes and animations): call it from an event handler, never while rendering.
import { DOCK_SELECTOR } from "../experience/keep-out";
import { labelSide } from "./ring-layout";
import { clearAtOnce, clearFromDock, type Box, type Frames, type Probe, type Turner } from "./ring-focus";

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

/** How many steps a way out is probed in, round a whole turn (2 degrees each): fine enough to tell the shorter way, cheap enough to run in a click. */
const PROBE_STEPS = 180;

/** The label opens on the side towards the middle of the screen: that follows the tile as the ring turns it. */
function followSide(item: HTMLElement | null, turn: Element) {
  if (!item) return;
  const box = boxOf(turn);
  const side = labelSide((box.l + box.r) / 2, window.innerWidth);
  if (item.dataset.side !== side) item.dataset.side = side;
}

/** Where the tile's label is, shown or not (it is laid out at opacity 0 until it opens), or null where the tile has none. */
const labelBox = (turn: Element): Box | null => {
  const label = turn.querySelector(".work-label");
  return label ? boxOf(label) : null;
};

const frames: Frames = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

/**
 * The ring's own turn, for a ring that animates: its CSS animation and its items' turn-back are moved on together (their `currentTime`), which works
 * while the focus has paused them, and leaves the ring where it is when it is let go (it resumes from there). A turn back past the start goes round
 * by whole periods (the animation is linear and repeats), so it never leaves the animation's running range.
 */
function animatedTurner(turn: Element, item: HTMLElement | null, anims: Animation[], periodMs: number): Turner {
  return {
    box: () => boxOf(turn),
    label: () => labelBox(turn),
    dock: dockBox,
    advance(ms) {
      for (const a of anims) {
        const to = Number(a.currentTime ?? 0) + ms;
        a.currentTime = to < 0 ? to + periodMs * Math.ceil(-to / periodMs) : to;
      }
      followSide(item, turn);
    },
  };
}

/** For a ring that stands still (reduced motion): the ring and its items are turned by `rotate`, a way and its way back, by the share of the period `ms` is. */
function stillTurner(turn: Element, item: HTMLElement | null, ring: HTMLElement): { turner: Turner; periodMs: number } {
  const cs = getComputedStyle(ring);
  const period = Number.parseFloat(cs.getPropertyValue("--dur")) * 1000 || 150000;
  const dir = Number.parseFloat(cs.getPropertyValue("--turn")) < 0 ? -1 : 1;
  let angle = Number.parseFloat(ring.style.rotate) || 0;
  const items = [...ring.querySelectorAll<HTMLElement>(".work-item-turn")];
  return {
    periodMs: period,
    turner: {
      box: () => boxOf(turn),
      label: () => labelBox(turn),
      dock: dockBox,
      advance(ms) {
        angle += (dir * 360 * ms) / period;
        ring.style.rotate = `${angle}deg`;
        for (const it of items) it.style.rotate = `${-angle}deg`;
        followSide(item, turn);
      },
    },
  };
}

/**
 * Called when `face` (a video tile's link) has keyboard focus. If more than half of its tile is under the dock, or any of its label is, the ring is turned
 * on (the way that is out sooner, when that is at most half as far) until it is clear; otherwise nothing moves. Returns what stops the turn (focus has
 * left, or the page is going).
 */
export function bringClearOfDock(face: Element): () => void {
  const turn = face.closest(".work-item-turn");
  const ring = face.closest<HTMLElement>(".work-ring");
  const item = face.closest<HTMLElement>(".work-item");
  if (!turn || !ring) return () => undefined;
  const anims = (typeof ring.getAnimations === "function" ? ring.getAnimations({ subtree: true }) : []).filter((a) => {
    const name = (a as CSSAnimation).animationName;
    return name === SPIN || name === UNSPIN;
  });
  const periodOf = (a: Animation) => Number(a.effect?.getComputedTiming().duration) || 0;
  const period = anims.length > 0 ? periodOf(anims[0]) : 0;
  if (anims.length > 0 && period > 0) {
    const probe: Probe = { stepMs: period / PROBE_STEPS, maxSteps: PROBE_STEPS };
    return clearFromDock(animatedTurner(turn, item, anims, period), frames, undefined, probe);
  }
  const { turner, periodMs } = stillTurner(turn, item, ring);
  clearAtOnce(turner, periodMs / PROBE_STEPS, PROBE_STEPS + 1); // 2 degrees a step, a whole turn at most
  return () => undefined;
}
