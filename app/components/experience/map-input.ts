// The map's input (spec 9.2): drag, wheel and pinch about the pointer, double click and double tap, keys and the
// three buttons' actions. Reads events, asks `map-input-math.ts` what they mean and applies the answer to the
// map. Outside the map's own element only the keys listen (on the window, and not while an input, a link or a
// button elsewhere on the page has the key).
import type { Manifest } from "./geo";
import type { MapApi } from "./map-engine";
import {
  arrowStep, DRAG_SLOP, isArrow, isDoubleTap, keyAction, modeOf, panView, pinchEnd, pinchView, stepAction, wheelAction,
  wheelFactor, ZOOM_STEP, type Action, type Mode, type Tap,
} from "./map-input-math";
import { fitScale, fitView, FLY_MS, FOCUS_ZOOM, MAX_SCALE, type View } from "./view";

export type MapState = { mode: Mode; canIn: boolean; canOut: boolean };

export type InputHooks = {
  /** The mode or what the buttons can do changed (rarely: never per frame). */
  onState(s: MapState): void;
  /** `[` (-1) or `]` (1): fly to the previous or next moment (Task 19 supplies the moments). */
  onStep?(dir: -1 | 1): void;
};

export type MapControls = {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  /** Fly to a picture point (top level pixels) and show it `up` screen pixels above the centre, at `FOCUS_ZOOM` times the fit scale or closer. */
  focusOn(x: number, y: number, up?: number): void;
  detach(): void;
};

type Pt = { x: number; y: number };

/** A double click or double tap zooms in by this much (from the overview it enters explore). */
const DOUBLE_ZOOM = 2;
/** After a move between the states, wheel events that follow within this many ms of each other are part of the same gesture and ignored. */
const WHEEL_QUIET_MS = 140;
/** An arrow key's first press moves the picture as far as this many milliseconds of panning. */
const ARROW_TAP_MS = 50;

