import { useEffect, useRef, type CSSProperties } from "react";
import type { SiteBook, SiteVideo } from "../../../types";
import type { LayerKind } from "../layer/layer-state";
import "./blocks.css";
import { miniSpine, miniThumbUrl, miniWallColumns } from "./mini-previews";

/** A block comes "near" this far outside the viewport (mockup: rootMargin 240px 0px). */
const NEAR_MARGIN = "240px 0px";

/** The ids the layer and the deep link find the blocks by (mockup: blkRead, blkWatch). */
export const BLOCK_ID: Record<LayerKind, string> = {
  reading: "blkRead",
  watching: "blkWatch",
};

const whenIdle = (cb: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === "function") {
    const h = window.requestIdleCallback(cb, { timeout: 1200 });
    return () => window.cancelIdleCallback(h);
  }
  const t = window.setTimeout(cb, 120);
  return () => window.clearTimeout(t);
};

type InterestBlocksProps = {
  books: SiteBook[];
  videos: SiteVideo[];
  /** `el` is the block the layer grows out of. */
  onOpen: (kind: LayerKind, el: HTMLElement) => void;
  /** Fires once per kind, in idle time, when its block comes within 240 px of the viewport. */
  onNear: (kind: LayerKind) => void;
};

export default function InterestBlocks({ books, videos, onOpen, onNear }: InterestBlocksProps) {
  const readRef = useRef<HTMLElement>(null);
  const watchRef = useRef<HTMLElement>(null);
  const latest = useRef({ onNear });
  useEffect(() => {
    latest.current = { onNear };
  });

  // The previews only animate on screen (the `idle` class pauses them), and each scene starts
  // preparing, once, in idle time, when its block is near.
  useEffect(() => {
    const blocks: [LayerKind, HTMLElement | null][] = [
      ["reading", readRef.current],
      ["watching", watchRef.current],
    ];
    const fired = new Set<LayerKind>();
    const pending = new Map<LayerKind, () => void>();
    const kindOf = new Map<Element, LayerKind>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          e.target.classList.toggle("idle", !e.isIntersecting);
          const kind = kindOf.get(e.target);
          if (!kind || !e.isIntersecting || fired.has(kind) || pending.has(kind)) continue;
          pending.set(
            kind,
            whenIdle(() => {
              pending.delete(kind);
              fired.add(kind);
              latest.current.onNear(kind);
            }),
          );
        }
      },
      { rootMargin: NEAR_MARGIN },
    );
    for (const [kind, el] of blocks) {
      if (!el) continue;
      kindOf.set(el, kind);
      io.observe(el);
    }
    return () => {
      io.disconnect();
      for (const cancel of pending.values()) cancel();
    };
  }, []);

  const columns = miniWallColumns(videos);

  return (
    <section className="home-blocks" id="below" aria-label="Reading and watching">
      <div className="tex" />
      <div className="below">
        <div className="blocks">
          <article ref={readRef} className="block idle" id={BLOCK_ID.reading}>
            <div className="blk-text">
              <h2 className="display">
                {"What I'm"}
                <br />
                reading
              </h2>
              <p>
                {books.length} books this year, mostly film and design. Pull one off the shelf to
                see why it stayed with me.
              </p>
              <span className="pill">Open the shelf</span>
            </div>
            <div className="blk-art ms" aria-hidden="true">
              <div className="ms-plank" />
              <div className="ms-row">
                {books.map((book, i) => {
                  const s = miniSpine(book);
                  return (
                    <div
                      key={book.id}
                      className={s.band ? "ms-sp band" : "ms-sp"}
                      style={
                        {
                          "--i": i,
                          width: s.width,
                          height: s.height,
                          backgroundColor: s.background,
                          color: s.ink,
                        } as CSSProperties
                      }
                    >
                      <span>{book.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              className="blk-hit"
              data-xp="reading"
              aria-label="Open the shelf"
              onClick={(e) => onOpen("reading", e.currentTarget.closest("article") as HTMLElement)}
            />
          </article>
          <article ref={watchRef} className="block idle" id={BLOCK_ID.watching}>
            <div className="blk-text">
              <h2 className="display">
                {"What I'm"}
                <br />
                watching
              </h2>
              <p>
                {videos.length} videos I keep sending to friends: essays, rabbit holes, and a few
                masterclasses.
              </p>
              <span className="pill">Open the wall</span>
            </div>
            <div className="blk-art mw" aria-hidden="true">
              <div className="mw-cols">
                {columns.map((ids, c) => (
                  <div key={c} className="mw-col">
                    {[...ids, ...ids].map((id, k) => (
                      <img
                        key={k}
                        src={miniThumbUrl(id)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="blk-hit"
              data-xp="watching"
              aria-label="Open the wall"
              onClick={(e) => onOpen("watching", e.currentTarget.closest("article") as HTMLElement)}
            />
          </article>
        </div>
      </div>
    </section>
  );
}
