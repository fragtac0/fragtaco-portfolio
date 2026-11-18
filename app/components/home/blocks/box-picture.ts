import type { SceneStatus } from "../layer/open-gate";

/**
 * What a home box shows (spec 6.1, 6.3):
 * - `ground`: its dark ground, with the block's words. The server's render, the hydration render and a visitor without JavaScript:
 *   the client has not decided yet, so neither picture is mounted and nothing is requested;
 * - `live`: its live scene (WebGL, not failed). No flat preview is mounted, so no thumbnail is requested and no small spine painted;
 * - `flat`: the flat mini preview (mini-shelf.tsx, mini-wall.tsx), once the client has decided that the scene cannot draw (no WebGL, a
 *   failed scene or a lost context). It mounts in the same commit that takes the live scene away, so the box is never empty.
 */
export type BoxPicture = "ground" | "live" | "flat";

/** The box's picture from whether the client has hydrated and how ready its scene is. A scene that has gone plain never goes back to 3D. */
export function boxPicture(clientReady: boolean, status: SceneStatus): BoxPicture {
  if (!clientReady) return "ground";
  return status === "plain" ? "flat" : "live";
}
