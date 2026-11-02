import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SiteVideo } from "../../../types";
import { useLayerControl } from "../layer/layer-context";
import VideoDetail, { type VideoDetailHandle } from "./video-detail";
import type { WallEngine } from "./wall-engine";

/** A tile the wall reports as picked: the video, where the tile is, and its key. */
export type WallPick = { index: number; rect: DOMRect; key: string };

/**
 * The wall engine is created in HomePage, before any scene exists, but a pick has to reach the
 * scene's state: HomePage hands `emit` to `createWall` as `onPick` and the scene subscribes.
 */
export function createPickChannel() {
  let handler: ((pick: WallPick) => void) | null = null;
  return {
    emit: (index: number, rect: DOMRect, key: string) => {
      handler?.({ index, rect, key });
    },
    subscribe: (fn: (pick: WallPick) => void) => {
      handler = fn;
      return () => {
        if (handler === fn) handler = null;
      };
    },
  };
}
export type PickChannel = ReturnType<typeof createPickChannel>;

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
 * engine, shows the detail view for a picked tile, and registers the hooks Esc uses to close an
 * open video before the layer. While a video is open everything behind it is `inert`.
 */
function WatchingScene({ engine, videos, picks, active }: WatchingSceneProps) {
  const { registerSceneHooks } = useLayerControl();
  const sceneRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const detailRef = useRef<VideoDetailHandle>(null);
  /** Set from the pick until the detail view has finished closing. */
  const [pick, setPick] = useState<WallPick | null>(null);
  const open = pick !== null;

  useEffect(() => {
    const host = hostRef.current;
    const chip = chipRef.current;
    const hint = hintRef.current;
    if (!engine || !host || !chip || !hint) return;
    engine.mount({ host, chip, hint });
    const unregister = registerSceneHooks({
      isVideoOpen: () => detailRef.current?.isOpen() ?? false,
      closeVideo: () => detailRef.current?.close(),
    });
    const unsubscribe = picks.subscribe((p) => setPick(p));
    return () => {
      unsubscribe();
      unregister();
      engine.unmount();
    };
  }, [engine, picks, registerSceneHooks]);

  useEffect(() => {
    if (!engine || !active) return;
    engine.start();
    return () => engine.stop();
  }, [engine, active]);

  // While a video is open the wall and the layer's own header are inert, so Tab stays on the
  // detail view; when it has closed they wake up and focus goes back to the wall stage.
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    const head = sceneRef.current
      ?.closest(".home-layer")
      ?.querySelector<HTMLElement>(".xp-head");
    const targets = [mainRef.current, head];
    for (const el of targets) {
      if (!el) continue;
      if (open) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    }
    if (!open && wasOpen.current) {
      hostRef.current?.querySelector("canvas")?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
    return () => {
      for (const el of targets) el?.removeAttribute("inert");
    };
  }, [open]);

  const video = pick ? (videos[pick.index] ?? null) : null;

  return (
    <div ref={sceneRef} className="wall-scene">
      <div ref={mainRef} className="wall-main">
        <div ref={hostRef} className="wall-host" />
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
      </div>
      {engine ? (
        <VideoDetail
          ref={detailRef}
          video={video}
          fromRect={pick?.rect ?? null}
          tileKey={pick?.key ?? null}
          wall={engine}
          onClose={() => setPick(null)}
        />
      ) : null}
    </div>
  );
}

export default memo(WatchingScene);
