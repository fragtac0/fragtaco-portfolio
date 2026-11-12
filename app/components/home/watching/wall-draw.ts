import type { WallGl } from "./wall-gl";
import { arrivalOf } from "./wall-planes";
import type { Tile } from "./wall-types";

/**
 * Draws one frame of the wall: for each tile (already posed and sorted) a soft shadow and the
 * orange glow under a focused one, the tile itself, and a hairline cream edge on the tiles of the
 * focused video's channel. A picture that has just been uploaded fades in over the placeholder and
 * settles from 96% to 100% (`arrivalOf`); one that is not on the atlas yet keeps the animated
 * placeholder.
 */

export type DrawInput = {
  now: number;
  vw: number;
  vh: number;
  pitchX: number;
  reduced: boolean;
  /** Each video's atlas rectangle, and when its picture went up (performance.now ms, 0 until then). */
  uvs: ReadonlyArray<[number, number, number, number]>;
  loadedAt: ArrayLike<number> | undefined;
};

/** The orange glow under the focused tile is tokens.css --glow: no wider than 28 px, no stronger than 18%. */
const GLOW_REACH = 28;
const GLOW_ALPHA = 0.18;

/** The echo edge: cream, at 35%. */
const ECHO_EDGE = 0.35;

export function drawTiles(wgl: WallGl, list: readonly Tile[], d: DrawInput): void {
  const { gl: g, uniforms: U } = wgl;
  g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
  g.clearColor(0, 0, 0, 0);
  g.clear(g.COLOR_BUFFER_BIT);
  g.uniform2f(U.uRes, d.vw, d.vh);
  g.uniform1f(U.uTime, d.reduced ? 0 : d.now / 1000);
  for (const tl of list) {
    const L = tl.cx - tl.w / 2;
    const T = tl.cy - tl.h / 2;
    if (tl.f > 0.01) {
      wgl.quad(L, T + 18 * tl.f, tl.w, tl.h, 2, 0.5 * tl.f, 70, tl.rad); // a soft shadow lifts it off the wall
      wgl.quad(L, T, tl.w, tl.h, 1, GLOW_ALPHA * tl.f, GLOW_REACH, tl.rad); // and the site glow: 28 px, 18%
    }
    const uv = d.uvs[tl.idx];
    g.uniform4f(U.uCell, uv[0], uv[1], uv[2], uv[3]);
    g.uniform1f(U.uBias, tl.bias);
    g.uniform1f(U.uDim, tl.dim);
    const a = arrivalOf({
      loadedAt: d.loadedAt?.[tl.idx] ?? 0,
      now: d.now,
      distanceFromCentre: Math.hypot(tl.cx - d.vw / 2, tl.cy - d.vh / 2),
      pitch: d.pitchX,
      reduced: d.reduced,
    });
    if (!a.loaded || a.alpha < 1) {
      g.uniform1f(U.uLoaded, 0);
      wgl.quad(L, T, tl.w, tl.h, 0, 1, 0, tl.rad); // the placeholder, until the picture is up
    }
    if (a.loaded && a.alpha > 0) {
      const w = tl.w * a.scale;
      const h = tl.h * a.scale;
      g.uniform1f(U.uLoaded, 1);
      wgl.quad(tl.cx - w / 2, tl.cy - h / 2, w, h, 0, a.alpha, 0, tl.rad * a.scale);
    }
    if (tl.e > 0.01) wgl.quad(L, T, tl.w, tl.h, 3, ECHO_EDGE * tl.e, 0, tl.rad);
  }
}
