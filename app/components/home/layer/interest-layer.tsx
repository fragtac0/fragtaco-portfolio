import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { inertProps } from "../../../utils/inert";
import CloseButton from "../../close-button";
import "./layer.css";
import { createMoveDriver, type FramedEngine, type MoveDriver } from "./move-driver";
import type { LayerKind, LayerState } from "./layer-state";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type InterestLayerProps = {
  state: LayerState;
  /** The block the layer opens out of, and closes back into. */
  from: HTMLElement | null;
  /** Opened with no move at all (a deep link or a hard load that starts open). */
  instant: boolean;
  title: string;
  meta: string;
  /** A scene is showing something over the header (an open video): fade it out and make it inert. */
  headerHidden?: boolean;
  /** The scene's own element (layer/box-scene.ts): the frame that grows, carried here from its box and back. */
  scene: HTMLElement;
  /** The scene's engine; null when it is the plain grid (no WebGL, a failed scene, a click that would not wait). */
  engine: FramedEngine | null;
  /** The home page behind: it sinks while the layer opens. */
  sinkRef: RefObject<HTMLElement>;
  /** Puts away an open video of this kind (a close that does not come from Esc). */
  closeDetail: (kind: LayerKind) => void;
  onClose: () => void;
  /** A click on the scene while it is closing: the closing turns round. */
  onReopen: () => void;
  /** Dispatched when the opening move has reached the window (the scene may answer the pointer) and when the closing has put it back in its box. */
  onGrown: () => void;
  onShrunk: () => void;
};

/**
 * The layer the shelf and the wall open into: the chrome (heading, count, Close), the black laid over the home page, and the
 * stage the scene's own element is carried onto. The opening and closing are one move (spec 6.2, 6.3) run by
 * layer/move-driver.ts; this component starts it, turns it round (Close during an opening, a click during a closing) and keeps
 * focus and the Tab key where they belong. It mounts when a box is clicked and goes when the scene is back in its box.
 */
export default function InterestLayer({
  state,
  from,
  instant,
  title,
  meta,
  headerHidden = false,
  scene,
  engine,
  sinkRef,
  closeDetail,
  onClose,
  onReopen,
  onGrown,
  onShrunk,
}: InterestLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLElement>(null);
  const driverRef = useRef<MoveDriver | null>(null);
  const { kind, phase } = state;
  const live = phase === "growing" || phase === "open";

  // Everything the move calls back is read at fire time, so the effects below restart only on a phase change.
  const latest = useRef({ from, kind, engine, instant, onGrown, onShrunk, onReopen, closeDetail });
  useLayoutEffect(() => {
    latest.current = { from, kind, engine, instant, onGrown, onShrunk, onReopen, closeDetail };
  });

  // growing: the move to the window (a fresh one, or the closing turned round); shrinking: the move back to the box
  useLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const shade = shadeRef.current;
    if ((phase !== "growing" && phase !== "shrinking") || !root || !stage || !shade) return;
    let driver = driverRef.current;
    const fresh = !driver;
    if (!driver) {
      const block = latest.current.from;
      driver = driverRef.current = createMoveDriver({
        scene,
        stage,
        box: block?.querySelector<HTMLElement>(".blk-box") ?? null,
        slot: block?.querySelector<HTMLElement>(".blk-live") ?? null,
        root,
        shade,
        head: headRef.current,
        sink: sinkRef.current,
        engine: () => latest.current.engine,
        reduced: reducedMotion(),
        closeDetail: () => {
          if (latest.current.kind) latest.current.closeDetail(latest.current.kind);
        },
        done: (to) => {
          if (to === 1) {
            latest.current.onGrown();
            closeRef.current?.focus({ preventScroll: true });
            return;
          }
          // the scene is back in its box: focus goes back to the block's button, then the layer goes
          const b = latest.current.from;
          (b?.querySelector<HTMLElement>("[data-xp]") ?? b)?.focus({ preventScroll: true });
          latest.current.onShrunk();
        },
      });
    }
    driver.go(phase === "growing" ? 1 : 0, fresh && phase === "growing" && latest.current.instant);
    // the scene, the stage and the sink are fixed for the layer's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // the window changed size: the box's place is read again
  useEffect(() => {
    const onResize = () => driverRef.current?.resized();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(
    () => () => {
      driverRef.current?.dispose();
      driverRef.current = null;
    },
    [],
  );

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
          getComputedStyle(el).visibility !== "hidden" &&
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

  // a click on the scene while it closes turns the closing round (the scene is not answering the pointer then)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || phase !== "shrinking") return;
    const onClick = (e: Event) => {
      e.preventDefault();
      latest.current.onReopen();
    };
    stage.addEventListener("click", onClick);
    return () => stage.removeEventListener("click", onClick);
  }, [phase]);

  if (phase === "closed" || kind === null) return null;

  return (
    <div
      ref={rootRef}
      className="home-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-layer-title"
    >
      <div ref={shadeRef} className="layer-shade" aria-hidden="true" />
      <div ref={stageRef} className="layer-stage" />
      <header
        ref={headRef}
        className={`xp-head${kind === "watching" ? " xp-head--wall" : ""}${
          headerHidden ? " hidden" : ""
        }`}
        {...inertProps(headerHidden)}
      >
        <div className="xp-titles">
          <h2 className="display" id="home-layer-title">
            {title}
          </h2>
          <span className="xp-meta">{meta}</span>
        </div>
        <CloseButton ref={closeRef} label="Close" onClick={onClose} />
      </header>
    </div>
  );
}
