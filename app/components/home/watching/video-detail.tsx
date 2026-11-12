import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import type { SiteVideo } from "../../../types";
import type { WallControl } from "./wall-types";
import { whenDecoded } from "./shot-decode";
import { choiceLayout } from "./wall-choice";
import { thumbUrl } from "./wall-math";
import { CLOSE_MS, FADE_MS, OPEN_MS } from "./wall-spread";
import { formatPublished } from "./video-date";

/** How long the grid's picture takes to fly back (no WebGL wall: the picture flies, as before). */
const FLY_BACK_MS = 530;
/**
 * A tap on a touch screen sends its click to whatever is on top when the finger lifts, which is
 * this layer, a moment after the pick opened it: a click this soon after opening is that one.
 */
const TAP_ECHO_MS = 400;
/** The flight waits this long, at most, for the shot's picture to decode (a blank shot is worse than a late one). */
const DECODE_MS = 150;

export type VideoDetailHandle = {
  /** Starts the close (the wall's tiles travel back); `instant` skips it. A no-op while already closing. */
  close(instant?: boolean): void;
  /** True from the pick until the close has finished. */
  isOpen(): boolean;
};

type VideoDetailProps = {
  /** The video to show, from the moment it is picked until `onClose` has fired. */
  video: SiteVideo | null;
  /** The tile's rectangle when it was picked: where the grid's picture flies from. */
  fromRect: DOMRect | null;
  /** The tile's key, to ask the grid where to fly back to. */
  tileKey: string | null;
  wall: WallControl;
  /** How many other videos from the chosen video's channel there are (the count the chip shows, `echoSet`). */
  more: number;
  /** Fired when the close has finished and the wall has thawed. */
  onClose: () => void;
};

