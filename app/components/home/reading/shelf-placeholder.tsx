import { useLayoutEffect, useRef, useState } from "react";
import type { SiteBook } from "../../../types";
import { placeholderLayout, type PlaceholderLayout } from "./shelf-placeholder-layout";

type ShelfPlaceholderProps = {
  books: readonly SiteBook[];
  /** The 3D shelf has drawn its first frame: fade out. */
  leaving: boolean;
};

/**
 * What the shelf layer shows until the 3D shelf is ready: the hairline and one flat bar per book, in
 * the book's spine colour, where the 3D shelf will stand (`placeholderLayout`). It sits over the
 * engine's canvas and fades away when the first frame has been drawn; ReadingScene removes it after.
 * Decorative only, so it is hidden from assistive technology and ignores the pointer.
 */
export default function ShelfPlaceholder({ books, leaving }: ShelfPlaceholderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PlaceholderLayout | null>(null);

  // measured before the first paint, so the bars are in the first frame the layer shows
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setLayout(placeholderLayout(books, { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [books]);

  return (
    <div
      ref={ref}
      className={leaving ? "shelf-placeholder leaving" : "shelf-placeholder"}
      aria-hidden="true"
    >
      {layout && (
        <>
          <div
            className="sp-line"
            style={{
              left: layout.line.left,
              top: layout.line.top,
              width: layout.line.width,
              height: layout.line.height,
            }}
          />
          {layout.bars.map((bar, i) => (
            <div
              key={books[i].id}
              className="sp-bar"
              style={{
                left: bar.left,
                top: layout.floor - bar.height,
                width: bar.width,
                height: bar.height,
                backgroundColor: books[i].spine,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
