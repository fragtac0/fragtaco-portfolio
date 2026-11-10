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
};

/**
 * The reading pane's DOM. The engine draws into the host and drives the blur, dim and note
 * through the elements it is handed; this component only provides them, starts and stops the
 * engine, and registers the hooks Esc uses to close an open book before the layer.
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
    void engine.start().then(() => {
      if (live && engine.hasFailed()) setFallback(true);
    });
    return () => {
      live = false;
      engine.stop();
    };
  }, [engine, active, fallback]);

  if (fallback) return <ReadingFallback books={books} />;

  return (
    <div className="shelf-scene">
      <canvas ref={blurRef} className="shelf-blur" aria-hidden="true" />
      <div ref={dimRef} className="shelf-dim" />
      <div ref={hostRef} className="shelf-host" />
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
