import { useMemo, useRef, type CSSProperties } from "react";
import { countLabel } from "../../../utils/count-label";
import type { SiteBook, SiteVideo } from "../../../types";
import type { LayerKind } from "../layer/layer-state";
import "./blocks.css";
import { miniSpine, miniThumbUrl, miniWallColumns } from "./mini-previews";
import { useMiniFit } from "./use-mini-fit";
import { useNear } from "./use-near";

/** The ids the layer and the deep link find the blocks by (mockup: blkRead, blkWatch). */
export const BLOCK_ID: Record<LayerKind, string> = {
  reading: "blkRead",
  watching: "blkWatch",
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
  const blocks = useMemo(
    () => [["reading", readRef], ["watching", watchRef]] as const,
    [],
  );
  useNear(blocks, onNear);

  const columns = miniWallColumns(videos);
  const spines = useMemo(() => books.map(miniSpine), [books]);
  const shelfArtRef = useRef<HTMLDivElement>(null);
  const shelfRowRef = useRef<HTMLDivElement>(null);
  const fitSpines = useMemo(() => spines.map((s) => ({ w: s.width, h: s.height })), [spines]);
  useMiniFit(shelfArtRef, shelfRowRef, fitSpines);

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
                {countLabel(books.length, "book", "books")} this year, mostly film and design. Pull
                one off the shelf to see why it stayed with me.
              </p>
              <span className="pill">Open the shelf</span>
            </div>
            <div ref={shelfArtRef} className="blk-art ms" aria-hidden="true">
              <div className="ms-plank" />
              <div ref={shelfRowRef} className="ms-row">
                {books.map((book, i) => {
                  const s = spines[i];
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
                {countLabel(videos.length, "video", "videos")} I keep sending to friends: essays,
                rabbit holes, and a few masterclasses.
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
