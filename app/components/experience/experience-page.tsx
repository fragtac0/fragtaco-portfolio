import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import manifestJson from "../../../public/mars/manifest.json";
import { usePageArrived } from "../../lib/use-page-settled";
import type { SiteExperience } from "../../types";
import { useReducedMotion } from "../work/gallery/use-reduced-motion";
import EdgeFocus from "./edge-focus";
import { ManifestSchema, type Manifest } from "./geo";
import { MomentList } from "./experience-plain";
import MapControls from "./map-controls";
import { createMap } from "./map-engine";
import { attachMapInput, type MapControls as Controls, type MapState } from "./map-input";
import type { View } from "./view";
import "./experience.css";

/** The tile pyramid's description (`public/mars/manifest.json`, made by `yarn mars`), checked once on load. */
const MANIFEST: Manifest = ManifestSchema.parse(manifestJson);

const OVERVIEW: MapState = { mode: "overview", canIn: true, canOut: false };

/** Is there a 2D canvas, and did the visitor ask for less data? Either one leaves the picture as one image. */
function mapAvailable(): boolean {
  try {
    if (document.createElement("canvas").getContext("2d") === null) return false;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

    return connection?.saveData !== true && !window.matchMedia("(prefers-reduced-data: reduce)").matches;
  } catch {
    return false;
  }
}

const never = () => () => {};

/** The view as CSS variables on the page: layers inside it follow without React state (see experience.css). */
function writeView(el: HTMLElement, v: View) {
  el.style.setProperty("--map-cx", v.cx.toFixed(2));
  el.style.setProperty("--map-cy", v.cy.toFixed(2));
  el.style.setProperty("--map-s", v.scale.toPrecision(6));
}

/**
 * My experience as a map of Olympus Mons (spec 9). The picture is a tile pyramid drawn on one canvas by the map
 * engine; the page starts it once the page change is over. Until the canvas has painted, and for good where
 * there is no canvas or the visitor wants less data, the picture is plain `<img>` elements (the level 1 tiles,
 * which the route preloads, or the level 2 mosaic as one image). The heading block (top left) and the caption
 * (lower left) show in the overview and fade out in explore.
 *
 * For the route, the moments, the places and the words (Task 19), two layers follow the view through the CSS
 * variables `--map-cx`, `--map-cy` (the picture pixel at the screen's centre) and `--map-s` (screen pixels per
 * picture pixel): `.map-plane` is the picture itself at its top level size (8192 px, scaled with the map: route
 * SVG goes here) and `.map-pins` is a screen-sized layer for things that keep their size (markers: position them
 * with calc from the variables). Both are empty here. `onStep` (the `[` and `]` keys) is for them too.
 */
export default function ExperiencePage({ experience, onStep }: { experience: SiteExperience; onStep?: (dir: -1 | 1) => void }) {
  const { heading, caption, facts, moments } = experience;
  const fact = facts.find((f) => f.id === caption.factId);
  const page = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef<Controls | null>(null);
  const step = useRef(onStep);
  // false on the server and while hydrating, so the first render is the same on both
  const available = useSyncExternalStore(never, mapAvailable, () => true);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<MapState>(OVERVIEW);
  const arrived = usePageArrived(1);
  // "on" from the moment the effect below runs for the arrived page
  const engine = !available || failed ? "off" : arrived ? "on" : "pending";
  const reduced = useReducedMotion();

  useEffect(() => {
    step.current = onStep;
  });

  // Heavy work (the canvas, the tiles) starts after the page change is over.
  useEffect(() => {
    const el = page.current;
    const cv = canvas.current;

    if (!arrived || !el || !cv || !available) return;
    const t0 = performance.now();
    let map: ReturnType<typeof createMap>;

    try {
      map = createMap(cv, MANIFEST, {
        reduced,
        onView: (v) => writeView(el, v),
        onPaint: () => {
          el.dataset.painted = String(Math.round(performance.now() - t0)); // milliseconds after the change ended
        },
      });
    } catch {
      queueMicrotask(() => setFailed(true)); // the canvas gave no context after all: the picture stays an image
      return;
    }
    el.style.setProperty("--map-size", `${MANIFEST.size}px`);
    const input = attachMapInput(el, map, MANIFEST, { onState: setState, onStep: (dir) => step.current?.(dir) });

    controls.current = input;

    return () => {
      controls.current = null;
      input.detach();
      map.destroy();
      delete el.dataset.painted;
      setState(OVERVIEW);
    };
  }, [arrived, available, reduced]);

  return (
    <main ref={page} className="map-page" data-mode={state.mode} data-engine={engine} aria-label="Map of Olympus Mons, Mars">
      {engine === "off" ? (
        <div className="map-seed">
          <img src="/mars/mosaic.webp" alt="Olympus Mons, Mars, seen from above" width={2048} height={2048} draggable={false} />
        </div>
      ) : (
        <div className="map-seed" aria-hidden="true">
          {[0, 1].flatMap((y) =>
            [0, 1].map((x) => <img key={`${x}${y}`} src={`/mars/1/${x}_${y}.webp`} alt="" width={512} height={512} draggable={false} decoding="async" />),
          )}
        </div>
      )}
      <canvas ref={canvas} className="map-canvas" aria-hidden="true" />
      <EdgeFocus />
      <div className="map-plane" aria-hidden="true" />
      <div className="map-pins" />
      <header className="map-heading">
        <h1 className="map-title">{heading.title}</h1>
        <p className="map-text">{heading.text}</p>
      </header>
      <figure className="map-caption">
        <figcaption>
          <span className="map-caption-title">{caption.title}</span>
          <span className="map-caption-line">{caption.line}</span>
          {fact ? <span className="map-caption-fact">{fact.text}</span> : null}
          <span className="map-caption-credit">{caption.credit}</span>
        </figcaption>
      </figure>
      {engine === "on" ? (
        <MapControls state={state} onIn={() => controls.current?.zoomIn()} onOut={() => controls.current?.zoomOut()} onFit={() => controls.current?.fit()} />
      ) : null}
      <div className="sr-only">
        <MomentList moments={moments} label="My experience, in order" />
      </div>
    </main>
  );
}
