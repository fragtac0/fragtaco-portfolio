import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { isChangeRunning } from "../../lib/page-change";
import { usePageArrived } from "../../lib/use-page-settled";
import type { SiteExperience } from "../../types";
import { useReducedMotion } from "../work/gallery/use-reduced-motion";
import type { Mode } from "./climb-change";
import ExperienceMap from "./experience-map";
import { MomentList } from "./experience-plain";
import { entranceVars } from "./entrance";
import { SUMMIT_XY, xOf, yOf } from "./frame";
import HeadingBlock from "./heading-block";
import MapCaption from "./map-caption";
import ModeSwitch from "./mode-switch";
import { aheadTrail, lowerTrail, sampleTrail, sharesFor, trailAt } from "./trail";
import { useEntrance } from "./use-entrance";
import { useWordsLayout, type WordsLayoutData } from "./use-words-layout";
import "./experience.css";
import "./entrance.css";

/** Is there a 2D canvas, and did the visitor ask for less data? Either one leaves the picture and the list. */
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

/**
 * My experience as a map of Olympus Mons (spec 9), in two states: Overview, the toned picture of the mountain, and My
 * climb, the tilted night map drawn from the heights, with one camera move between them (experience-map.tsx and
 * climb-engine.ts). The picture is in the page's HTML and placed by CSS, so a page change and the first paint show the
 * mountain; the engine starts once the page change is over. Where there is no 2D canvas, the visitor asked for less
 * data, or the picture or the heights did not come, the page keeps the picture (if it came) and shows the moments as a
 * list instead. The moments are in the document for a screen reader either way. The heading block and the caption show in the overview and fade
 * out in My climb: on a wide screen the heading is left of the mountain and the caption right of it, both on the summit's row (use-words-layout.ts,
 * spec 7); elsewhere top left and lower left. They come in as the page change completes, the trail tracing itself after them (use-entrance.ts, spec 8).
 */
export default function ExperiencePage({ experience }: { experience: SiteExperience }) {
  const { heading, caption, facts, moments, ui, route } = experience;
  const last = moments.length - 1;
  const fact = facts.find((f) => f.id === caption.factId);
  const trail = useMemo(() => sampleTrail(lowerTrail(route.map((p): [number, number] => [xOf(p.lon), yOf(p.lat)]), SUMMIT_XY)), [route]);
  const [mode, setMode] = useState<Mode>("overview");
  /** The chosen milestone in My climb; null in the overview. */
  const [selected, setSelected] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  // false on the server and while hydrating, so the first render is the same on both
  const available = useSyncExternalStore(never, mapAvailable, () => true);
  const [failed, setFailed] = useState<"picture" | "heights" | null>(null);
  const [pictureShown, setPictureShown] = useState(false);
  const onPicture = useCallback(() => setPictureShown(true), []);
  const failPicture = useCallback(() => {
    setFailed("picture");
    setPictureShown(true);
  }, []);
  const failHeights = useCallback(() => setFailed((f) => f ?? "heights"), []);
  const arrived = usePageArrived(1);
  // Read once, when the page is made: a page made while a change runs has its map drawn before the reveal (round 7 change-arrival spec 5.1: the picture,
  // the words and the frame are all there when the change uncovers it); only the heights, which draw nothing in the overview, wait for the change to be over.
  const [byChange] = useState(isChangeRunning);
  const reduced = useReducedMotion();
  const entrance = useEntrance(byChange, pictureShown, reduced);
  const entranceStyle = useMemo(() => (entrance.phase === "play" ? (entranceVars(entrance.ms, entrance.lag) as CSSProperties) : undefined), [entrance]);
  const pageRef = useRef<HTMLElement>(null);
  const remeasureRef = useRef<(() => void) | null>(null);
  const remeasure = useCallback(() => remeasureRef.current?.(), []);
  // where the cliff, the beads and the trail are, in map units: the words keep clear of them (words-layout.ts)
  const layoutData = useMemo<WordsLayoutData>(() => {
    const ahead = aheadTrail([trail[trail.length - 1].x, trail[trail.length - 1].y], SUMMIT_XY);
    const at = (p: { x: number; y: number }) => [p.x, p.y] as const;

    return {
      cliff: experience.cliff.points.map((p): [number, number] => [xOf(p.lon), yOf(p.lat)]),
      marks: { beads: sharesFor(moments.length).map((u) => at(trailAt(trail, u))), lines: [trail.map(at), ahead.map(at)] },
    };
  }, [experience.cliff.points, trail, moments.length]);
  // "pending" while the page change is still on and nothing is drawn yet (a first load), "on" once the engine runs: at once for a page that came in through a change
  const engine = !available || failed !== null ? "off" : arrived || byChange ? "on" : "pending";
  useWordsLayout(pageRef, layoutData, engine !== "off", engine, remeasure);
  const focusBeadRef = useRef<((index: number) => void) | null>(null);
  const onReady = useCallback(() => setReady(true), []);
  const choose = useCallback((index: number) => {
    setMode("climb");
    setSelected(index);
  }, []);
  const changeMode = useCallback(
    (next: Mode) => {
      setMode(next);
      setSelected(next === "climb" ? last : null);
    },
    [last],
  );

  // the arrow keys step through the milestones in My climb, the focus going with the selection (so a screen reader says the step), and Escape returns to the overview
  useEffect(() => {
    if (engine !== "on" || mode !== "climb") return;

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();

        const next = Math.max(0, Math.min(last, (selected ?? last) + (e.key === "ArrowRight" ? 1 : -1)));

        setSelected(next);
        focusBeadRef.current?.(next);
      } else if (e.key === "Escape") {
        changeMode("overview");
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [engine, mode, selected, last, changeMode]);

  return (
    <main
      ref={pageRef}
      className="map-page"
      data-arrival={byChange ? "change" : undefined}
      data-mode={engine === "on" ? mode : "overview"}
      data-engine={engine}
      data-entrance={entrance.phase}
      style={entranceStyle}
      aria-label="Map of Olympus Mons, Mars"
    >
      {/* the words come in on a clock (entrance.css): where there is no script they are simply there */}
      <noscript>
        <style>{".map-page :is(.map-letter, .map-rise) { opacity: 1 !important; }"}</style>
      </noscript>
      <ExperienceMap
        trail={trail}
        moments={moments}
        of={ui.of}
        mode={mode}
        selected={selected}
        ready={ready && engine === "on"}
        onReady={onReady}
        onChoose={choose}
        focusBeadRef={focusBeadRef}
        running={engine === "on"}
        heightsGo={arrived}
        byChange={byChange}
        reduced={reduced}
        picture={failed !== "picture"}
        onPicture={onPicture}
        onFailPicture={failPicture}
        onFailHeights={failHeights}
        entrance={entrance}
        remeasureRef={remeasureRef}
      />
      <HeadingBlock title={heading.title} text={heading.description} />
      <MapCaption title={caption.title} line={caption.line} fact={fact?.text} credit={caption.credit} />
      {engine === "on" ? (
        <ModeSwitch mode={mode} labels={ui} onChange={changeMode} disabled={!ready} />
      ) : engine === "off" ? (
        // only when the map cannot run; while the page change is still on show nothing (the sr-only list below serves)
        <div className="map-fallback-list" data-map-ui="">
          <MomentList moments={moments} label="My experience, in order" />
        </div>
      ) : null}
      {engine !== "off" ? (
        <div className="sr-only">
          <MomentList moments={moments} label="My experience, in order" />
        </div>
      ) : null}
    </main>
  );
}
