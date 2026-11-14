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
  /** The wall's loop runs: its box is on screen (or the layer is open) and the tab is visible. */
  run: boolean;
  /** The layer is not closed (it is opening, open or closing): the plain grid, if the wall has fallen back to it, is shown. */
  open: boolean;
  /** Called when the wall's first frame is drawn into its box (every run's first frame; the box fades the scene in once). */
  onDrawn: () => void;
  /** The wall cannot draw (no WebGL, a failed start or a lost context): the box shows its flat preview instead. */
  onPlain: () => void;
  /** This opening gave up on 3D (a click that would not wait for a scene that was not ready, or a layer open too long on one): the plain grid shows until the layer is gone, then the box holds the live scene again. */
  gaveUp: boolean;
};

/**
 * The watching pane's DOM, which lives for as long as the page: in the home box (where the wall is drawn small and docked) and,
 * moved there as a whole by the layer, in the open layer (layer/move-driver.ts). The engine draws into the host and drives the
 * chip through the elements it is handed; this component only provides them, starts and stops the engine with `run`, shows
 * the detail view for a picked tile (the arrow keys move the pick to another tile while it is open), and registers the hooks Esc
 * uses to close an open video before the layer. While a video is open the wall behind it stays drawn (spread and dimmed) but
 * is `inert`, and the layer's own header is hidden (through the layer context). While its box is on screen the engine prepares
 * urgently. `onDrawn` is called when the wall's first frame is drawn. A lost graphics context, a failed start, or a click that
 * switches to the plain grid for good (`onPlain`; shown while the layer is open); a layer that gave up on a scene that was not ready (`gaveUp`) shows the grid for that one opening.
 */
function WatchingScene({
  engine,
  videos,
  picks,
  run,
  open: layerOpen,
  onDrawn,
  onPlain,
  gaveUp,
}: WatchingSceneProps) {
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
  // The plain grid shows when the wall cannot draw (`fallback`, for good) or this opening gave up on it (`gaveUp`, for one opening):
  // the wall is then stopped and taken out of the DOM, so a first frame that comes late is never drawn and the view does not
  // flip back from the grid to the 3D scene within the opening. The scene is made again when the layer is gone.
  const grid = fallback || gaveUp;

  // The box is on screen: do not yield to idle time while the wall is prepared.
  useEffect(() => {
    if (grid || !engine || !run) return;
    engine.setUrgent(true);
    return () => engine.setUrgent(false);
  }, [engine, run, grid]);

  // the wall cannot draw: the box shows its flat preview
  const plain = useRef(onPlain);
  useEffect(() => {
    plain.current = onPlain;
  });
  useEffect(() => {
    if (fallback) plain.current();
  }, [fallback]);

  useEffect(() => {
    const host = hostRef.current;
    const chip = chipRef.current;
    const unregister = registerSceneHooks("watching", {
      isVideoOpen: () => detailRef.current?.isOpen() ?? false,
      closeVideo: () => detailRef.current?.close(),
    });
    if (grid || !engine || !host || !chip) return unregister;
    engine.mount({ host, chip });
    const unsubscribe = picks.subscribe((p) => setPick(p));
    const unlost = engine.onLost(() => setFallback(true));
    return () => {
      unsubscribe();
      unlost();
      unregister();
      engine.unmount();
    };
  }, [engine, picks, registerSceneHooks, grid]);

  useEffect(() => {
    if (grid || !engine || !run) return;
    let live = true;
    // the wall could not start (no context, a failed shader): show the grid instead
    void engine
      .start({
        onFirstFrame: () => {
          if (live) drawn.current();
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
  }, [engine, run, grid]);

  // While a video is open the wall is inert and the layer's header is hidden (and inert), so Tab
  // stays on the detail view; when it has closed they wake up and focus goes back to the wall stage.
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (open) main?.setAttribute("inert", "");
    else main?.removeAttribute("inert");
    setHeaderHidden(open);
    if (!open && wasOpen.current) {
      const back = grid
        ? sceneRef.current?.querySelector<HTMLElement>(
            `[data-key="${CSS.escape(lastKey.current ?? "")}"]`,
          )
        : hostRef.current?.querySelector("canvas");
      back?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
    return () => {
      main?.removeAttribute("inert");
      setHeaderHidden(false);
    };
  }, [open, grid, setHeaderHidden]);

  // The scene stays alive in its box when the layer is closed: a video still open then is put away, and the wall's choice with it.
  const [prevLayerOpen, setPrevLayerOpen] = useState(layerOpen);
  if (prevLayerOpen !== layerOpen) {
    setPrevLayerOpen(layerOpen);
    if (!layerOpen) setPick(null);
  }
  useEffect(() => {
    if (layerOpen || !engine) return;
    engine.release();
    engine.thaw(true);
  }, [layerOpen, engine]);

  const video = pick ? videos[pick.index] ?? null : null;
  const more = pick ? echoSet(videos, pick.index).size : 0;

  return (
    <div ref={sceneRef} className="wall-scene" data-open={open ? "true" : undefined}>
      <div ref={mainRef} className="wall-main">
        {grid ? (
          layerOpen ? (
            <WatchingFallback
              videos={videos}
              onPick={(p) => {
                lastKey.current = p.key;
                setPick(p);
              }}
            />
          ) : null
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
      {grid || engine ? (
        <VideoDetail
          ref={detailRef}
          video={video}
          fromRect={pick?.rect ?? null}
          tileKey={pick?.key ?? null}
          wall={grid || !engine ? gridWall : engine}
          more={more}
          onClose={() => setPick(null)}
        />
      ) : null}
    </div>
  );
}

export default memo(WatchingScene);
