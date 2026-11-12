import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { hasWebGL } from "../../../lib/webgl-support";
import type { SiteVideo } from "../../../types";
import { useLayerControl } from "../layer/layer-context";
import "./watching.css";
import VideoDetail, { type VideoDetailHandle } from "./video-detail";
import type { PickChannel, WallPick } from "./pick-channel";
import type { WallEngine } from "./wall-types";
import WallPlaceholder from "./wall-placeholder";
import WatchingFallback, { gridWall } from "./watching-fallback";

/** How long the placeholder takes to fade out (watching.css `.wall-placeholder`). */
const PLACEHOLDER_FADE_MS = 300;

/** What stands in for the wall: nothing, the flat placeholder, or the placeholder fading out. */
type Placeholder = "none" | "shown" | "leaving";

type WatchingSceneProps = {
  /** Null on the server and until HomePage has created it on the client. */
  engine: WallEngine | null;
  videos: SiteVideo[];
  picks: PickChannel;
  /** True from the end of the layer's grow to the start of its shrink. */
  active: boolean;
};

/**
 * The watching pane's DOM. The engine draws into the host and drives the chip and the hint
 * through the elements it is handed; this component only provides them, starts and stops the
 * engine, shows the detail view for a picked tile (the arrow keys move the pick to another tile
 * while it is open), and registers the hooks Esc uses to close an open video before the layer.
 * While a video is open the wall behind it stays drawn (spread and dimmed) but is `inert`, and the
 * layer's own header is hidden (through the layer context). Once the layer is active the engine
 * prepares urgently; if the wall is not ready by then, a flat placeholder shows until its first
 * frame (`data-wall` on the scene says which: `shown`, `leaving` or `live`). A lost graphics
 * context switches to the plain grid.
 */
function WatchingScene({ engine, videos, picks, active }: WatchingSceneProps) {
  const { registerSceneHooks, setHeaderHidden } = useLayerControl();
  const sceneRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const detailRef = useRef<VideoDetailHandle>(null);
  /** Set from the pick until the detail view has finished closing. */
  const [pick, setPick] = useState<WallPick | null>(null);
  const open = pick !== null;
  // No WebGL (or `?nogl=1`), or a wall that failed to start: a static grid of thumbnails opens the
  // same detail view. This scene only ever renders on the client, after the layer opens.
  const [fallback, setFallback] = useState(() => !hasWebGL() || !!engine?.hasFailed());
  const lastKey = useRef<string | null>(null);

  const [placeholder, setPlaceholder] = useState<Placeholder>("none");
  // Decided in the render where the layer becomes active, so the placeholder is in the first frame
  // the layer shows. Only on becoming active: closing keeps what stood in for the wall while the
  // stage fades out.
  const [wasActive, setWasActive] = useState(false);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setPlaceholder(engine && !fallback && !engine.ready() ? "shown" : "none");
  }
  const placeholderRef = useRef(placeholder);
  useEffect(() => {
    placeholderRef.current = placeholder;
  });
  useEffect(() => {
    if (placeholder !== "leaving") return;
    const timer = window.setTimeout(() => setPlaceholder("none"), PLACEHOLDER_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [placeholder]);

  // The layer is open and waiting: do not yield to idle time while the wall is prepared. Not while
  // it grows: the clip-path grow runs on the main thread and back-to-back slices would cut into it.
  useEffect(() => {
    if (fallback || !engine || !active) return;
    engine.setUrgent(true);
    return () => engine.setUrgent(false);
  }, [engine, active, fallback]);

  useEffect(() => {
    const host = hostRef.current;
    const chip = chipRef.current;
    const hint = hintRef.current;
    const unregister = registerSceneHooks({
      isVideoOpen: () => detailRef.current?.isOpen() ?? false,
      closeVideo: () => detailRef.current?.close(),
    });
    if (fallback || !engine || !host || !chip || !hint) return unregister;
    engine.mount({ host, chip, hint });
    const unsubscribe = picks.subscribe((p) => setPick(p));
    const unlost = engine.onLost(() => setFallback(true));
    return () => {
      unsubscribe();
      unlost();
      unregister();
      engine.unmount();
    };
  }, [engine, picks, registerSceneHooks, fallback]);

  useEffect(() => {
    if (fallback || !engine || !active) return;
    let live = true;
    const waited = placeholderRef.current === "shown";
    // the wall could not start (no context, a failed shader): show the grid instead
    void engine
      .start({
        onFirstFrame: () => {
          if (live && waited) setPlaceholder("leaving");
        },
      })
      .then(() => {
        if (live && engine.hasFailed()) setFallback(true);
      })
      // a step of the scene's set-up threw: the plain grid takes over, never an unhandled rejection
      .catch(() => {
        if (live) setFallback(true);
      });
    return () => {
      live = false;
      engine.stop();
    };
  }, [engine, active, fallback]);

  // While a video is open the wall is inert and the layer's header is hidden (and inert), so Tab
  // stays on the detail view; when it has closed they wake up and focus goes back to the wall stage.
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (open) main?.setAttribute("inert", "");
    else main?.removeAttribute("inert");
    setHeaderHidden(open);
    if (!open && wasOpen.current) {
      const back = fallback
        ? sceneRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(lastKey.current ?? "")}"]`)
        : hostRef.current?.querySelector("canvas");
      back?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
    return () => {
      main?.removeAttribute("inert");
      setHeaderHidden(false);
    };
  }, [open, fallback, setHeaderHidden]);

  const video = pick ? (videos[pick.index] ?? null) : null;
  const more = video ? videos.filter((v) => v.channel === video.channel).length - 1 : 0;

  return (
    <div
      ref={sceneRef}
      className="wall-scene"
      data-wall={fallback || placeholder === "none" ? "live" : placeholder}
      data-open={open ? "true" : undefined}
    >
      <div ref={mainRef} className="wall-main">
        {fallback ? (
          <WatchingFallback
            videos={videos}
            onPick={(p) => {
              lastKey.current = p.key;
              setPick(p);
            }}
          />
        ) : (
          <>
            <div ref={hostRef} className="wall-host" />
            {placeholder !== "none" && (
              <WallPlaceholder count={videos.length} leaving={placeholder === "leaving"} />
            )}
            <div className="wall-vig" />
            <div ref={chipRef} className="chip" aria-live="polite">
              <b />
              <span />
            </div>
            <p ref={hintRef} className="xp-hint" />
            <ul className="sr-only" aria-label="Videos on the wall">
              {videos.map((v) => (
                <li key={v.id}>
                  {/* reachable by a screen reader's links list, not 51 stops for the Tab key */}
                  <a
                    href={`https://www.youtube.com/watch?v=${v.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={-1}
                  >
                    {v.title}, {v.channel}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {fallback || engine ? (
        <VideoDetail
          ref={detailRef}
          video={video}
          fromRect={pick?.rect ?? null}
          tileKey={pick?.key ?? null}
          wall={fallback || !engine ? gridWall : engine}
          more={more}
          onClose={() => setPick(null)}
        />
      ) : null}
    </div>
  );
}

export default memo(WatchingScene);
