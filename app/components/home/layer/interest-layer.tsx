import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { inertProps } from "../../../utils/inert";
import "./layer.css";
import { cloneBlock, posterPose, posterTransform, type PosterPose } from "./layer-poster";
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

/** The poster dissolves over this long once the scene has drawn (layer.css `.layer-poster`). */
const POSTER_FADE_MS = 350;
/** A scene that never says it has drawn does not keep the poster up for ever. */
const DRAWN_GIVE_UP_MS = 3000;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type InterestLayerProps = {
  state: LayerState;
  /** The block the layer grows out of, and shrinks back into. */
  from: HTMLElement | null;
  title: string;
  meta: string;
  /** A scene is showing something over the header (an open video): fade it out and make it inert. */
  headerHidden?: boolean;
  onClose: () => void;
  /** Dispatched once the grow has finished (the scene may start) and the shrink has finished. */
  onGrown: () => void;
  onShrunk: () => void;
  /**
   * The scene for the open kind. `active` is true from the end of the grow to the start of the
   * shrink. The scene calls `onDrawn` once its first real frame is on the screen (or at once if it
   * has no frame to wait for, like the plain grids): until then the layer shows the block's picture.
   */
  children: (scene: { kind: LayerKind; active: boolean; onDrawn: () => void }) => ReactNode;
};

export default function InterestLayer({
  state,
  from,
  title,
  meta,
  headerHidden = false,
  onClose,
  onGrown,
  onShrunk,
  children,
}: InterestLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const { kind, phase } = state;
  const live = phase === "growing" || phase === "open";

  // The scene's first real frame has been drawn: the stage is shown and the poster dissolves. It
  // stays set through the close, so the scene's last frame stays in the box while it shrinks. The
  // layer mounts afresh for each open, so this starts false each time.
  const [drawn, setDrawn] = useState(false);
  // (a scene only calls this once it is active, which is from the end of the grow)
  const onDrawn = useCallback(() => setDrawn(true), []);
  useEffect(() => {
    if (phase !== "open" || drawn) return;
    const t = window.setTimeout(() => setDrawn(true), DRAWN_GIVE_UP_MS);
    return () => window.clearTimeout(t);
  }, [phase, drawn]);

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
    // the block's own picture stands in the box at the block's place and size, so the box is never
    // the bare ground while the scene is built (layer-poster.ts)
    const poster = posterRef.current;
    const block = latest.current.from;
    let pose: PosterPose | null = null;
    if (poster && block) {
      const r = block.getBoundingClientRect();
      const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
      poster.replaceChildren(cloneBlock(block, rect));
      Object.assign(poster.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transition: "none",
        transform: "none",
        opacity: "1",
      });
      poster.classList.remove("go");
      pose = posterPose(rect, window.innerWidth, window.innerHeight);
    }
    root.style.transition = "none";
    root.style.clipPath = reduced ? FULL : insetFrom(latest.current.from);
    void root.offsetWidth; // commit the start rect before transitioning from it
    root.style.transition = "";
    if (reduced) {
      if (poster && pose) {
        poster.style.transform = posterTransform(pose);
        poster.classList.add("go");
      }
    } else {
      raf = requestAnimationFrame(() => {
        root.style.transition = `clip-path ${GROW_MS}ms ${EASE}`;
        root.style.clipPath = FULL;
        if (poster && pose) {
          poster.style.transition = `transform ${GROW_MS}ms ${EASE}`;
          poster.style.transform = posterTransform(pose);
          poster.classList.add("go");
        }
      });
    }
    // the scene starts only after the grow finishes, so the clip never competes with a shader compile
    const t = window.setTimeout(() => latest.current.onGrown(), reduced ? 0 : SCENE_DELAY_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [phase]);

  // The poster dissolves once the scene has drawn (the stage is shown at the same moment, in layer.css),
  // and is emptied when it is gone.
  useLayoutEffect(() => {
    const poster = posterRef.current;
    if (!drawn || !poster) return;
    poster.style.transition = `opacity ${POSTER_FADE_MS}ms ease`;
    poster.style.opacity = "0";
    const t = window.setTimeout(() => poster.replaceChildren(), POSTER_FADE_MS + 50);
    return () => window.clearTimeout(t);
  }, [drawn]);

  // shrinking: the layer clips back into the block with the scene's last frame (or, closed before the
  // scene drew, the block's picture) staying in the box, then it is hidden and focus goes back to the
  // block's button. With reduced motion nothing waits.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (phase !== "shrinking" || !root) return;
    const reduced = reducedMotion();
    const poster = posterRef.current;
    root.style.transition = reduced ? "none" : `clip-path ${GROW_MS}ms ${EASE}`;
    root.style.clipPath = insetFrom(latest.current.from);
    if (poster && poster.firstChild && poster.style.opacity !== "0") {
      poster.style.transition = reduced ? "none" : `transform ${GROW_MS}ms ${EASE}`;
      poster.style.transform = "none";
      poster.classList.remove("go");
    }
    const done = window.setTimeout(
      () => {
        const block = latest.current.from;
        const target = block?.querySelector<HTMLElement>("[data-xp]") ?? block;
        target?.focus({ preventScroll: true });
        latest.current.onShrunk();
      },
      reduced ? 0 : SCENE_DELAY_MS,
    );
    return () => window.clearTimeout(done);
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
      className={`home-layer${drawn && (phase === "open" || phase === "shrinking") ? " ready" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-layer-title"
    >
      <header className={headerHidden ? "xp-head hidden" : "xp-head"} {...inertProps(headerHidden)}>
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
      <div ref={posterRef} className="layer-poster home-blocks" aria-hidden="true" />
      {KINDS.map((k) => (
        <div key={k} className={`xp-pane ${PANE_CLASS[k]}${k === kind ? " on" : ""}`}>
          <div className="tex" />
          <div className="stage">
            {k === kind ? children({ kind: k, active: phase === "open", onDrawn }) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
