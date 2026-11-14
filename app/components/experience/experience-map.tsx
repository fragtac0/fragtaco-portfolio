import { useCallback, useEffect, useRef, type CSSProperties, type MutableRefObject } from "react";
import type { ExperienceMoment } from "../../types";
import { createCardController, type CardController } from "./card-controller";
import type { Mode } from "./climb-change";
import { createClimbEngine, type ClimbEngine, type ClimbLayers } from "./climb-engine";
import { PICTURE } from "./frame";
import { FRAME_FONT } from "./frame-layer";
import { DOCK_SELECTOR, WORDS_SELECTOR, readKeepOut } from "./keep-out";
import MilestonePins from "./milestone-pins";
import MomentCard, { cardView } from "./moment-card";
import { whenIdle } from "../../utils/idle";
import { loadTerrain } from "./terrain-canvas";
import type { TrailPoint } from "./trail";
import { OVERVIEW, PHONE_LOOK_MEDIA, PHONE_OVERVIEW } from "./view";
import "./map.css";

/**
 * The relief picture (a smaller one for a phone: a narrow screen, or a short one that is not wide, a phone held sideways) and the heights. The route preloads the
 * picture (the one for the screen, by the same media query); the heights are not preloaded: they are fetched at idle once the page change
 * is over, since only My climb draws from them.
 */
export const RELIEF_SRC = "/mars/relief.webp";
export const RELIEF_PHONE_SRC = "/mars/relief-phone.webp";
export const PHONE_MEDIA = "(max-width: 700px), (max-height: 520px) and (max-width: 960px)";
/**
 * The rest: exactly the other side of `PHONE_MEDIA` (a short desktop window, wider than any phone held sideways, still gets the large picture). Written
 * with strict comparisons so no width between 700 and 701 px (a zoomed page has fractional widths) falls in neither; a browser too old to read them
 * loses only the preload (the picture's own `<source>` still chooses).
 */
export const ROOMY_MEDIA = "(width > 700px) and (height > 520px), (width > 960px)";
export const HEIGHTS_SRC = "/mars/heights.png";
/** The longest the heights wait for an idle moment after the engine starts, in milliseconds. */
export const HEIGHTS_IDLE_MS = 800;

/** `fetchpriority` as an attribute: React 18.3 does not know the camel case prop (the painting does the same). */
const HIGH = { fetchpriority: "high" } as Record<string, string>;

type Props = {
  trail: TrailPoint[];
  moments: ExperienceMoment[];
  /** The word between "3" and "9" on a card. */
  of: string;
  mode: Mode;
  /** The chosen milestone in My climb (null in the overview). */
  selected: number | null;
  /** Whether the engine runs: from the end of the page change, where a 2D canvas is there and the picture came. */
  running: boolean;
  reduced: boolean;
  /** Whether the picture is shown (false once it failed to load). */
  picture: boolean;
  /** The heights are read: the switch and the beads can be pressed. */
  ready: boolean;
  onReady: () => void;
  /** A bead was pressed. */
  onChoose: (index: number) => void;
  /** Filled with a function that moves the keyboard focus to a bead (the arrow keys move the focus with the selection). */
  focusBeadRef: MutableRefObject<((index: number) => void) | null>;
  /** The picture failed, or the heights or a 2D canvas did: the page falls back to the list. */
  onFailPicture: () => void;
  onFailHeights: () => void;
};

/** An audit hook: when the page has an array in `window.__expTrace`, every frame of a move writes a row to it. */
const trace = () => (window as unknown as { __expTrace?: number[][] }).__expTrace;