/** The transform that puts the picture at its place exactly over a rectangle. */
const flip = (shot: HTMLElement, r: DOMRect) => {
  const to = shot.getBoundingClientRect();
  return `translate3d(${r.left - to.left}px,${r.top - to.top}px,0) scale(${r.width / to.width})`;
};
/** Drops the transform with no transition, so the next flight starts from the picture's place. */
const settle = (shot: HTMLElement) => {
  shot.style.transition = "none";
  shot.style.transform = "";
  void shot.offsetWidth;
  shot.style.transition = "";
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Puts the picture's box and the text block's where the wall's layout says (`--sx` .. `--zw`). */
function place(root: HTMLElement) {
  const { rect, zone } = choiceLayout(root.clientWidth, root.clientHeight);
  const set = (k: string, v: number) => root.style.setProperty(k, `${v}px`);
  set("--sx", rect.x);
  set("--sy", rect.y);
  set("--sw", rect.w);
  set("--zx", zone.x);
  set("--zy", zone.y);
  set("--zw", zone.w);
  set("--zh", zone.h);
}

/**
 * The video detail view (spec 7, "Click"). With the WebGL wall the wall does the showing: the
 * chosen tile travels to the middle and the others spread away (wall-pose.ts), and this layer
 * adds what DOM does better: the title, channel, subscribers, date and a "Watch on YouTube" link
 * under the video, a sharp picture that fades in over the tile once it has landed, the close
 * button, and a transparent cover that closes on a click outside. Without WebGL (the grid) it
 * also shows the picture itself, flying (FLIP) from the grid button over a dark backdrop.
 *
 * The same boxes (`choiceLayout`) place the picture and the text here and the tiles in the wall.
 * Opening chooses the tile; closing releases it (the tiles travel back, 320 ms) and thaws the wall
 * when that is over. With reduced motion nothing travels: the wall and this layer fade. The arrow
 * keys change the chosen video from the wall (the pick arrives again with a new video). Everything
 * is driven imperatively (classes and a transform), so nothing re-renders per frame. While closed
 * the dialog is `inert`.
 */
const VideoDetail = forwardRef<VideoDetailHandle, VideoDetailProps>(function VideoDetail(
  { video, fromRect, tileKey, wall, more, onClose },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shotRef = useRef<HTMLDivElement>(null);
  const watchRef = useRef<HTMLAnchorElement>(null);
  const titleId = useId();
  const st = useRef({
    on: false,
    closing: false,
    key: null as string | null,
    timer: 0,
    raf: 0,
    openedAt: 0,
  });
  const latest = useRef({ wall, onClose });
  useLayoutEffect(() => {
    latest.current = { wall, onClose };
  });

  const hide = (root: HTMLElement, hidden: boolean) => {
    if (hidden) {
      root.setAttribute("inert", "");
      root.setAttribute("aria-hidden", "true");
    } else {
      root.removeAttribute("inert");
      root.removeAttribute("aria-hidden");
    }
  };

  const close = useCallback((instant = false) => {
    const s = st.current;
    const root = rootRef.current;
    const shot = shotRef.current;
    if (!s.on || !root || !shot) return;
    s.on = false;
    s.closing = true; // still "open" for Esc until the close has finished
    window.clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    const { wall: w } = latest.current;
    const reduced = reducedMotion();
    w.release();
    root.classList.remove("show");
    shot.classList.remove("landed");
    // the grid's picture flies back into its button
    const r = !instant && !w.spreads && s.key ? w.rectOf(s.key) : null;
    if (r && !reduced) shot.style.transform = flip(shot, r);
    const ms = instant ? 0 : reduced ? FADE_MS : w.spreads ? CLOSE_MS : FLY_BACK_MS;
    s.timer = window.setTimeout(() => {
      root.classList.remove("on");
      hide(root, true);
      settle(shot);
      latest.current.wall.thaw();
      s.closing = false;
      s.key = null;
      latest.current.onClose();
    }, ms);
  }, []);

  useImperativeHandle(
    ref,
    () => ({ close, isOpen: () => st.current.on || st.current.closing }),
    [close],
  );

  // a video was picked (or the arrow keys moved the choice): choose it on the wall, and show its text
  useLayoutEffect(() => {
    const root = rootRef.current;
    const shot = shotRef.current;
    if (!video || !root || !shot) return;
    const s = st.current;
    const swap = s.on; // already open: only the video changes
    window.clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    const { wall: w } = latest.current;
    const reduced = reducedMotion();
    s.on = true;
    s.closing = false;
    s.key = tileKey;
    hide(root, false);
    shot.classList.remove("landed");
    root.classList.add("on");
    place(root); // measured once it is displayed
    w.freeze(tileKey ?? undefined);
    const landed = () => {
      s.timer = window.setTimeout(() => shot.classList.add("landed"), reduced ? FADE_MS : OPEN_MS);
    };
    if (swap) {
      root.classList.add("show");
      landed();
      return () => window.clearTimeout(s.timer);
    }
    s.openedAt = performance.now();
    settle(shot);
    root.classList.remove("show");
    if (!w.spreads && fromRect && !reduced) {
      shot.style.transition = "none";
      shot.style.transform = flip(shot, fromRect);
      void shot.offsetWidth;
      shot.style.transition = "";
    }
    let live = true;
    const fly = () => {
      if (!live || !s.on) return;
      s.raf = requestAnimationFrame(() => {
        root.classList.add("show");
        shot.style.transform = "";
      });
      landed();
    };
    const img = shot.querySelector("img");
    if (img && !w.spreads) void whenDecoded(img, DECODE_MS).then(fly);
    else fly();
    watchRef.current?.focus({ preventScroll: true });
    return () => {
      live = false;
      window.clearTimeout(s.timer);
      cancelAnimationFrame(s.raf);
    };
  }, [video, fromRect, tileKey]);

  // the layout under the picture changes on resize, so the wall's tiles and this layer would
  // disagree: just close
  useEffect(() => {
    const onResize = () => {
      if (st.current.on) close(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [close]);

  const subs = video?.subscribers ? `${video.subscribers} subscribers` : "";
  const date = formatPublished(video?.published);

  return (
    <div
      ref={rootRef}
      className={wall.spreads ? "vov gl" : "vov"}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-hidden="true"
      {...({ inert: "" } as object)}
    >
      <div
        className="bg"
        role="presentation"
        onClick={(e) => {
          if (performance.now() - st.current.openedAt <= TAP_ECHO_MS) return;
          // the picture lets pointers through to here (the wall's tile is under it): a click on
          // the chosen video itself does nothing, the Watch link is the action
          const r = shotRef.current?.getBoundingClientRect();
          if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            return;
          }
          close();
        }}
      />
      <div ref={shotRef} className="shot">
        {video ? (
          <img
            src={thumbUrl(video, "sd")}
            alt=""
            onError={(e) => {
              // the larger thumbnail is missing: the one every video has takes its place
              const hq = thumbUrl(video, "hq");
              if (e.currentTarget.getAttribute("src") !== hq) e.currentTarget.src = hq;
            }}
          />
        ) : null}
      </div>
      <div className="vtext vfade">
        <h3 id={titleId}>{video?.title}</h3>
        <p className="vmeta">
          <span className="ch">{video?.channel}</span>
          {subs ? <> <span>{subs}</span></> : null}
          {date ? <> <span>{date}</span></> : null}
          {more > 0 ? <> <span>{more} more from this channel</span></> : null}
        </p>
        <a
          ref={watchRef}
          className="watch"
          href={video ? `https://www.youtube.com/watch?v=${video.id}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          Watch on YouTube
        </a>
      </div>
      <button type="button" className="x" aria-label="Close" onClick={() => close()}>
        ×
      </button>
    </div>
  );
});

export default VideoDetail;
