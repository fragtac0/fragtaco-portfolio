import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import "./layer.css";
import { GROW_MS, SCENE_DELAY_MS, type LayerKind, type LayerState } from "./layer-state";

const FULL = "inset(0px 0px 0px 0px round 0px 0px 0px 0px)";
const EASE = "cubic-bezier(.7,0,.2,1)";
const KINDS: readonly LayerKind[] = ["reading", "watching"];
const PANE_CLASS: Record<LayerKind, string> = {
  reading: "pane-read",
  watching: "pane-watch",
};
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** The block's current rect as a clip, with the block's own corners (mockup: --r-lg). */
function insetFrom(el: HTMLElement | null): string {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const r = el?.getBoundingClientRect() ?? {
    top: h / 2,
    bottom: h / 2,
    left: w / 2,
    right: w / 2,
  };
  return `inset(${r.top}px ${w - r.right}px ${h - r.bottom}px ${
    r.left
  }px round 44px 20px 44px 20px)`;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type InterestLayerProps = {
  state: LayerState;
  /** The block the layer grows out of, and shrinks back into. */
  from: HTMLElement | null;
  title: string;
  meta: string;
  onClose: () => void;
  /** Dispatched once the grow has finished (the scene may start) and the shrink has finished. */
  onGrown: () => void;
  onShrunk: () => void;
  /** The scene for the open kind. `active` is true from the end of the grow to the start of the shrink. */
  children: (scene: { kind: LayerKind; active: boolean }) => ReactNode;
};

export default function InterestLayer({
  state,
  from,
  title,
  meta,
  onClose,
  onGrown,
  onShrunk,
  children,
}: InterestLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { kind, phase } = state;
  const live = phase === "growing" || phase === "open";

  // Callbacks and the origin block are read at fire time, so the effects below only
  // restart on a phase change.
  const latest = useRef({ from, onGrown, onShrunk });
  useLayoutEffect(() => {
    latest.current = { from, onGrown, onShrunk };
  });

  // growing: start from the block's rect, then open to full screen on the next frame.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (phase !== "growing" || !root) return;
    const reduced = reducedMotion();
    let raf = 0;
    root.style.transition = "none";
    root.style.clipPath = reduced ? FULL : insetFrom(latest.current.from);
    void root.offsetWidth; // commit the start rect before transitioning from it
    root.style.transition = "";
    if (!reduced) {
      raf = requestAnimationFrame(() => {
        root.style.transition = `clip-path ${GROW_MS}ms ${EASE}`;
        root.style.clipPath = FULL;
      });
    }
    // the scene starts only after the grow finishes, so the clip never competes with a shader compile
    const t = window.setTimeout(() => latest.current.onGrown(), reduced ? 0 : SCENE_DELAY_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [phase]);

  // shrinking: clip back into the block, then hide and give focus back to its button.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (phase !== "shrinking" || !root) return;
    const reduced = reducedMotion();
    root.style.transition = reduced ? "none" : `clip-path ${GROW_MS}ms ${EASE}`;
    root.style.clipPath = insetFrom(latest.current.from);
    const t = window.setTimeout(
      () => {
        const block = latest.current.from;
        const target = block?.querySelector<HTMLElement>("[data-xp]") ?? block;
        target?.focus({ preventScroll: true });
        latest.current.onShrunk();
      },
      reduced ? 0 : SCENE_DELAY_MS,
    );
    return () => window.clearTimeout(t);
  }, [phase]);

  // focus lands on Close 450 ms after opening
  useEffect(() => {
    if (!live) return;
    const t = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 450);
    return () => window.clearTimeout(t);
  }, [live]);

  // keep Tab inside the layer while it is open
  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = rootRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) =>
          el.tabIndex >= 0 &&
          !el.closest("[inert]") &&
          (el.offsetParent !== null || el === document.activeElement),
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!active || !root.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [live]);

  if (phase === "closed" || kind === null) return null;

  return (
    <div
      ref={rootRef}
      className={`home-layer${phase === "open" ? " ready" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-layer-title"
    >
      <header className="xp-head">
        <div className="xp-titles">
          <h2 className="display" id="home-layer-title">
            {title}
          </h2>
          <span className="xp-meta">{meta}</span>
        </div>
        <button ref={closeRef} type="button" className="xp-close" onClick={onClose}>
          Close <kbd>Esc</kbd>
        </button>
      </header>
      {KINDS.map((k) => (
        <div key={k} className={`xp-pane ${PANE_CLASS[k]}${k === kind ? " on" : ""}`}>
          <div className="tex" />
          <div className="stage">
            {k === kind ? children({ kind: k, active: phase === "open" }) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
