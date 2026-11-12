import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import manifestJson from "../../../public/mars/manifest.json";
import { usePageArrived, usePageSettled } from "../../lib/use-page-settled";
import type { SiteExperience } from "../../types";
import { useReducedMotion } from "../work/gallery/use-reduced-motion";
import { planCards, scaleOfStep, zoomStepOf } from "./card-layout";
import EdgeFocus from "./edge-focus";
import { StruckTitle, MomentList } from "./experience-plain";
import { ManifestSchema, type Manifest } from "./geo";
import HeadingBlock from "./heading-block";
import { buildJourney, stepMoment } from "./journey";
import MapCaption from "./map-caption";
import MapControls from "./map-controls";
import { createMap } from "./map-engine";
import { attachMapInput, type MapControls as Controls, type MapState } from "./map-input";
import MapSheet from "./map-sheet";
import ModeSwitch, { type Layer } from "./mode-switch";
import MomentMarker from "./moment-marker";
import { placePoint } from "./places";
import PlacesLayer from "./places-layer";
import RouteLayer from "./route-layer";
import { CLIFF_SPAN, FIT_RING_SHARE, type View } from "./view";
import "./experience.css";
import "./map-layers.css";
import "./map-cards.css";
import "./map-places.css";

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
 * Two layers follow the view through the CSS variables `--map-cx`, `--map-cy` (the picture pixel at the screen's
 * centre) and `--map-s` (screen pixels per picture pixel): `.map-plane` is the picture itself at its top level size
 * (the route, an SVG scaled with the map) and `.map-pins` is a screen-sized layer for what keeps its size (the moments,
 * the places, the ping), each placed from the variables by CSS. Journey shows the route and the moments, Places the
 * named features. The words all come from the content file; `[` and `]` step through the moments (or the places).
 */
