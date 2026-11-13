import { memo, useEffect, useRef, useState } from "react";
import { hasWebGL2 } from "../../../lib/webgl-support";
import type { SiteBook } from "../../../types";
import { useLayerControl } from "../layer/layer-context";
import "./reading.css";
import ReadingFallback from "./reading-fallback";
import type { ShelfEngine } from "./shelf-engine";

type ReadingSceneProps = {
  /** Null on the server and until HomePage has created it on the client. */
  engine: ShelfEngine | null;
  books: SiteBook[];
  /** True from the end of the layer's grow to the start of its shrink. */
  active: boolean;
  /** Called once the shelf's first frame is on the screen: the layer swaps the block's picture for the scene. */
  onDrawn: () => void;
};

/**
 * The reading pane's DOM. The engine draws into the host and drives the note
 * through the elements it is handed; this component only provides them, starts and stops the
 * engine, and registers the hooks Esc uses to close an open book before the layer. Once the layer
 * is active (open and waiting) the engine prepares urgently. The layer shows the block's own
 * picture until `onDrawn` is called, which is when the shelf's first frame has been drawn (the
 * books stand in place at once, as the picture showed them; with no 3D shelf, as soon as the plain
 * grid is up).
 */
function ReadingScene({ engine, books, active, onDrawn }: ReadingSceneProps) {
  const { registerSceneHooks } = useLayerControl();
  const hostRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  // three.js 0.169 needs WebGL2 (`?nogl=1` also lands here): without it, or when the shelf fails to
  // start, a simple grid of covers stands in. This scene only renders on the client.
  const [fallback, setFallback] = useState(() => !hasWebGL2() || !!engine?.hasFailed());
  // read at fire time, so a new callback does not restart the shelf
  const drawn = useRef(onDrawn);
  useEffect(() => {
    drawn.current = onDrawn;
  });

  // The layer is open and waiting: do not yield to idle time while the shelf is prepared. Not while
  // it grows: the clip-path grow runs on the main thread and back-to-back slices would cut into it.
  useEffect(() => {
    if (fallback || !engine || !active) return;
    engine.setUrgent(true);
    return () => engine.setUrgent(false);
  }, [engine, active, fallback]);

  useEffect(() => {
    if (fallback) return;
    const host = hostRef.current;
    const info = infoRef.current;
    if (!engine || !host || !info) return;
    engine.mount({
      host,
      info,
      marker: markerRef.current ?? undefined,
      status: statusRef.current ?? undefined,
    });
    const unregister = registerSceneHooks({
      isBookOpen: () => engine.hasOpen(),
      closeBook: () => engine.closeBook(),
    });
    // the graphics context was taken away: the plain grid of covers takes over
    const unlost = engine.onLost(() => setFallback(true));
    return () => {
      unlost();
      unregister();
      engine.unmount();
    };
  }, [engine, registerSceneHooks, fallback]);

  useEffect(() => {
    if (fallback || !engine || !active) return;
    let live = true;
    void engine
      .start({
        // the picture the layer showed already had the books standing: no drop-in over it
        skipIntro: true,
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
  }, [engine, active, fallback]);

  // no 3D shelf: the grid is the scene, and there is no frame to wait for
  useEffect(() => {
    if (fallback && active) drawn.current();
  }, [fallback, active]);

  if (fallback) return <ReadingFallback books={books} />;

  return (
    <div className="shelf-scene">
      <div ref={hostRef} className="shelf-host" />
      <div ref={infoRef} className="book-info">
        <h3>{""}</h3>
        <p className="by" />
        <p className="note placeholder" />
        <button type="button" className="book-back">
          Put it back
        </button>
      </div>
      <div ref={markerRef} className="shelf-marker" hidden aria-hidden="true">
        <span className="shelf-marker-thumb" />
      </div>
      <p ref={statusRef} className="sr-only" role="status" aria-live="polite" />
      <ul className="sr-only" aria-label="Books on the shelf">
        {books.map((b) => (
          <li key={b.id}>
            {b.title}, {b.author}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default memo(ReadingScene);
