import { memo, useEffect, useRef, useState } from "react";
import { hasWebGL2 } from "../../../lib/webgl-support";
import type { SiteBook } from "../../../types";
import { useLayerControl } from "../layer/layer-context";
import "./reading.css";
import ReadingFallback from "./reading-fallback";
import ShelfPlaceholder from "./shelf-placeholder";
import type { ShelfEngine } from "./shelf-engine";

/** How long the placeholder takes to fade out (reading.css `.shelf-placeholder`). */
const PLACEHOLDER_FADE_MS = 300;

/** What stands in for the 3D shelf: nothing, the flat placeholder, or the placeholder fading out. */
type Placeholder = "none" | "shown" | "leaving";

type ReadingSceneProps = {
  /** Null on the server and until HomePage has created it on the client. */
  engine: ShelfEngine | null;
  books: SiteBook[];
  /** True from the end of the layer's grow to the start of its shrink. */
  active: boolean;
};

/**
 * The reading pane's DOM. The engine draws into the host and drives the blur, dim and note
 * through the elements it is handed; this component only provides them, starts and stops the
 * engine, and registers the hooks Esc uses to close an open book before the layer. Once the layer
 * is active (open and waiting) the engine prepares urgently. If the shelf is not ready when the layer becomes active, a
 * flat placeholder shows until its first frame is drawn (and the drop-in is skipped: the books were
 * already "there"); a shelf that was ready drops its books in as usual.
 */
function ReadingScene({ engine, books, active }: ReadingSceneProps) {
  const { registerSceneHooks } = useLayerControl();
  const hostRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLCanvasElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  // three.js 0.169 needs WebGL2 (`?nogl=1` also lands here): without it, or when the shelf fails to
  // start, a simple grid of covers stands in. This scene only renders on the client.
  const [fallback, setFallback] = useState(() => !hasWebGL2());
  const [placeholder, setPlaceholder] = useState<Placeholder>("none");
  // The placeholder is decided in the render where the layer becomes active, so it is in the first
  // frame the layer shows (an effect would run after that frame was painted).
  const [wasActive, setWasActive] = useState(false);
  if (active !== wasActive) {
    setWasActive(active);
    setPlaceholder(active && engine && !fallback && !engine.ready() ? "shown" : "none");
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
    const blur = blurRef.current;
    const dim = dimRef.current;
    const info = infoRef.current;
    const hint = hintRef.current;
    if (!engine || !host || !blur || !dim || !info || !hint) return;
    engine.mount({ host, blur, dim, info, hint, status: statusRef.current ?? undefined });
    const unregister = registerSceneHooks({
      isBookOpen: () => engine.hasOpen(),
      closeBook: () => engine.closeBook(),
    });
    return () => {
      unregister();
      engine.unmount();
    };
  }, [engine, registerSceneHooks, fallback]);

  useEffect(() => {
    if (fallback || !engine || !active) return;
    let live = true;
    const waited = placeholderRef.current === "shown";
    void engine
      .start({
        skipIntro: waited,
        onFirstFrame: () => {
          if (!live || !waited) return;
          setPlaceholder("leaving");
        },
      })
      .then(() => {
        if (live && engine.hasFailed()) setFallback(true);
      });
    return () => {
      live = false;
      engine.stop();
    };
  }, [engine, active, fallback]);

  if (fallback) return <ReadingFallback books={books} />;

  return (
    <div className="shelf-scene" data-shelf={placeholder === "none" ? "live" : placeholder}>
      <canvas ref={blurRef} className="shelf-blur" aria-hidden="true" />
      <div ref={dimRef} className="shelf-dim" />
      <div ref={hostRef} className="shelf-host" />
      {placeholder !== "none" && (
        <ShelfPlaceholder books={books} leaving={placeholder === "leaving"} />
      )}
      <div ref={infoRef} className="book-info">
        <h3>{""}</h3>
        <p className="by" />
        <p className="note placeholder" />
        <button type="button" className="book-back">
          Put it back
        </button>
      </div>
      <p ref={hintRef} className="xp-hint" />
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