export default function ExperiencePage({ experience, today }: { experience: SiteExperience; today: string }) {
  const { heading, caption, facts, moments, places, ui } = experience;
  const fact = facts.find((f) => f.id === caption.factId);
  const frame = useMemo(
    () => ({ centre: experience.frame.centre, spanDeg: experience.frame.spanDeg, lonScale: MANIFEST.lonScale, size: MANIFEST.size }),
    [experience.frame],
  );
  const journey = useMemo(() => buildJourney(experience.route, moments, today, frame), [experience.route, moments, today, frame]);
  const spots = useMemo(() => places.map((p) => placePoint(p, experience.cliff.points, frame)), [places, experience.cliff, frame]);
  const [layer, setLayer] = useState<Layer>("journey");
  const [active, setActive] = useState<number | null>(null);
  // the zoom in quarter octaves (null until the map has a view): the cards are laid out again when it or the active moment changes, not every frame
  const [zoomStep, setZoomStep] = useState<number | null>(null);
  const stepRef = useRef<number | null>(null);
  const cards = useMemo(
    () =>
      zoomStep === null
        ? null
        : planCards(journey.moments, moments, journey.moments.map((m) => m.placement), scaleOfStep(zoomStep), active),
    [zoomStep, journey, moments, active],
  );
  const [activePlace, setActivePlace] = useState<number | null>(null);
  const settled = usePageSettled();
  const page = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef<Controls | null>(null);
  const step = useRef<(dir: -1 | 1) => void>(() => {});
  // false on the server and while hydrating, so the first render is the same on both
  const available = useSyncExternalStore(never, mapAvailable, () => true);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<MapState>(OVERVIEW);
  const arrived = usePageArrived(1);
  // "on" from the moment the effect below runs for the arrived page
  const engine = !available || failed ? "off" : arrived ? "on" : "pending";
  const reduced = useReducedMotion();
  // what the sheet over the dock (phones) shows: the active moment's words, or the active place's
  const sheet =
    layer === "journey"
      ? active === null
        ? null
        : { kicker: moments[active].label, title: <StruckTitle moment={moments[active]} />, line: moments[active].line }
      : activePlace === null
        ? null
        : { kicker: undefined, title: places[activePlace].name, line: places[activePlace].line };

  /** Fly to a picture point; on a phone the point rides high, clear of the sheet over the dock. */
  const goTo = (x: number, y: number) => {
    const phone = window.matchMedia("(max-width: 699.98px)").matches;

    controls.current?.focusOn(x, y, phone ? window.innerHeight * 0.16 : 0);
  };
  const pickMoment = (i: number) => {
    setActive(i);
    goTo(journey.moments[i].x, journey.moments[i].y);
  };
  const pickPlace = (i: number) => {
    setActivePlace(i);
    goTo(spots[i].x, spots[i].y);
  };
  // tabbing to a marker while exploring brings it into view
  const focusMoment = (i: number) => {
    if (state.mode === "explore") pickMoment(i);
  };
  const focusPlace = (i: number) => {
    if (state.mode === "explore") pickPlace(i);
  };

  useEffect(() => {
    step.current = (dir) => (layer === "journey" ? pickMoment(stepMoment(active, dir, moments.length)) : pickPlace(stepMoment(activePlace, dir, places.length)));
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
        onView: (v) => {
          writeView(el, v);
          const step = zoomStepOf(v.scale);

          if (step !== stepRef.current) {
            stepRef.current = step;
            setZoomStep(step);
          }
        },
        onPaint: () => {
          el.dataset.painted = String(Math.round(performance.now() - t0)); // milliseconds after the change ended
        },
      });
    } catch {
      queueMicrotask(() => setFailed(true)); // the canvas gave no context after all: the picture stays an image
      return;
    }
    el.style.setProperty("--map-size", `${MANIFEST.size}px`);
    const input = attachMapInput(el, map, MANIFEST, { onState: setState, onStep: (dir) => step.current(dir) });

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
    <main
      ref={page}
      className="map-page"
      data-mode={state.mode}
      data-engine={engine}
      data-layer={layer}
      data-route={settled && engine === "on" ? "draw" : "wait"}
      data-sheet={state.mode === "explore" && sheet !== null ? "" : undefined}
      aria-label="Map of Olympus Mons, Mars"
      // the overview's shape, from view.ts, so the CSS (the picture's seed, the width of the words' column) cannot drift from it
      style={{ "--map-fit-share": FIT_RING_SHARE, "--map-cliff-span": CLIFF_SPAN } as CSSProperties}
    >
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
      <div className="map-scrim" aria-hidden="true" />
      <div className="map-plane" aria-hidden="true">
        <RouteLayer journey={journey} size={MANIFEST.size} travelled={layer === "journey" && state.mode === "explore" && active !== null ? journey.moments[active].s : null} />
      </div>
      <div className="map-pins" role="group" aria-label={layer === "journey" ? "Moments on the map" : "Places on the map"} data-layer={layer}>
        <div className="map-pins-journey">
          {moments.map((moment, i) => (
            <MomentMarker
              key={moment.id}
              moment={moment}
              spot={journey.moments[i]}
              card={cards?.[i] ?? null}
              active={active === i}
              now={moment.date === "now"}
              onPick={() => pickMoment(i)}
              onKeyFocus={() => focusMoment(i)}
            />
          ))}
        </div>
        <div className="map-pins-places">
          <PlacesLayer places={places} points={spots} active={activePlace} onPick={pickPlace} onKeyFocus={focusPlace} />
        </div>
      </div>
      <HeadingBlock title={heading.title} text={heading.text} labels={ui} />
      <MapCaption title={caption.title} line={caption.line} fact={fact?.text} credit={caption.credit} />
      {engine === "on" ? (
        <>
          <ModeSwitch layer={layer} labels={ui} onChange={setLayer} />
          <MapControls state={state} onIn={() => controls.current?.zoomIn()} onOut={() => controls.current?.zoomOut()} onFit={() => controls.current?.fit()} />
          <MapSheet
            open={state.mode === "explore" && sheet !== null}
            kicker={sheet?.kicker}
            title={sheet?.title}
            line={sheet?.line ?? ""}
          />
        </>
      ) : (
        <div className="map-fallback-list" data-map-ui="">
          <MomentList moments={moments} label="My experience, in order" />
        </div>
      )}
      {engine !== "off" ? (
        <div className="sr-only">
          <MomentList moments={moments} label="My experience, in order" />
        </div>
      ) : null}
    </main>
  );
}