export function attachMapInput(root: HTMLElement, map: MapApi, m: Manifest, hooks: InputHooks): MapControls {
  const pts = new Map<number, Pt>();
  // `onMarker`: the press began on a marker or a card. It is not captured (a click must still reach the marker), so it
  // only becomes a drag, and takes the pointer, once it has moved past the slop; the click that follows a drag is swallowed.
  let drag: { id: number; x: number; y: number; sx: number; sy: number; moved: boolean; onMarker: boolean } | null = null;
  let pinch: { start: View; dist: number; mid: Pt; from: Mode } | null = null;
  let tap: Tap | null = null;
  let lastWheel = 0;
  let wheelLocked = false;
  let last: MapState | null = null;
  const held = new Set<string>();
  let heldRaf = 0;
  let heldAt = 0;

  const box = () => ({ w: root.clientWidth, h: root.clientHeight, r: root.getBoundingClientRect() });
  const fromCentre = (clientX: number, clientY: number): Pt => {
    const { w, h, r } = box();

    return { x: clientX - r.left - w / 2, y: clientY - r.top - h / 2 };
  };

  function report() {
    const { w, h } = box();
    const t = map.target();
    const s: MapState = { mode: modeOf(t, w, h, m), canIn: t.scale < MAX_SCALE * 0.999, canOut: false };

    s.canOut = s.mode === "explore";
    if (!last || last.mode !== s.mode || last.canIn !== s.canIn || last.canOut !== s.canOut) {
      last = s;
      hooks.onState(s);
    }
  }

  function toFit() {
    const { w, h } = box();

    map.setView(fitView(w, h, m), true);
    report();
  }

  function apply(a: Action, animate: boolean) {
    if (a.kind === "fit") toFit();
    else if (a.kind === "enter") map.setView(a.view, true);
    else if (a.kind === "view") map.setView(a.view, animate);
    report();
  }

  const isUi = (t: EventTarget | null) => t instanceof Element && t.closest("[data-map-ui]") !== null;
  // a press on a marker or a card is a click unless it moves (then it pans like any other press); the wheel over one still zooms
  const isMarker = (t: EventTarget | null) => t instanceof Element && t.closest("[data-map-hit]") !== null;

  /** A drag that began on a marker ends with a click on the map's own element; swallow it so the marker is not picked. */
  function swallowNextClick() {
    const swallow = (ev: Event) => ev.stopPropagation();

    root.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => root.removeEventListener("click", swallow, { capture: true }), 0);
  }

  function startPinch() {
    const [a, b] = [...pts.values()];
    const { w, h } = box();
    const start = map.view();
    const mid = fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2);

    map.setView(start); // a move in flight stops where it is
    pinch = { start, dist: Math.hypot(a.x - b.x, a.y - b.y), mid, from: modeOf(start, w, h, m) };
    drag = null;
  }

  function capture(id: number) {
    try {
      root.setPointerCapture(id);
    } catch {
      /* the pointer is already gone */
    }
  }

  function onDown(e: PointerEvent) {
    if (isUi(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
    const onMarker = isMarker(e.target);

    if (!onMarker) capture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) startPinch();
    else if (pts.size === 1) {
      if (!onMarker) map.setView(map.view()); // stop a move in flight where it is
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, onMarker };
    }
  }

  function onMove(e: PointerEvent) {
    const p = pts.get(e.pointerId);

    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    const { w, h } = box();

    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const mid = fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2);

      map.setView(pinchView(pinch.start, pinch.dist, pinch.mid, Math.hypot(a.x - b.x, a.y - b.y), mid, w, h, m));
      report();
    } else if (drag && drag.id === e.pointerId) {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < DRAG_SLOP) return;
      if (drag.onMarker && !drag.moved) {
        capture(e.pointerId);
        map.setView(map.view()); // stop a move in flight where it is
        swallowNextClick();
      }
      drag.moved = true;
      root.dataset.drag = "1";
      // the overview has nothing to pan: the picture is whole
      if (modeOf(map.view(), w, h, m) === "explore") map.setView(panView(map.view(), e.clientX - drag.x, e.clientY - drag.y, w, h, m));
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
  }

  function onUp(e: PointerEvent) {
    if (!pts.delete(e.pointerId)) return;
    try {
      root.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const { w, h } = box();

    if (pinch) {
      if (pts.size < 2) {
        const from = pinch.from;

        pinch = null;
        apply(pinchEnd(from, map.view(), w, h, m), false);
        drag = null; // the finger left down is not a drag
      }
    } else if (drag && drag.id === e.pointerId) {
      const { moved, onMarker } = drag;

      drag = null;
      delete root.dataset.drag;
      if (moved || onMarker || e.type !== "pointerup") return;
      const now: Tap = { t: e.timeStamp, x: e.clientX, y: e.clientY };

      if (isDoubleTap(tap, now)) {
        tap = null;
        if (!map.flying()) {
          const c = fromCentre(e.clientX, e.clientY);

          apply(stepAction(map.target(), DOUBLE_ZOOM, c.x, c.y, w, h, m), true);
        }
      } else {
        tap = now;
      }
    }
  }

  function onWheel(e: WheelEvent) {
    if (isUi(e.target)) return;
    e.preventDefault();
    const now = performance.now();

    // while the picture moves between the states, and for the rest of the gesture that started it, wheel events do nothing
    if (map.flying()) {
      wheelLocked = true;
      lastWheel = now;
      return;
    }
    if (wheelLocked) {
      const quiet = now - lastWheel >= WHEEL_QUIET_MS;

      lastWheel = now;
      if (!quiet) return;
      wheelLocked = false;
    }
    lastWheel = now;
    const { w, h } = box();
    const c = fromCentre(e.clientX, e.clientY);
    const a = wheelAction(map.target(), wheelFactor(e.deltaY, e.deltaMode, e.ctrlKey), c.x, c.y, w, h, m);

    if (a.kind === "enter" || a.kind === "fit") wheelLocked = true;
    apply(a, false);
  }

  function holdLoop(now: number) {
    heldRaf = 0;
    if (held.size === 0) return;
    const { w, h } = box();
    const { dx, dy } = arrowStep(held, now - heldAt);

    heldAt = now;
    if (dx !== 0 || dy !== 0) map.setView(panView(map.view(), -dx, -dy, w, h, m));
    heldRaf = requestAnimationFrame(holdLoop);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target instanceof Element ? e.target : null;

    if (t && ((t instanceof HTMLElement && t.isContentEditable) || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (isArrow(e.key)) {
      // arrows belong to a link or button elsewhere on the page (the dock) when it has focus
      const other = t?.closest("a, button, [role='button'], [role='link'], [role='tab']");

      if (other && !root.contains(other)) return;
      const { w, h } = box();

      if (modeOf(map.target(), w, h, m) !== "explore") return;
      e.preventDefault();
      // a tap moves the picture a little at once (a held key then pans on from there)
      if (!held.has(e.key)) {
        const tapStep = arrowStep(new Set([e.key]), ARROW_TAP_MS);

        map.setView(panView(map.view(), -tapStep.dx, -tapStep.dy, w, h, m));
      }
      if (held.size === 0) heldAt = performance.now();
      held.add(e.key);
      if (!heldRaf) heldRaf = requestAnimationFrame(holdLoop);

      return;
    }
    const k = keyAction(e.key);

    if (!k) return;
    if (k === "prev" || k === "next") {
      hooks.onStep?.(k === "prev" ? -1 : 1);
    } else if (k === "fit") {
      toFit();
    } else {
      const { w, h } = box();

      apply(stepAction(map.target(), k === "in" ? ZOOM_STEP : 1 / ZOOM_STEP, 0, 0, w, h, m), true);
    }
    e.preventDefault();
  }

  const onKeyUp = (e: KeyboardEvent) => {
    held.delete(e.key);
  };
  const onBlur = () => held.clear();

  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  root.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  report();

  const step = (factor: number) => {
    const { w, h } = box();

    apply(stepAction(map.target(), factor, 0, 0, w, h, m), true);
  };

  return {
    zoomIn: () => step(ZOOM_STEP),
    zoomOut: () => step(1 / ZOOM_STEP),
    fit: toFit,
    focusOn(x, y, up = 0) {
      const { w, h } = box();
      const scale = Math.max(map.target().scale, FOCUS_ZOOM * fitScale(w, h, m));

      map.setView({ cx: x, cy: y + up / scale, scale }, true, FLY_MS);
      report();
    },
    detach() {
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      root.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      cancelAnimationFrame(heldRaf);
      delete root.dataset.drag;
    },
  };
}
