import { useRef } from "react";
import type { SiteVideo } from "../../../types";
import { useHeadClear } from "../layer/use-head-clear";
import type { WallControl } from "./wall-types";
import type { WallPick } from "./pick-channel";
import { thumbUrl } from "./wall-math";

/**
 * A minimal wall for the detail view when there is no WebGL wall: nothing to freeze, release or
 * thaw, the detail view shows the picture itself, and the tile to fly back into is the grid
 * button with that key.
 */
export const gridWall: WallControl = {
  spreads: false,
  freeze() {},
  release() {},
  thaw() {},
  rectOf(key) {
    const el = document.querySelector<HTMLElement>(`.wall-scene .fb-videos [data-key="${CSS.escape(key)}"]`);
    return el ? el.getBoundingClientRect() : null;
  },
};

type WatchingFallbackProps = {
  videos: SiteVideo[];
  onPick: (pick: WallPick) => void;
};

/**
 * The watching pane without WebGL: a static grid of thumbnails, each a button that opens the same
 * detail view the wall does (the button's rectangle is where the shot flies from).
 */
export default function WatchingFallback({ videos, onPick }: WatchingFallbackProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useHeadClear(scrollRef);
  return (
    <div className="fb-scroll" ref={scrollRef}>
      <ul className="fb-grid fb-videos" aria-label="Videos on the wall">
        {videos.map((v, i) => (
          <li key={v.id}>
            <button
              type="button"
              className="fb-item"
              data-key={v.id}
              onClick={(e) => onPick({ index: i, rect: e.currentTarget.getBoundingClientRect(), key: v.id })}
            >
              <img
                className="fb-thumb"
                src={thumbUrl(v, "mq")}
                alt=""
                width={320}
                height={180}
                loading="lazy"
                decoding="async"
              />
              <span className="fb-title">{v.title}</span>
              <span className="fb-sub">{v.channel}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
