import { memo, useEffect, useRef, useState } from "react";
import { hasWebGL2 } from "../../../lib/webgl-support";
import type { SiteBook } from "../../../types";
import { useLayerControl } from "../layer/layer-context";
import "./reading.css";
import ReadingFallback from "./reading-fallback";
import type { ShelfEngine } from "./shelf-engine";
import { useDotField } from "./use-dot-field";

type ReadingSceneProps = {
  /** Null on the server and until HomePage has created it on the client. */
  engine: ShelfEngine | null;
  books: SiteBook[];
  /** The shelf's loop runs: its box is on screen (or the layer is open) and the tab is visible. */
  run: boolean;
  /** The layer is not closed (it is opening, open or closing): the plain grid, if the shelf has fallen back to it, is shown. */
  open: boolean;
  /** The layer is open and still (not moving): the dot field moves. In the box and during the move it is held still. */
  settled: boolean;
  /** Called when the shelf's first frame is drawn into its box (every run's first frame; the box fades the scene in once). */
  onDrawn: () => void;
  /** The shelf cannot draw (no WebGL2, a failed start or a lost context): the box shows its flat preview instead. */
  onPlain: () => void;
  /** The layer waited too long for a click on a box whose scene was not ready: switch to the plain grid and stay on it. */
  gaveUp: boolean;
};

/**
 * The reading pane's DOM, which lives for as long as the page: in the home box (where the shelf is drawn small and docked)
 * and, moved there as a whole by the layer, in the open layer (layer/move-driver.ts). The engine draws into the host and drives
 * the note through the elements it is handed; this component only provides them, starts and stops the engine with `run`, and
 * registers the hooks Esc uses to close an open book before the layer. While its box is on screen the engine prepares urgently.
 * `onDrawn` is called when the shelf's first frame is drawn (the books stand in place at once); with no 3D shelf (no WebGL2, a
 * failed start, a lost context, or `gaveUp`) `onPlain` is called and the plain grid is shown, but only while the layer is open.
 */
function ReadingScene({
  engine,
  books,
  run,
  open,
  settled,
  onDrawn,
  onPlain,
  gaveUp,
}: ReadingSceneProps) {
  const { registerSceneHooks } = useLayerControl();
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLCanvasElement>(null);
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
  // The first frame has been drawn: a late `gaveUp` is then ignored, and a first frame that comes
  // after the grid has taken over is ignored too (`live` in the start effect), so the view never
  // flips back from the grid to the 3D scene.
  const drew = useRef(false);
  useEffect(() => {
    if (gaveUp && !drew.current) setFallback(true);
  }, [gaveUp]);

  // The box is on screen: do not yield to idle time while the shelf is prepared.
  useEffect(() => {
    if (fallback || !engine || !run) return;
    engine.setUrgent(true);
    return () => engine.setUrgent(false);
  }, [engine, run, fallback]);

  // the shelf cannot draw: the box shows its flat preview
  const plain = useRef(onPlain);
  useEffect(() => {
    plain.current = onPlain;
  });
  useEffect(() => {
    if (fallback) plain.current();
  }, [fallback]);

  useEffect(() => {
    if (fallback) return;
    const host = hostRef.current;
    const info = infoRef.current;
    if (!engine || !host || !info) return;
    engine.mount({
      host,
      stage: stageRef.current ?? undefined,
      dots: dotsRef.current ?? undefined,
      info,
      marker: markerRef.current ?? undefined,
      status: statusRef.current ?? undefined,
    });
    const unregister = registerSceneHooks("reading", {
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
    if (fallback || !engine || !run) return;
    let live = true;
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
  }, [engine, run, fallback]);

  // the dot field behind the row moves only while the layer is open and still (and the tab visible): in the box and during the
  // move it is held where its first picture drew it, so nothing in the picture changes between the box and the move; a still frame is drawn at once
  useDotField(dotsRef, settled && !fallback);

  if (fallback) return open ? <ReadingFallback books={books} /> : null;

  return (
    <div ref={stageRef} className="shelf-scene">
      <canvas ref={dotsRef} className="dot-field" aria-hidden="true" />
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
