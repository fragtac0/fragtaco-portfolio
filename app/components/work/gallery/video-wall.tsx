import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { placeholderArt } from "../../../content/placeholder-art";
import { coverUrl } from "../../../content/work-media";
import { usePageArrived } from "../../../lib/use-page-settled";
import type { WorkVideo } from "../../../types";
import { fitGrid } from "./gallery-math";
import { shapeCover } from "../cover-image";
import { arrowTarget, fallbackBox } from "./wall-layout";
import { safeOf, useWallBox } from "./use-wall-box";
import { useReducedMotion } from "./use-reduced-motion";
import { useWallEngine } from "./use-wall-engine";
import WallCaption from "./wall-caption";
import "./gallery.css";

interface VideoWallProps {
  kind: "long" | "short";
  items: WorkVideo[];
}

// Layout effects warn on the server; the server never measures, so there it is a plain effect.
const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/** If the engine has not drawn this long after the wall could start (the page has arrived and the wall is measured), the links are shown as the wall until it does (three.js still downloading on a slow connection), so the wall is never blank for long. */
const SHOW_LINKS_AFTER_MS = 1500;

const ARROWS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

/**
 * One wall of videos (spec 6.5, round 7 spec 7): every video of its kind, once, in the largest grid that fits, drawn by
 * the gallery engine on one canvas. The links are always in the page, laid out from the same `fitGrid` so they sit
 * where the pictures are. They are out of sight (still the accessible list: they take focus, Enter opens them, arrow
 * keys move the engine's ring) while the engine starts and arrives, so the wall's arrival is the first thing seen, and
 * they are the visible wall for good when there is no WebGL or the context is lost (a picture that does not load shows
 * the tile's local art). On a slow first load, where the links are already showing before the engine is ready, they stay
 * showing until it has drawn (`data-shown`, `data-drawn`; gallery.css) so the wall never goes blank in between.
 * A click or tap on the canvas opens the tile's link in a new tab through that link, so `rel="noreferrer"`
 * and the browser's own new-tab handling apply. Hovering a tile shows its title and year at the lower left.
 */
