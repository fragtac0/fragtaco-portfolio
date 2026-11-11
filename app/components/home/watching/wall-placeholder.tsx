import { useLayoutEffect, useRef, useState } from "react";
import { placeholderTiles, type PlaceholderTile } from "./wall-placeholder-layout";

type WallPlaceholderProps = {
  /** How many videos the wall shows (its columns are filled the same way). */
  count: number;
  /** The wall has drawn its first frame: fade out. */
  leaving: boolean;
};

/**
 * What the watching layer shows until the wall is ready: dark rounded tiles at the wall's tile
 * size, where a cold wall's first frame will put them (`placeholderTiles`). It sits over the
 * engine's canvas and fades away when the first frame has been drawn; WatchingScene removes it
 * after. Decorative only, so it is hidden from assistive technology and ignores the pointer.
 */
export default function WallPlaceholder({ count, leaving }: WallPlaceholderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tiles, setTiles] = useState<PlaceholderTile[]>([]);

  // measured before the first paint, so the tiles are in the first frame the layer shows
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setTiles(placeholderTiles(el.clientWidth, el.clientHeight, count));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);

  return (
    <div
      ref={ref}
      className={leaving ? "wall-placeholder leaving" : "wall-placeholder"}
      aria-hidden="true"
    >
      {tiles.map((t) => (
        <div
          key={t.key}
          className="wp-tile"
          style={{
            left: t.left,
            top: t.top,
            width: t.width,
            height: t.height,
            borderRadius: t.radius,
          }}
        />
      ))}
    </div>
  );
}
