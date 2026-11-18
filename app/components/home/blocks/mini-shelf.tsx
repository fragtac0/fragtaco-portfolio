import { useMemo, useRef, type CSSProperties } from "react";
import type { SiteBook } from "../../../types";
import MiniLedge from "./mini-ledge";
import { miniSpine } from "./mini-previews";
import { useMiniFit } from "./use-mini-fit";
import { useMiniSpines } from "./use-mini-spines";

type MiniShelfProps = {
  books: SiteBook[];
  /** The block is close to the screen: the small spines may load their faces and paint (use-mini-spines.ts). */
  near: boolean;
};

/**
 * The reading box's flat picture: the shelf's row on its rock ledge, drawn small with the 3D shelf's own spine painter. It is the picture of
 * a visitor without WebGL or of a scene that failed or lost its context (spec 6.1, 6.3). It mounts only once the client has decided the box
 * is not live (box-picture.ts): not in the server's render, not in the hydration render and not for a live visitor, so a live visitor pays for
 * none of its spines, faces or fonts twice. It is mounted with its own fit (a layout effect: the row is at its size in the first painted frame)
 * and its own painting, also if the scene fails later.
 */
export default function MiniShelf({ books, near }: MiniShelfProps) {
  const spines = useMemo(() => books.map(miniSpine), [books]);
  const artRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const fitSpines = useMemo(() => spines.map((s) => ({ w: s.width, h: s.height })), [spines]);
  useMiniFit(artRef, rowRef, fitSpines);
  useMiniSpines(artRef, rowRef, books, spines, near);
  return (
    <div ref={artRef} className="blk-art ms" aria-hidden="true">
      <MiniLedge />
      <div ref={rowRef} className="ms-row">
        {books.map((book, i) => {
          const s = spines[i];
          return (
            <div
              key={book.id}
              className="ms-sp"
              style={
                {
                  "--i": i,
                  width: s.width,
                  height: s.height,
                  backgroundColor: s.background,
                } as CSSProperties
              }
            >
              <canvas data-spine={i} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
