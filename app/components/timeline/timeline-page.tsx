import { useEffect, useMemo, useRef } from "react";
import type { SiteNavigationItem, SiteSocialLink, SiteTimeline } from "../../types";
import SiteNav from "../site-nav";
import WorkBackground from "../work/work-background";
import { createTimeline, type HoverHit, type Timeline } from "./timeline-canvas";
import { KEY_ZOOM } from "./timeline-input";
import TimelineLegend from "./timeline-legend";
import { describeDay, formatLongDate, summariseRoles } from "./timeline-model";
import { totalDays } from "./timeline-math";
import "../work/work.css";
import "./timeline.css";

interface TimelinePageProps {
  timeline: SiteTimeline;
  today: string;
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
}

const CANVAS_LABEL =
  "Timeline: one square for each day since 1 December 2020, coloured by role. Arrow keys pan, plus and minus zoom, 0 fits the whole timeline, and Shift with the arrow keys moves between days.";

// One query for the page's life (`matches` stays current); the canvas is told when it changes.
let reducedQuery: MediaQueryList | null = null;
const reducedMotionQuery = () => (reducedQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)"));
const reducedMotion = () => reducedMotionQuery().matches;

/**
 * The timeline page: every day since the start is a square on one canvas (`createTimeline`), coloured
 * by the role held that day, zoomed out to fit at first. The page is a fixed stage like /work. The
 * tooltip and the spoken day are written straight into the DOM from the canvas's hover callback, so
 * nothing in React changes per frame; the canvas mirrors its view in `data-scale`, `data-x` and `data-y`.
 */
export default function TimelinePage({ timeline, today, navigationItems, socialLinks }: TimelinePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const engineRef = useRef<Timeline | null>(null);
  const roles = useMemo(() => summariseRoles(timeline, today), [timeline, today]);
  const total = totalDays(timeline.start, today);
  // The loader hands back a new object each time it runs; the picture is only rebuilt (and the view only
  // reset) when the content itself changes.
  const timelineKey = JSON.stringify(timeline);
  const content = useMemo(() => JSON.parse(timelineKey) as SiteTimeline, [timelineKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    const live = liveRef.current;
    if (!canvas || !tip || !live) return;

    const showTip = (hit: HoverHit | null, engine: Timeline | null) => {
      if (!hit || !engine) {
        tip.hidden = true;
        delete tip.dataset.index;
        return;
      }
      const day = describeDay(engine.model(), hit.index);
      const [date, role, mark] = tip.children as unknown as HTMLElement[];
      date.textContent = day.date;
      role.textContent = day.role;
      mark.textContent = day.mark ?? "";
      mark.hidden = day.mark === null;
      tip.dataset.index = String(hit.index);
      tip.dataset.date = day.iso;
      tip.dataset.role = day.role;
      tip.hidden = false;
      // above the square, or below it near the top of the screen, and kept inside the screen
      const box = tip.getBoundingClientRect();
      const left = Math.min(Math.max(8, hit.x + hit.w / 2 - box.width / 2), window.innerWidth - box.width - 8);
      const above = hit.y - box.height - 8;
      const top = above >= 8 ? above : Math.min(hit.y + hit.h + 8, window.innerHeight - box.height - 8);
      tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      if (hit.source === "keyboard") live.textContent = `${day.date}, ${day.role}${day.mark ? `, ${day.mark}` : ""}`;
    };

    const engine = createTimeline(canvas, content, today, {
      reducedMotion,
      onHover: (hit) => showTip(hit, engineRef.current),
    });
    engineRef.current = engine;
    const query = reducedMotionQuery();
    const onMotionChange = () => engine.refresh();
    query.addEventListener("change", onMotionChange);

    return () => {
      query.removeEventListener("change", onMotionChange);
      engine.dispose();
      engineRef.current = null;
    };
  }, [content, today]);

  return (
    <main className="timeline-page">
      <WorkBackground />
      {/* `application` is right here: the canvas is a custom widget that takes its own arrow, plus, minus and 0 keys. */}
      <canvas
        ref={canvasRef}
        className="timeline-canvas"
        tabIndex={0}
        // eslint-disable-next-line jsx-a11y/no-interactive-element-to-noninteractive-role
        role="application"
        aria-label={CANVAS_LABEL}
        aria-describedby="timeline-table"
      />
      <TimelineLegend start={timeline.start} total={total} roles={roles} />
      <div className="timeline-zoom" role="group" aria-label="Zoom">
        <button type="button" className="tl-btn" aria-label="Zoom in" onClick={() => engineRef.current?.zoomBy(KEY_ZOOM)}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          </svg>
        </button>
        <button type="button" className="tl-btn" aria-label="Zoom out" onClick={() => engineRef.current?.zoomBy(1 / KEY_ZOOM)}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          </svg>
        </button>
        <button type="button" className="tl-btn tl-btn-fit" aria-label="Fit the whole timeline" onClick={() => engineRef.current?.fit()}>
          fit
        </button>
      </div>
      <div className="timeline-tip" ref={tipRef} data-timeline-tooltip="" aria-hidden="true" hidden>
        <span className="tl-tip-date" />
        <span className="tl-tip-role" />
        <span className="tl-tip-mark" hidden />
      </div>
      <p className="sr-only" role="status" aria-live="polite" ref={liveRef} />
      <table className="sr-only" id="timeline-table">
        <caption>
          The roles held from {formatLongDate(timeline.start)} to {formatLongDate(today)}, with the days each covers
        </caption>
        <thead>
          <tr>
            <th scope="col">Role</th>
            <th scope="col">From</th>
            <th scope="col">To</th>
            <th scope="col">Days</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id}>
              <th scope="row">{role.label}</th>
              <td>{role.from ? formatLongDate(role.from) : "not yet"}</td>
              <td>{role.to ? formatLongDate(role.to) : "not yet"}</td>
              <td>{role.days}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SiteNav items={navigationItems} socialLinks={socialLinks} />
    </main>
  );
}
