import { useEffect, useRef, type CSSProperties } from "react";
import type { Mode } from "./climb-change";
import { createClimbEngine, type ClimbEngine, type ClimbLayers } from "./climb-engine";
import { PICTURE } from "./frame";
import { loadTerrain } from "./terrain-canvas";
import type { TrailPoint } from "./trail";
import { OVERVIEW } from "./view";
import "./map.css";

/** The relief picture and the heights, as the route preloads them. */
export const RELIEF_SRC = "/mars/relief.webp";
export const HEIGHTS_SRC = "/mars/heights.png";

type Props = {
  trail: TrailPoint[];
  mode: Mode;
  /** Whether the engine runs: from the end of the page change, where a 2D canvas is there and the picture came. */
  running: boolean;
  reduced: boolean;
  /** Whether the picture is shown (false once it failed to load). */
  picture: boolean;
  /** The picture or the heights failed: the page falls back to the list. */
  onFailPicture: () => void;
  onFailHeights: () => void;
};

/** An audit hook: when the page has an array in `window.__expTrace`, every frame of a move writes a row to it. */
const trace = () => (window as unknown as { __expTrace?: number[][] }).__expTrace;

/**
 * The two states of the map (spec 9.1 and 9.2), as layers of one stage: the toned picture (one `<img>` in a plane that
 * the engine moves with a 3D transform), the night under it, the night map's canvas, and over them the fade into the
 * night toward the far edge and the sides, three depth blurs (two far, one near), the soft blur toward the edges and
 * the darkening. Before the engine starts the plane is placed by CSS alone, exactly where the engine will put it in the
 * overview, so a page change and the first paint show the picture. The overlays' strength follows `--night`, which the
 * engine writes (no React state per frame). Nothing here is read by a screen reader: the moments are listed by the page.
 */
export default function ExperienceMap({ trail, mode, running, reduced, picture: showPicture, onFailPicture, onFailHeights }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLDivElement>(null);
  const terrain = useRef<HTMLCanvasElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const engine = useRef<ClimbEngine | null>(null);
  const live = useRef({ mode, reduced, onFailHeights });

  useEffect(() => {
    live.current = { mode, reduced, onFailHeights };
  });

  // a picture that failed before the page woke up never fires onError here
  useEffect(() => {
    const img = picture.current;

    if (img?.complete && img.naturalWidth === 0) onFailPicture();
  }, [onFailPicture]);

  useEffect(() => {
    const layers = { stage: stage.current, plane: plane.current, night: night.current, terrain: terrain.current };

    if (!running || !layers.stage || !layers.plane || !layers.night || !layers.terrain) return;

    const el = layers.stage;
    const e = createClimbEngine(layers as unknown as ClimbLayers, {
      trail,
      reduced: () => live.current.reduced,
      host: { now: () => performance.now(), raf: (cb) => requestAnimationFrame(cb), cancel: (n) => cancelAnimationFrame(n) },
      trace,
    });
    let gone = false;
    const measure = () => {
      const r = el.getBoundingClientRect();

      e.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
    };
    const onVisible = () => e.setVisible(!document.hidden);
    const observer = new ResizeObserver(measure);

    engine.current = e;
    measure();
    observer.observe(el);
    window.addEventListener("resize", measure);
    document.addEventListener("visibilitychange", onVisible);
    e.go(live.current.mode);
    loadTerrain(HEIGHTS_SRC).then(
      (t) => {
        if (gone) return;
        e.setTerrain(t);
        el.dataset.terrain = "ready";
      },
      () => {
        if (!gone) live.current.onFailHeights();
      },
    );

    return () => {
      gone = true;
      engine.current = null;
      e.destroy();
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onVisible);
      delete el.dataset.terrain;
    };
  }, [running, trail]);

  useEffect(() => {
    engine.current?.go(mode);
  }, [mode]);

  return (
    <div
      ref={stage}
      className="map-stage"
      aria-hidden="true"
      // the overview's place for the picture, from view.ts, so the CSS cannot drift from it: the look-at point as a share of the picture, and the zoom
      style={
        {
          "--map-look-x": `${(OVERVIEW.ax / PICTURE.w) * 100}%`,
          "--map-look-y": `${(OVERVIEW.ay / PICTURE.h) * 100}%`,
          "--map-zoom": OVERVIEW.s,
          "--map-ratio": PICTURE.w / PICTURE.h,
        } as CSSProperties
      }
    >
      <div ref={plane} className="map-plane">
        {showPicture ? (
          <img ref={picture} src={RELIEF_SRC} alt="" width={PICTURE.w} height={PICTURE.h} draggable={false} decoding="async" fetchPriority="high" onError={onFailPicture} />
        ) : null}
      </div>
      <div ref={night} className="map-night" />
      <canvas ref={terrain} className="map-terrain" />
      <div className="map-focus map-focus-far" />
      <div className="map-focus map-focus-far-2" />
      <div className="map-focus map-focus-near" />
      <div className="map-fog" />
      <div className="map-edge-blur" />
      <div className="map-vignette" />
    </div>
  );
}
