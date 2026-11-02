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
import type { WallEngine } from "./wall-engine";
import { thumbUrl } from "./wall-math";

/** How long the shot flies out, and the wall's hold starts (mockup: VOV, 560 ms). */
const OPEN_MS = 560;
/** How long the fly back into the tile, and the fade, take before the wall thaws. */
const CLOSE_MS = 530;

export type VideoDetailHandle = {
  /** Flies the shot back into its tile; `instant` skips the flight. A no-op while already closing. */
  close(instant?: boolean): void;
  /** True from the pick until the close has finished, the fly-back included. */
  isOpen(): boolean;
};

type VideoDetailProps = {
  /** The video to show, from the moment it is picked until `onClose` has fired. */
  video: SiteVideo | null;
  /** The tile's rectangle when it was picked: where the shot flies from. */
  fromRect: DOMRect | null;
  /** The tile's key, to ask the wall where to fly back to. */
  tileKey: string | null;
  wall: WallEngine;
  /** Fired when the close has finished and the wall has thawed. */
  onClose: () => void;
};

/** The transform that puts the centred shot exactly over a rectangle. */
const flip = (shot: HTMLElement, r: DOMRect) => {
  const to = shot.getBoundingClientRect();
  return `translate3d(${r.left - to.left}px,${r.top - to.top}px,0) scale(${r.width / to.width})`;
};
/** Drops the transform with no transition, so the next flight starts from the centred shot. */
const settle = (shot: HTMLElement) => {
  shot.style.transition = "none";
  shot.style.transform = "";
  void shot.offsetWidth;
  shot.style.transition = "";
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The video detail view (mockup: VOV). The tile's image flies (FLIP) to a centred shot over a 95%
 * ink backdrop; above it the channel and the subscribers, below it the title and a Watch link.
 * Opening freezes the wall, then holds it still once the shot has landed; closing flies the shot
 * back into its tile and thaws the wall. With reduced motion the shot fades instead of flying.
 *
 * The open and close sequences are driven imperatively (classes and a transform), as in the
 * mockup, so nothing here re-renders per frame. While closed the dialog is `inert`.
 */
const VideoDetail = forwardRef<VideoDetailHandle, VideoDetailProps>(function VideoDetail(
  { video, fromRect, tileKey, wall, onClose },
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
    s.closing = true; // still "open" for Esc until the fly-back has finished
    window.clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    const { wall: w } = latest.current;
    w.hold(false);
    const r = !instant && s.key ? w.rectOf(s.key) : null;
    root.classList.remove("show");
    if (r && !reducedMotion()) shot.style.transform = flip(shot, r);
    s.timer = window.setTimeout(
      () => {
        root.classList.remove("on");
        hide(root, true);
        settle(shot);
        latest.current.wall.thaw();
        s.closing = false;
        s.key = null;
        latest.current.onClose();
      },
      instant ? 0 : CLOSE_MS,
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({ close, isOpen: () => st.current.on || st.current.closing }),
    [close],
  );

  // a video was picked: freeze the wall, fly the shot out from its tile, then hold the wall still
  useLayoutEffect(() => {
    const root = rootRef.current;
    const shot = shotRef.current;
    if (!video || !root || !shot) return;
    const s = st.current;
    window.clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    settle(shot);
    s.on = true;
    s.closing = false;
    s.key = tileKey;
    hide(root, false);
    root.classList.remove("show");
    root.classList.add("on");
    latest.current.wall.freeze(tileKey ?? undefined);
    if (fromRect && !reducedMotion()) {
      shot.style.transition = "none";
      shot.style.transform = flip(shot, fromRect);
      void shot.offsetWidth;
      shot.style.transition = "";
    }
    s.raf = requestAnimationFrame(() => {
      root.classList.add("show");
      shot.style.transform = "";
    });
    s.timer = window.setTimeout(() => latest.current.wall.hold(true), OPEN_MS);
    watchRef.current?.focus({ preventScroll: true });
    return () => {
      window.clearTimeout(s.timer);
      cancelAnimationFrame(s.raf);
    };
  }, [video, fromRect, tileKey]);

  // the layout under the shot changes on resize, so the flight would land wrong: just close
  useEffect(() => {
    const onResize = () => {
      if (st.current.on) close(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [close]);

  return (
    <div
      ref={rootRef}
      className="vov"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-hidden="true"
      {...({ inert: "" } as object)}
    >
      <div className="bg" role="presentation" onClick={() => close()} />
      <div className="vstage">
        <div className="vtop vfade">
          <span className="ch">{video?.channel}</span>
          <span className="subs">{video?.subscribers ? `${video.subscribers} subscribers` : ""}</span>
        </div>
        <div ref={shotRef} className="shot">
          {video ? <img src={thumbUrl(video, "sd")} alt="" /> : null}
        </div>
        <h3 id={titleId} className="vfade">
          {video?.title}
        </h3>
        <a
          ref={watchRef}
          className="watch vfade"
          href={video ? `https://www.youtube.com/watch?v=${video.id}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          Watch
        </a>
      </div>
      <button type="button" className="x" aria-label="Close" onClick={() => close()}>
        ×
      </button>
    </div>
  );
});

export default VideoDetail;
