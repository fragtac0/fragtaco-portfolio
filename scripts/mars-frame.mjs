// The geometry of the Mars map (spec 9.1): where the picture and the wider height frame sit on the planet,
// how a longitude and latitude become map units and back, and which NASA Trek tiles cover a frame.
// Pure functions and constants, no I/O, so they are tested (scripts/mars-frame.test.ts).
//
// Map units: 25 per degree, x to the east and y to the south (down the picture), as in the previews.
// The picture (FRAME) is 1000 by 650 units with the summit at 500, 325. The heights (HEIGHTS) cover
// 64 by 41.6 degrees, 1600 by 1040 units, with their top left corner at -300, -195.
// Longitudes at this interface are east longitudes, 0 to 360 (the summit is 226.795); the frames below
// keep the signed west edge (-153.205 is 206.795 E) because the tiles are addressed from -180.

/** Units per degree of longitude and of latitude (the picture is plain equirectangular). */
export const UNITS_PER_DEG = 25;

/** The toned colour picture: 40 by 26 degrees, the summit in the middle. */
export const FRAME = { west: -153.205, north: 31.366, lonSpan: 40, latSpan: 26, unitsPerDeg: UNITS_PER_DEG };

/** The height map: wider than the picture so the ground runs on past its edges. */
export const HEIGHTS = { west: -165.205, north: 39.166, lonSpan: 64, latSpan: 41.6 };

/** The summit of Olympus Mons: east longitude and latitude. */
export const SUMMIT = { lon: 226.795, lat: 18.366 };

const wrap360 = (lon) => ((lon % 360) + 360) % 360;
/** East longitude (0 to 360) of the picture's west edge: 206.795. */
const WEST_E = wrap360(FRAME.west);

/** Map unit x of an east longitude (0 to 360). 206.795 is 0, the summit 500. */
export function xOf(lon) {
  let d = wrap360(lon) - WEST_E;
  if (d < -180) d += 360;
  if (d > 180) d -= 360;
  return d * UNITS_PER_DEG;
}
/** Map unit y of a latitude. 31.366 N is 0, the summit 325. */
export function yOf(lat) {
  return (FRAME.north - lat) * UNITS_PER_DEG;
}
/** East longitude (0 to 360) at map unit x. */
export function lonOf(x) {
  return wrap360(WEST_E + x / UNITS_PER_DEG);
}
/** Latitude at map unit y. */
export function latOf(y) {
  return FRAME.north - y / UNITS_PER_DEG;
}

/** A frame as degrees: [west, south, east, north] (signed longitudes). */
export function boundsOf(f) {
  const latSpan = f.latSpan;
  return { west: f.west, east: f.west + f.lonSpan, north: f.north, south: f.north - latSpan };
}

/** Pixels per degree of a NASA Trek global equirectangular level: 256 px tiles, 2^(z+1) columns for 360 degrees. */
export function pxPerDeg(z) {
  return (256 * 2 ** (z + 1)) / 360;
}

/**
 * The tiles that cover a frame at level z, and where the frame sits in the stitched tile block.
 * Rows count from the north (row 0 is 90 N), columns from the west (column 0 is -180).
 * Returns { cols: [first, last], rows: [first, last], left, top, width, height } with the crop in
 * pixels of the stitched block (the block's top left is the top left of tile [first col, first row]).
 */
export function tileRange(f, z) {
  const ppd = pxPerDeg(z);
  const { west, east, north, south } = boundsOf(f);
  const x0 = (west + 180) * ppd;
  const x1 = (east + 180) * ppd;
  const y0 = (90 - north) * ppd;
  const y1 = (90 - south) * ppd;
  const c0 = Math.floor(x0 / 256);
  const c1 = Math.ceil(x1 / 256) - 1;
  const r0 = Math.floor(y0 / 256);
  const r1 = Math.ceil(y1 / 256) - 1;
  return {
    cols: [c0, c1],
    rows: [r0, r1],
    left: x0 - c0 * 256,
    top: y0 - r0 * 256,
    width: x1 - x0,
    height: y1 - y0,
  };
}
