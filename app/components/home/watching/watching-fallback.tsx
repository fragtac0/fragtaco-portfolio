import type { SiteVideo } from "../../../types";
import type { WallControl } from "./wall-engine";
import type { WallPick } from "./watching-scene";
import { thumbUrl } from "./wall-math";

/**
 * A minimal wall for the detail view when there is no WebGL wall: nothing to freeze, thaw or
 * hold, and the tile to fly back into is the grid button with that key.
 */
export const gridWall: WallControl = {
  freeze() {},
  thaw() {},
  hold() {},
  rectOf(key) {
    const el = document.querySelector<HTMLElement>(`.wall-scene .fb-videos [data-key="${key}"]`);
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
  return (
    <div className="fb-scroll">
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
