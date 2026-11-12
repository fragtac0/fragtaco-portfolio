import { useEffect, useRef, useState, type ComponentType } from "react";
import { usePageArrived } from "../../../lib/use-page-settled";
import WorkBackground from "../work-background";
import { canRunGround, readGroundEnv } from "./can-run";

type Scene = ComponentType<{ paused: boolean; onUnavailable: () => void }>;

/**
 * The ground of the work addresses (spec 6.4), one for /work, /work/long-form and /work/short-form: it
 * lives in the layout (`routes/work.tsx` through WorkShell), so it keeps running while the pages change
 * above it. The server and the first paint get the still CSS picture (WorkBackground). Once the page
 * has arrived (`usePageArrived`: after a page change is over) and the browser is idle, the shader scene
 * is fetched with a dynamic import and its picture fades in over the CSS picture, which matches it. The
 * scene draws one frame, keeps it as a still and lets the GPU go (see ground-scene.tsx), so nothing runs
 * per frame afterwards; while the tab is hidden a shader that is still drawing is taken down, and the CSS
 * drift (a transform) is stopped by the browser. Nothing is fetched without WebGPU (or without a WebGPU
 * adapter), with reduced motion or save-data. Decorative.
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
      // A blocklisted GPU has `navigator.gpu` but no adapter: find that out before downloading the package.
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
      Promise.resolve(gpu?.requestAdapter())
        .then((adapter) => {
          if (!adapter) throw new Error("no WebGPU adapter");
          return import("./ground-scene");
        })
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

  const live = Scene !== null && allowed && !dead && arrived;
  return (
    <WorkBackground ground>
      {live ? <Scene paused={!tabShown} onUnavailable={() => setDead(true)} /> : null}
    </WorkBackground>
  );
}
