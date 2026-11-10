import { useCallback, useEffect, useRef, useState } from "react";
import type { SiteBook, SiteVideo } from "../../types";
import { hasWebGL, hasWebGL2 } from "../../lib/webgl-support";
import type { LayerKind } from "./layer/layer-state";
import { createShelf, type ShelfEngine } from "./reading/shelf-engine";
import { createPickChannel } from "./watching/pick-channel";
import { createWall, type WallEngine } from "./watching/wall-engine";

/**
 * The shelf engine lives as long as the page. Creating it only makes a canvas (no GL, no
 * three.js), so it is made on the client when the state is first set; the server has none.
 * The scene is built in idle time when the reading block comes near, and freed when the page
 * goes away. The free is deferred one tick so StrictMode's simulated unmount (cleanup, then the
 * same effect again) does not kill the engine.
 *
 * The wall engine follows the same lifecycle: made here on the client, prepared (GL context,
 * atlas, thumbnails) when the watching block comes near, freed when the page goes away. A tile
 * the wall reports as picked reaches the watching scene through the channel.
 */
export function useSceneEngines(books: SiteBook[], videos: SiteVideo[]) {
  const disposeTimer = useRef<number | null>(null);
  const [shelf] = useState<ShelfEngine | null>(() =>
    typeof window === "undefined"
      ? null
      : createShelf(books, {
          fine: window.matchMedia("(hover: hover) and (pointer: fine)").matches,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        }),
  );
  useEffect(() => {
    if (!shelf) return;
    const pending = disposeTimer;
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = null;
    return () => {
      pending.current = window.setTimeout(() => shelf.dispose(), 0);
    };
  }, [shelf]);

  const wallDisposeTimer = useRef<number | null>(null);
  const [wallPicks] = useState(createPickChannel);
  const [wall] = useState<WallEngine | null>(() =>
    typeof window === "undefined"
      ? null
      : createWall(videos, {
          fine: window.matchMedia("(hover: hover) and (pointer: fine)").matches,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          onPick: (index, rect, key) => wallPicks.emit(index, rect, key),
        }),
  );
  useEffect(() => {
    if (!wall) return;
    const pending = wallDisposeTimer;
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = null;
    return () => {
      pending.current = window.setTimeout(() => wall.dispose(), 0);
    };
  }, [wall]);

  // What a block's words and previews warm up: the scenes hook their prepare() here.
  const onBlockNear = useCallback(
    (kind: LayerKind) => {
      // without the context the scene needs, its fallback grid is shown and nothing is prepared
      if (kind === "reading") {
        if (hasWebGL2()) void shelf?.prepare();
      } else if (hasWebGL()) {
        wall?.prepare();
      }
    },
    [shelf, wall],
  );

  return { shelf, wall, wallPicks, onBlockNear };
}
