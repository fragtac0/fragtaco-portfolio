import type { SiteVideo } from "../../../types";
import { miniThumbUrl, miniWallColumns } from "./mini-previews";

/**
 * The watching box's flat picture: columns of small thumbnails drifting up and down in CSS. It is the picture of a visitor without WebGL or of
 * a scene that failed or lost its context (spec 6.1, 6.3). It mounts only once the client has decided the box is not live (box-picture.ts):
 * not in the server's render, not in the hydration render and not for a live visitor, so a live visitor requests none of its thumbnails.
 * A scene that fails later mounts it in the commit that takes the live scene away; its thumbnails then load at network speed (the images are lazy).
 */
export default function MiniWall({ videos }: { videos: SiteVideo[] }) {
  const columns = miniWallColumns(videos);
  return (
    <div className="blk-art mw" aria-hidden="true">
      <div className="mw-cols">
        {columns.map((ids, c) => (
          <div key={c} className="mw-col">
            {[...ids, ...ids].map((id, k) => (
              <img key={k} src={miniThumbUrl(id)} alt="" loading="lazy" decoding="async" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
