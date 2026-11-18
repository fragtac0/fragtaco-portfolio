import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { inertProps } from "../../../utils/inert";
import { countLabel } from "../../../utils/count-label";
import type { SiteBook, SiteVideo } from "../../../types";
import EclipseGround from "../../ground/eclipse-ground";
import type { LayerKind } from "../layer/layer-state";
import "./blocks.css";
import type { BoxPicture } from "./box-picture";
import MiniShelf from "./mini-shelf";
import MiniWall from "./mini-wall";
import { useNear } from "./use-near";

/** The ids the layer and the deep link find the blocks by (mockup: blkRead, blkWatch). */
export const BLOCK_ID: Record<LayerKind, string> = {
  reading: "blkRead",
  watching: "blkWatch",
};

type InterestBlocksProps = {
  books: SiteBook[];
  videos: SiteVideo[];
  /** A click on a block: the home page decides what it does while the block's scene is not ready (layer/open-gate.ts). */
  onOpen: (kind: LayerKind) => void;
  /** Each scene's own element (null on the server): it stands in its block's box, drawn live (layer/box-scene.ts). */
  homes: Record<LayerKind, HTMLElement> | null;
  /** What each box shows (box-picture.ts): the dark ground until the client has decided, its live scene, or (only then mounted) the flat mini preview (mini-shelf.tsx, mini-wall.tsx). */
  picture: Record<LayerKind, BoxPicture>;
  /** Fires once per kind, in idle time, when its block comes within 240 px of the viewport. */
  onNear: (kind: LayerKind) => void;
  /** A hero card is open over the page: the blocks are out of the tab order until it closes. */
  blocked?: boolean;
  /** An open layer covers the page: the ground behind the blocks stops moving. */
  covered?: boolean;
};

function InterestBlocks({
  books,
  videos,
  onOpen,
  homes,
  picture,
  onNear,
  blocked = false,
  covered = false,
}: InterestBlocksProps) {
  const readRef = useRef<HTMLElement>(null);
  const watchRef = useRef<HTMLElement>(null);
  const blocks = useMemo(
    () =>
      [
        ["reading", readRef],
        ["watching", watchRef],
      ] as const,
    [],
  );
  // the shelf block coming near also lets its small spines (the flat picture, mini-shelf.tsx) load their faces
  const [shelfNear, setShelfNear] = useState(false);
  const onNearBlock = useCallback(
    (kind: LayerKind) => {
      if (kind === "reading") setShelfNear(true);
      onNear(kind);
    },
    [onNear],
  );
  useNear(blocks, onNearBlock);

  // each scene's element stands in its box (the layer carries it away while it is open, and back)
  useLayoutEffect(() => {
    if (!homes) return;
    for (const [kind, ref] of blocks) {
      const slot = ref.current?.querySelector(".blk-live");
      if (slot && !homes[kind].parentElement) slot.appendChild(homes[kind]);
    }
  }, [homes, blocks]);

  return (
    <section
      className="home-blocks"
      id="below"
      aria-label="Reading and watching"
      {...inertProps(blocked)}
    >
      <EclipseGround placement={2} scope="section" covered={covered} />
      <div className="below">
        <div className="blocks">
          <article
            ref={readRef}
            className="block idle"
            id={BLOCK_ID.reading}
            data-live={picture.reading === "live" ? "" : undefined}
          >
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
              <span className="pill" aria-hidden="true">
                Open the shelf
              </span>
            </div>
            <div className="blk-box">
              {picture.reading === "flat" && <MiniShelf books={books} near={shelfNear} />}
              <div className="blk-live" />
            </div>
            <button
              type="button"
              className="blk-hit"
              data-xp="reading"
              aria-label="Open the shelf"
              onClick={() => onOpen("reading")}
            />
          </article>
          <article
            ref={watchRef}
            className="block idle"
            id={BLOCK_ID.watching}
            data-live={picture.watching === "live" ? "" : undefined}
          >
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
              <span className="pill" aria-hidden="true">
                Open the wall
              </span>
            </div>
            <div className="blk-box">
              {picture.watching === "flat" && <MiniWall videos={videos} />}
              <div className="blk-live" />
            </div>
            <button
              type="button"
              className="blk-hit"
              data-xp="watching"
              aria-label="Open the wall"
              onClick={() => onOpen("watching")}
            />
          </article>
        </div>
      </div>
    </section>
  );
}

// Memoised: the page re-renders on every card move, and the blocks only care about `blocked`.
export default memo(InterestBlocks);