export default function VideoWall({ kind, items }: VideoWallProps) {
  const tall = kind === "short";
  const aspect = tall ? 9 / 16 : 16 / 9;
  const stage = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const links = useRef<Array<HTMLAnchorElement | null>>([]);
  const armed = useRef<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [ring, setRing] = useState<number | null>(null);
  // `early`: the wall is on screen as links before the engine has drawn. Two ways in: the server's grid of links is shown by
  // gallery.css after 2.5 s, and if that has happened by the time the page runs (a slow first load) they are already showing
  // (read once at mount, before the first measure, so before `data-fit` hides anything); or the engine is still not drawing
  // `SHOW_LINKS_AFTER_MS` after the wall could start (below). The links then stay until the engine has drawn, fade out under it,
  // and the engine draws whole tiles with no arrival, so the wall is never blank for long and never shows, blanks, shows.
  const [early, setEarly] = useState(false);
  useIsoLayoutEffect(() => {
    const list = listRef.current;
    if (list && Number.parseFloat(getComputedStyle(list).opacity) > 0.5) setEarly(true);
  }, []);

  const box = useWallBox(stage);
  const arrived = usePageArrived(2);
  const reduced = useReducedMotion();
  const srcs = useMemo(() => items.map((video) => coverUrl(video, tall)), [items, tall]);
  const arts = useMemo(() => items.map((video) => placeholderArt(video.id, tall)), [items, tall]);
  const { live, drawn, failed, api } = useWallEngine({
    host: canvasHost,
    arrived,
    measured: box !== null,
    srcs,
    arts,
    aspect,
    reduced,
    instant: early,
    safe: () => safeOf(null, stage.current),
    onHover: setHover,
    onActivate: (i) => {
      armed.current = i; // opened by the click event that follows, which a new tab is allowed from
    },
  });

  // the engine is slow to draw (the arrival is the first thing seen when it is not): show the links meanwhile
  const fitted = box !== null;
  useEffect(() => {
    if (!arrived || !fitted || drawn || failed || early) return;
    const t = window.setTimeout(() => setEarly(true), SHOW_LINKS_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [arrived, fitted, drawn, failed, early]);

  const grid = useMemo(
    () => (box ? fitGrid(items.length, box.vw, box.vh, aspect, safeOf(box, null)) : null),
    [box, items.length, aspect],
  );

  // the dock or the heading changed size: the engine fits again
  useEffect(() => {
    api.current?.resize();
  }, [box, api, live]);
  // the ring follows keyboard focus
  useEffect(() => {
    api.current?.focus(ring);
  }, [ring, live, api]);

  // the click that follows a tap on a tile the engine reported opens its link (a real click is what a browser lets open a new tab from)
  useEffect(() => {
    const el = canvasHost.current;
    if (!el) return;
    const disarm = () => {
      armed.current = null;
    };
    const open = () => {
      const i = armed.current;
      armed.current = null;
      if (i !== null) links.current[i]?.click();
    };
    el.addEventListener("pointerdown", disarm, true);
    el.addEventListener("click", open);
    return () => {
      el.removeEventListener("pointerdown", disarm, true);
      el.removeEventListener("click", open);
    };
  }, []);

  // an arrow key with nothing focused picks up the wall at its first tile
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!ARROWS.has(event.key) || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const at = document.activeElement;
      if (at && at !== document.body) return;
      event.preventDefault();
      links.current[0]?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, from: number) => {
    if (!ARROWS.has(event.key) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !grid) return;
    event.preventDefault();
    links.current[arrowTarget(event.key, from, grid.cols, items.length)]?.focus({ preventScroll: true });
  };
  // a ring for the keyboard only: a link focused by a click does not get one
  const onFocus = (event: FocusEvent<HTMLAnchorElement>, i: number) => {
    setRing(event.currentTarget.matches(":focus-visible") ? i : null);
  };
  const onBlur = (event: FocusEvent<HTMLAnchorElement>) => {
    if (!listRef.current?.contains(event.relatedTarget)) setRing(null);
  };

  const shown = hover ?? ring;

  return (
    <div
      ref={stage}
      className="wall-stage"
      data-fit={grid ? "" : undefined}
      data-live={live ? "" : undefined}
      data-drawn={drawn ? "" : undefined}
      data-shown={early ? "" : undefined}
      data-plain={failed ? "" : undefined}
      data-grid={grid ? JSON.stringify({ ...grid, vw: box?.vw, vh: box?.vh }) : undefined}
    >
      <div ref={canvasHost} className="wall-canvas-host" />
      <ul
        className="wall-links"
        aria-label={tall ? "Short form videos" : "Long form videos"}
        ref={listRef}
      >
        {items.map((video, i) => {
          const b = grid ? fallbackBox(grid, i) : null;
          return (
            <li
              key={video.id}
              style={b ? { left: b.x, top: b.y, width: b.w, height: b.h } : undefined}
            >
              <a
                ref={(el) => {
                  links.current[i] = el;
                }}
                className="wall-tile"
                style={srcs[i] === arts[i] ? undefined : { backgroundImage: `url("${arts[i]}")` }}
                href={video.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${video.title}, for ${video.for}, ${video.year}`}
                onKeyDown={(event) => onKeyDown(event, i)}
                onFocus={(event) => onFocus(event, i)}
                onBlur={onBlur}
                onPointerEnter={() => {
                  if (!live) setHover(i); // while the links are the visible wall the caption follows them too
                }}
                onPointerLeave={() => {
                  if (!live) setHover(null);
                }}
              >
                <img
                  ref={(img) => shapeCover(img, video.id, tall)}
                  src={srcs[i]}
                  crossOrigin="anonymous"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onLoad={(e) => shapeCover(e.currentTarget, video.id, tall)}
                  onError={(e) => shapeCover(e.currentTarget, video.id, tall)}
                />
              </a>
            </li>
          );
        })}
      </ul>
      <WallCaption video={shown === null ? null : (items[shown] ?? null)} />
    </div>
  );
}
