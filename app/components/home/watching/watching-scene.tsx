import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { hasWebGL } from "../../../lib/webgl-support";
import type { SiteVideo } from "../../../types";
import { useLayerControl } from "../layer/layer-context";
import "./watching.css";
import VideoDetail, { type VideoDetailHandle } from "./video-detail";
import type { PickChannel, WallPick } from "./pick-channel";
import type { WallEngine } from "./wall-types";
import { echoSet } from "./wall-math";
import WatchingFallback, { gridWall } from "./watching-fallback";

type WatchingSceneProps = {
  /** Null on the server and until HomePage has created it on the client. */
  engine: WallEngine | null;
  videos: SiteVideo[];
  picks: PickChannel;
  /** True from the end of the layer's grow to the start of its shrink. */
  active: boolean;
  /** Called once the wall's first frame is on the screen: the layer swaps the block's picture for the scene. */
  onDrawn: () => void;
  /** The layer waited too long for the first frame: switch to the plain grid and stay on it. */
  gaveUp: boolean;
};

/**
 * The watching pane's DOM. The engine draws into the host and drives the chip
 * through the elements it is handed; this component only provides them, starts and stops the
 * engine, shows the detail view for a picked tile (the arrow keys move the pick to another tile
 * while it is open), and registers the hooks Esc uses to close an open video before the layer.
 * While a video is open the wall behind it stays drawn (spread and dimmed) but is `inert`, and the
 * layer's own header is hidden (through the layer context). Once the layer is active the engine
 * prepares urgently. The layer shows the block's own picture until `onDrawn` is called, which is
 * when the wall's first frame has been drawn (or the plain grid is up). A lost graphics context, or
 * the layer giving up on a first frame that is too late (`gaveUp`), switches to the plain grid for good.
 */
function WatchingScene({ engine, videos, picks, active, onDrawn, gaveUp }: WatchingSceneProps) {
  const { registerSceneHooks, setHeaderHidden } = useLayerControl();
  const sceneRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<VideoDetailHandle>(null);
  /** Set from the pick until the detail view has finished closing. */
  const [pick, setPick] = useState<WallPick | null>(null);
  const open = pick !== null;
  // No WebGL (or `?nogl=1`), or a wall that failed to start: a static grid of thumbnails opens the
  // same detail view. This scene only ever renders on the client, after the layer opens.
  const [fallback, setFallback] = useState(() => !hasWebGL() || !!engine?.hasFailed());
  const lastKey = useRef<string | null>(null);

  // read at fire time, so a new callback does not restart the wall
  const drawn = useRef(onDrawn);
  useEffect(() => {
    drawn.current = onDrawn;
  });
  // The first frame has been drawn: a late `gaveUp` is then ignored, and a first frame that comes
  // after the grid has taken over is ignored too (`live` in the start effect), so the view never
  // flips back from the grid to the 3D scene.
  const drew = useRef(false);
  useEffect(() => {
    if (gaveUp && !drew.current) setFallback(true);
  }, [gaveUp]);

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
    const unregister = registerSceneHooks({
      isVideoOpen: () => detailRef.current?.isOpen() ?? false,
      closeVideo: () => detailRef.current?.close(),
    });
    if (fallback || !engine || !host || !chip) return unregister;
    engine.mount({ host, chip });
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
    // the wall could not start (no context, a failed shader): show the grid instead
    void engine
      .start({
        onFirstFrame: () => {
          if (!live) return;
          drew.current = true;
          drawn.current();
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

  // no WebGL wall: the grid is the scene, and there is no frame to wait for
  useEffect(() => {
    if (fallback && active) drawn.current();
  }, [fallback, active]);

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
  const more = pick ? echoSet(videos, pick.index).size : 0;

  return (
    <div
      ref={sceneRef}
      className="wall-scene"
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
            <div ref={chipRef} className="chip" aria-live="polite">
              <b />
              <span />
            </div>
            <ul className="sr-only" aria-label="Videos on the wall">
              {videos.map((v) => (
                <li key={v.id}>
                  {/* reachable by a screen reader's links list, not 109 stops for the Tab key */}
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
