import type { SiteVideo } from "../../../types";
import { miniThumbUrl, miniWallColumns } from "./mini-previews";

/**
 * The watching box's flat picture: columns of small thumbnails drifting up and down in CSS. It is the picture of a visitor without WebGL or of
 * a scene that failed (spec 6.1); a box that holds its live scene does not mount it, so no thumbnail is requested for it.
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
