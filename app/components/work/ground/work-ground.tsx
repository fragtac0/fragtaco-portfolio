import { useEffect, useRef, useState, type ComponentType } from "react";
import { usePageArrived } from "../../../lib/use-page-settled";
import WorkBackground from "../work-background";
import { canRunGround, readGroundEnv } from "./can-run";

type Scene = ComponentType<{ onReady: () => void; onUnavailable: () => void }>;

/**
 * The ground of the work addresses (spec 6.4), one for /work, /work/long-form and /work/short-form: it
 * lives in the layout (`routes/work.tsx` through WorkShell), so it keeps running while the pages change
 * above it. The server and the first paint get the still CSS picture (WorkBackground). Once the page
 * has arrived (`usePageArrived`: after a page change is over) and the browser is idle, the shader scene
 * is fetched with a dynamic import and its canvas fades in over the CSS picture, which matches its
 * first frame. Nothing is fetched without WebGPU, with reduced motion or save-data, and the scene is
 * taken away while the tab is hidden (the canvas and its frame loop are gone, not just paused).
 * Decorative.
 */
export default function WorkGround() {
  const arrived = usePageArrived();
  const [allowed, setAllowed] = useState(false);
  const [Scene, setScene] = useState<Scene | null>(null);
  const [tabShown, setTabShown] = useState(true);
  const [dead, setDead] = useState(false);
  const loading = useRef(false);

  // What this browser can do, and what the visitor asked for (reduced motion can change while the page is open).
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setAllowed(canRunGround(readGroundEnv()));
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  // Stops when the tab is hidden: the scene unmounts and mounts again when the tab is back.
  useEffect(() => {
    const onVisibility = () => setTabShown(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Fetch the scene once, after the change is over and the main thread has a gap.
  useEffect(() => {
    if (!arrived || !allowed || dead || Scene || loading.current) return;
    let cancelled = false;
    const start = () => {
      loading.current = true;
      import("./ground-scene")
        .then((module) => {
          if (!cancelled) setScene(() => module.default);
        })
        .catch(() => {
          if (!cancelled) setDead(true); // the CSS picture stays
        })
        .finally(() => {
          loading.current = false;
        });
    };
    // Safari has no requestIdleCallback
    const idle = "requestIdleCallback" in window;
    const handle = idle ? window.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 400);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [arrived, allowed, dead, Scene]);

  const live = Scene !== null && allowed && !dead && tabShown && arrived;
  return (
    <WorkBackground ground>
      {live ? <Scene onReady={noop} onUnavailable={() => setDead(true)} /> : null}
    </WorkBackground>
  );
}

function noop() {}
