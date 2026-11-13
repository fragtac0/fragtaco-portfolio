import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isPageSettled, subscribeSettled } from "../../lib/page-change";
import { usePageArrived } from "../../lib/use-page-settled";
import { hasWebGL } from "../../lib/webgl-support";
import type { EclipseEngine } from "./eclipse-engine";
import { WORK_PLACEMENTS, engineAllowed, runWanted, stillUrl, type Placement, type RunGate } from "./eclipse-look";
import "./eclipse.css";

// how long the canvas takes to fade (eclipse.css): it is removed once it has faded out
const FADE_MS = 500;

// React warns about a layout effect on the server: there it is a plain effect (which never runs there either).
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface EclipseGroundProps {
  placement: Placement;
  /**
   * "page" (the default): a fixed layer under the whole page, as on the work addresses. "section": fills its parent
   * (which must be `position: relative`) with a picture the size of the screen that stays in view as the parent
   * scrolls past, as behind the two shelf blocks on the home page.
   */
  scope?: "page" | "section";
  /** An open layer covers the ground: the loop stops. */
  covered?: boolean;
}

/**
 * The Eclipse ground (spec 5.1): a fixed, non-interactive layer under the page. The server and the first paint get
 * the still picture of the placement (`public/grounds/`, made from the shader), so the ground is never empty and
 * never pops in; once the page has arrived (after a page change is over) and the browser has a gap, the WebGL engine is
 * loaded by a dynamic import, draws its first frame (the same picture) and fades in over the still. Reduced motion,
 * save-data, no WebGL and a lost context keep the still. The loop runs only while the tab shows, the ground is on the
 * screen, no layer covers it and no page change is running; nothing here updates React state per frame. Decorative.
 */
export default function EclipseGround({ placement, scope = "page", covered = false }: EclipseGroundProps) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<EclipseEngine | null>(null);
  const placementNow = useRef(placement);
  const gate = useRef<RunGate>({ tab: true, inView: true, covered, settled: true });
  const arrived = usePageArrived();
  const [reduced, setReduced] = useState(true);
  // a section's ground is built only once the section has come onto the screen: the first screens of the home page keep their time
  const [near, setNear] = useState(() => scope === "page" || typeof IntersectionObserver === "undefined");

  const apply = () => engine.current?.setRunning(runWanted(gate.current));

  // reduced motion can change while the page is open
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  // what stops the loop: a hidden tab, a page change, the ground off screen
  useEffect(() => {
    const el = host.current;
    gate.current.tab = !document.hidden;
    gate.current.settled = isPageSettled();
    const onVisibility = () => {
      gate.current.tab = !document.hidden;
      apply();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const offSettled = subscribeSettled(() => {
      gate.current.settled = isPageSettled();
      apply();
    });
    // a section's ground is built, and draws, only while it is on the screen
    let observer: IntersectionObserver | undefined;
    if (scope === "section" && el && typeof IntersectionObserver !== "undefined") {
      gate.current.inView = false;
      observer = new IntersectionObserver(
        (entries) => {
          // edge to edge is not on the screen: a ratio above 0, not `isIntersecting` (true for a box that only touches the edge)
          const visible = (entries[entries.length - 1]?.intersectionRatio ?? 0) > 0;
          gate.current.inView = visible;
          if (visible) setNear(true);
          apply();
        },
        // two thresholds, so going from just touching the edge to filling the screen reports too
        { threshold: [0, 0.001] },
      );
      observer.observe(el);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      offSettled();
      observer?.disconnect();
    };
  }, [scope]);

  useEffect(() => {
    gate.current.covered = covered;
    apply();
  }, [covered]);

  // the engine: made once the page has arrived and the ground is near, freed when the ground goes
  const allowed = arrived && near && !reduced;
  useEffect(() => {
    const el = host.current;
    if (!allowed || !el) return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (!engineAllowed({ reduced: false, saveData, webgl: hasWebGL() })) return;
    let cancelled = false;
    let canvas: HTMLCanvasElement | null = null;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    const start = () => {
      void import("./eclipse-engine").then(({ createEclipseEngine }) => {
        if (cancelled) return;
        const made = document.createElement("canvas");
        made.className = "eclipse-canvas";
        el.appendChild(made);
        const created = createEclipseEngine(made, {
          placement: placementNow.current,
          onLost: () => {
            // a lost context is final: the canvas goes at once and the still stays. It is not faded: a lost canvas has
            // no picture left (the browser paints it blank and pale), so a fade would flash that over the still.
            delete el.dataset.live;
            engine.current = null;
            made.remove();
          },
        });
        if (!created) {
          made.remove(); // no WebGL after all, or the shader would not build: the still stays
          return;
        }
        canvas = made;
        engine.current = created;
        observer = new ResizeObserver(() => created.resize());
        observer.observe(made);
        apply();
        frame = requestAnimationFrame(() => {
          el.dataset.live = "true"; // fades in over the still, which shows the same picture
        });
      }).catch(() => {
        // the engine chunk did not load (offline, a stale chunk after a deploy): the still stays
      });
    };
    const idle = "requestIdleCallback" in window;
    const handle = idle ? window.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 400);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      cancelAnimationFrame(frame);
      observer?.disconnect();
      // the engine goes out the way it came in: it stops on its last frame, the canvas fades to the still, then it is freed
      const leaving = engine.current;
      const leavingCanvas = canvas;
      engine.current = null;
      leaving?.setRunning(false);
      delete el.dataset.live;
      window.setTimeout(() => {
        leaving?.destroy();
        leavingCanvas?.remove();
      }, FADE_MS + 50);
    };
  }, [allowed]);

  // a new placement (the work address changed under the layout) is drawn in the same commit as the new still
  useIsoLayoutEffect(() => {
    placementNow.current = placement;
    engine.current?.setPlacement(placement);
  }, [placement]);

  const placements = scope === "page" ? WORK_PLACEMENTS : [placement];
  const ground = (
    <div ref={host} className="eclipse" data-scope={scope} aria-hidden="true">
      {placements.map((p) => (
        <picture key={p} className="eclipse-still" data-on={p === placement ? "true" : "false"}>
          <source media="(orientation: portrait)" srcSet={stillUrl(p, true)} type="image/webp" />
          <img src={stillUrl(p, false)} alt="" width={1280} height={800} decoding="async" draggable={false} />
        </picture>
      ))}
    </div>
  );
  return scope === "section" ? <div className="eclipse-wrap">{ground}</div> : ground;
}
