// What the map's canvas draws for one frame (spec 9.1, 9.2). Pure maths, no DOM.
//
// `planDraw` turns the tiles a view needs into pieces to draw. A tile that has not arrived is drawn from
// the nearest coarser tile that has (a sub-rectangle of it, stretched), so there is never an empty frame once
// the lowest level is in; the sharper tile replaces it when it arrives. `edgeBands` is the picture's own
// fade into the ground along its four edges, drawn on top of the tiles, so a side of the screen where the
// picture ends (the overview of a wide or tall screen) shows no hard edge.
import type { Manifest } from "./geo";
import type { Tile } from "./tiles";
import type { View } from "./view";

export type Piece = {
  /** The tile file to draw from. */
  z: number;
  x: number;
  y: number;
  /** The source rectangle in that tile's own pixels. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** The destination rectangle in CSS pixels, snapped to device pixels and grown to meet its neighbours. */
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

/**
 * The pieces to draw for `tiles`, in order. `has` says whether a tile's picture is loaded. A tile that is not
 * loaded falls back to its nearest loaded ancestor (level z - 1, then z - 2, down to level 0); with none it is
 * left out (the ground shows). Destination edges are snapped outwards to whole device pixels (`dpr` per CSS
 * pixel), so neighbouring tiles overlap by a pixel at most and never leave a seam.
 */
export function planDraw(
  tiles: readonly Tile[],
  tile: number,
  dpr: number,
  has: (z: number, x: number, y: number) => boolean,
): Piece[] {
  const out: Piece[] = [];

  for (const t of tiles) {
    const dx = Math.floor(t.left * dpr) / dpr;
    const dy = Math.floor(t.top * dpr) / dpr;
    const dw = Math.ceil((t.left + t.size) * dpr) / dpr - dx;
    const dh = Math.ceil((t.top + t.size) * dpr) / dpr - dy;

    if (has(t.z, t.x, t.y)) {
      out.push({ z: t.z, x: t.x, y: t.y, sx: 0, sy: 0, sw: tile, sh: tile, dx, dy, dw, dh });
      continue;
    }
    for (let z = t.z - 1; z >= 0; z--) {
      const r = 2 ** (t.z - z); // tiles of level t.z along one side of the ancestor
      const ax = Math.floor(t.x / r);
      const ay = Math.floor(t.y / r);

      if (!has(z, ax, ay)) continue;
      const sub = tile / r;
      out.push({ z, x: ax, y: ay, sx: (t.x - ax * r) * sub, sy: (t.y - ay * r) * sub, sw: sub, sh: sub, dx, dy, dw, dh });
      break;
    }
  }

  return out;
}

/** The fade along each picture edge, as a share of the picture's side. */
export const EDGE_BAND = 0.12;
/** The ground's strength at the fade's steps, edge to inside (an ease-out curve, close to (1 - t) squared). */
export const EDGE_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.2, 0.64],
  [0.45, 0.26],
  [0.7, 0.07],
  [1, 0],
];

/** Each band starts this many CSS pixels outside the picture, over the pixel row that tile snapping puts past its edge, so no hairline of picture shows beyond the fade. */
export const EDGE_OUTSET = 1;

export type Band = {
  side: "left" | "right" | "top" | "bottom";
  /** The part of the band on the screen (CSS pixels). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The gradient's line, from the picture's edge (strength 1) to the band's inner side (strength 0). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

/** The picture's square on the screen, in CSS pixels. */
export function pictureRect(v: View, vw: number, vh: number, m: Pick<Manifest, "size">) {
  return { left: vw / 2 - v.cx * v.scale, top: vh / 2 - v.cy * v.scale, side: m.size * v.scale };
}

/**
 * The picture's edge bands that reach the screen. Each runs along one edge of the picture and fades from the
 * ground colour at the edge to nothing `EDGE_BAND` of the side inside; the corners are covered twice, which
 * rounds them off. A band wholly off the screen is left out, so a zoomed-in view pays for none.
 */
export function edgeBands(v: View, vw: number, vh: number, m: Pick<Manifest, "size">): Band[] {
  const { left, top, side } = pictureRect(v, vw, vh, m);
  const b = side * EDGE_BAND;
  const o = EDGE_OUTSET;
  const right = left + side;
  const bottom = top + side;
  const all: Band[] = [
    { side: "left", x: left - o, y: top - o, w: b + o, h: side + 2 * o, x0: left - o, y0: 0, x1: left + b, y1: 0 },
    { side: "right", x: right - b, y: top - o, w: b + o, h: side + 2 * o, x0: right + o, y0: 0, x1: right - b, y1: 0 },
    { side: "top", x: left - o, y: top - o, w: side + 2 * o, h: b + o, x0: 0, y0: top - o, x1: 0, y1: top + b },
    { side: "bottom", x: left - o, y: bottom - b, w: side + 2 * o, h: b + o, x0: 0, y0: bottom + o, x1: 0, y1: bottom - b },
  ];
  const out: Band[] = [];

  for (const band of all) {
    // clip the band to the screen
    const x = Math.max(0, band.x);
    const y = Math.max(0, band.y);
    const w = Math.min(vw, band.x + band.w) - x;
    const h = Math.min(vh, band.y + band.h) - y;

    if (w > 0 && h > 0) out.push({ ...band, x, y, w, h });
  }

  return out;
}