/**
 * The two states of the map (spec 9.1 and 9.2), as layers of one stage: the toned picture (one `<img>` in a plane that
 * the engine moves with a 3D transform), the night under it, the night map's canvas, three depth blurs (two far, one
 * near), the soft blur toward the edges, the trail and the radar (above every blur: Ruling R101), the fade into the night
 * toward the far edge and the sides, the darkening, and above it the frame of the chart (its corner marks, readout, degrees
 * and scale: frame-layer.ts, crisp in the corners). The chart's grid is drawn on the trail's canvas under the trail. After the stage come the milestones' beads and their card. Before
 * the engine starts the plane is placed by CSS alone, exactly where the engine will put it in the overview, so a page change
 * and the first paint show the picture. The layers' strength follows `--night`, which the engine writes (no React state per
 * frame). Nothing but the beads is read by a screen reader: the moments are listed by the page.
 */
export default function ExperienceMap({ trail, moments, of, mode, selected, running, reduced, picture: showPicture, ready, onReady, onChoose, focusBeadRef, onFailPicture, onFailHeights }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLDivElement>(null);
  const terrain = useRef<HTMLCanvasElement>(null);
  const trailCanvas = useRef<HTMLCanvasElement>(null);
  const radar = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLCanvasElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const pinBox = useRef<HTMLDivElement | null>(null);
  const pins = useRef<(HTMLButtonElement | null)[]>([]);
  const engine = useRef<ClimbEngine | null>(null);
  const live = useRef({ mode, selected, reduced, onFailHeights, onReady });
  /** The state the engine was last told to go to, so the effect below speaks only when it has changed (and the engine just made already got it). */
  const told = useRef<{ mode: Mode; selected: number | null } | null>(null);
  const setBox = useCallback((el: HTMLDivElement | null) => void (pinBox.current = el), []);
  const setPin = useCallback((i: number, el: HTMLButtonElement | null) => void (pins.current[i] = el), []);

  useEffect(() => {
    live.current = { mode, selected, reduced, onFailHeights, onReady };
  });

  useEffect(() => {
    focusBeadRef.current = (index) => pins.current[index]?.focus();

    return () => {
      focusBeadRef.current = null;
    };
  }, [focusBeadRef]);

  // a picture that failed before the page woke up never fires onError here
  useEffect(() => {
    const img = picture.current;

    if (img?.complete && img.naturalWidth === 0) onFailPicture();
  }, [onFailPicture]);

  useEffect(() => {
    const els = pins.current.slice(0, moments.length);
    const box = pinBox.current;
    const layers = { stage: stage.current, plane: plane.current, night: night.current, terrain: terrain.current, trail: trailCanvas.current, radar: radar.current, frame: frame.current, pinBox: box, pins: els };
    const cardEl = card.current;

    if (!running || !cardEl || !box || els.length !== moments.length || els.some((el) => el === null) || Object.values(layers).some((l) => l === null)) return;

    const el = stage.current as HTMLDivElement;
    // how much of the stage's foot the dock covers: a card keeps above it
    let dock = 0;
    const controller: CardController = createCardController(
      cardView(cardEl, () => pins.current),
      { set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => window.clearTimeout(id) },
      () => live.current.reduced,
    );
    const e = createClimbEngine(layers as unknown as ClimbLayers, {
      trail,
      reduced: () => live.current.reduced,
      phone: () => window.matchMedia(PHONE_LOOK_MEDIA).matches,
      host: { now: () => performance.now(), raf: (cb) => requestAnimationFrame(cb), cancel: (n) => cancelAnimationFrame(n) },
      onSelect: (index, wait) => controller.request(index, wait),
      onHeads: (heads, size) => controller.update(heads, { w: size.w, h: size.h - dock }),
      onFail: () => live.current.onFailHeights(),
      trace,
    });
    let gone = false;
    const page = el.closest(".map-page") ?? el.parentElement ?? el;
    const measure = () => {
      const r = el.getBoundingClientRect();

      dock = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--site-nav-height")) || 0;
      // the chart's labels keep out of the page's words and the dock (they thin out on a phone rather than collide); told before the size, so the first drawing has both
      e.setKeepOut(readKeepOut(page, document, r));
      e.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
    };
    const onVisible = () => e.setVisible(!document.hidden);
    const observer = new ResizeObserver(measure);

    engine.current = e;
    measure();
    observer.observe(el);
    // the words and the dock change size when their fonts arrive and when the dock's second row opens
    page.querySelectorAll(WORDS_SELECTOR).forEach((w) => observer.observe(w));
    const glass = document.querySelector(DOCK_SELECTOR);

    if (glass) observer.observe(glass);
    window.addEventListener("resize", measure);
    document.addEventListener("visibilitychange", onVisible);
    told.current = { mode: live.current.mode, selected: live.current.selected };
    e.go(live.current.mode, live.current.selected ?? undefined);
    // the chart's lettering is drawn in IBM Plex Mono: drawn again when it arrives
    document.fonts?.load(FRAME_FONT).then(() => {
      if (!gone) e.redraw();
    }, () => {});
    // the heights are read at idle once the engine is up (the picture is already there; only My climb draws from them)
    const cancelIdle = whenIdle(() => {
      loadTerrain(HEIGHTS_SRC).then(
        (t) => {
          if (gone) return;
          e.setTerrain(t);
          el.dataset.terrain = "ready";
          live.current.onReady();
        },
        () => {
          if (!gone) live.current.onFailHeights();
        },
      );
    }, HEIGHTS_IDLE_MS);

    return () => {
      gone = true;
      cancelIdle();
      engine.current = null;
      e.destroy();
      controller.destroy();
      controller.request(null, 0);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onVisible);
      delete el.dataset.terrain;
    };
  }, [running, trail, moments.length]);

  useEffect(() => {
    const was = told.current;

    if (!engine.current || (was !== null && was.mode === mode && was.selected === selected)) return;
    told.current = { mode, selected };
    engine.current.go(mode, selected ?? undefined);
  }, [mode, selected]);

  return (
    <>
      <div
        ref={stage}
        className="map-stage"
        aria-hidden="true"
        // the overview's place for the picture, from view.ts, so the CSS cannot drift from it: the look-at point as a share of the picture, and the zoom (the picture's own and the phone's; map.css picks one)
        style={
          {
            "--map-desk-x": `${(OVERVIEW.ax / PICTURE.w) * 100}%`,
            "--map-desk-y": `${(OVERVIEW.ay / PICTURE.h) * 100}%`,
            "--map-desk-zoom": OVERVIEW.s,
            "--map-phone-x": `${(PHONE_OVERVIEW.ax / PICTURE.w) * 100}%`,
            "--map-phone-y": `${(PHONE_OVERVIEW.ay / PICTURE.h) * 100}%`,
            "--map-phone-zoom": PHONE_OVERVIEW.s,
            "--map-ratio": PICTURE.w / PICTURE.h,
          } as CSSProperties
        }
      >
        <div ref={plane} className="map-plane">
          {showPicture ? (
            <picture>
              <source media={PHONE_MEDIA} srcSet={RELIEF_PHONE_SRC} type="image/webp" />
              <img ref={picture} src={RELIEF_SRC} alt="" width={PICTURE.w} height={PICTURE.h} draggable={false} decoding="async" {...HIGH} onError={onFailPicture} />
            </picture>
          ) : null}
        </div>
        <div ref={night} className="map-night" />
        <canvas ref={terrain} className="map-terrain" />
        <div className="map-focus map-focus-far" />
        <div className="map-focus map-focus-far-2" />
        <div className="map-focus map-focus-near" />
        <div className="map-edge-blur" />
        <canvas ref={trailCanvas} className="map-trail" />
        <canvas ref={radar} className="map-radar" />
        <div className="map-fog" />
        <div className="map-vignette" />
        <canvas ref={frame} className="map-frame" />
      </div>
      {running ? (
        // only while the engine runs: in the fallback there are no beads (the list serves) and nothing dead in the accessibility tree
        <>
          <MilestonePins moments={moments} selected={selected} ready={ready} onChoose={onChoose} boxRef={setBox} pinRef={setPin} />
          <MomentCard ref={card} moments={moments} of={of} />
        </>
      ) : null}
    </>
  );
}
