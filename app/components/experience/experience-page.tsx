import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePageArrived } from "../../lib/use-page-settled";
import type { SiteExperience } from "../../types";
import { useReducedMotion } from "../work/gallery/use-reduced-motion";
import type { Mode } from "./climb-change";
import ExperienceMap from "./experience-map";
import { MomentList } from "./experience-plain";
import { SUMMIT_XY, xOf, yOf } from "./frame";
import HeadingBlock from "./heading-block";
import MapCaption from "./map-caption";
import ModeSwitch from "./mode-switch";
import { lowerTrail, sampleTrail } from "./trail";
import "./experience.css";

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
 * list instead. The moments are in the document for a screen reader either way. The heading block (top left) and the
 * caption (lower left) show in the overview and fade out in My climb.
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
  const failPicture = useCallback(() => setFailed("picture"), []);
  const failHeights = useCallback(() => setFailed((f) => f ?? "heights"), []);
  const arrived = usePageArrived(1);
  const reduced = useReducedMotion();
  // "pending" while the page change is still on (the page shows the picture and no list), "on" once the engine may run
  const engine = !available || failed !== null ? "off" : arrived ? "on" : "pending";
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

  // the arrow keys step through the milestones in My climb and Escape returns to the overview
  useEffect(() => {
    if (engine !== "on" || mode !== "climb") return;

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelected((s) => Math.max(0, Math.min(last, (s ?? last) + (e.key === "ArrowRight" ? 1 : -1))));
      } else if (e.key === "Escape") {
        changeMode("overview");
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [engine, mode, last, changeMode]);

  return (
    <main className="map-page" data-mode={engine === "on" ? mode : "overview"} data-engine={engine} aria-label="Map of Olympus Mons, Mars">
      <ExperienceMap
        trail={trail}
        moments={moments}
        of={ui.of}
        mode={mode}
        selected={selected}
        ready={ready && engine === "on"}
        onReady={onReady}
        onChoose={choose}
        running={engine === "on"}
        reduced={reduced}
        picture={failed !== "picture"}
        onFailPicture={failPicture}
        onFailHeights={failHeights}
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
