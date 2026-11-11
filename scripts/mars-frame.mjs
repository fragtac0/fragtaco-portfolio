// The geometry of the Mars frame (spec 9.1): where it sits on the planet, how it is split into the
// blocks the WMS will serve (it refuses more than 4096 px a side), and the tile pyramid sizes.
// Pure functions and constants, no I/O, so they are tested (scripts/mars-frame.test.ts).

/** The middle of the summit caldera complex, found on a 4096 px THEMIS frame (Task 2 report). */
export const CENTRE = { lon: 226.795, lat: 18.366 };
/** Latitude span in degrees; the longitude span is wider so that the picture is square on the ground. */
export const SPAN_DEG = 14;
export const LON_SCALE = Math.cos((CENTRE.lat * Math.PI) / 180);
export const LON_SPAN_DEG = SPAN_DEG / LON_SCALE;
export const TILE = 512;
export const LEVELS = 5;
export const SIZE = TILE * 2 ** (LEVELS - 1); // 8192, the top level
export const BLOCK = 4096; // the WMS limit
export const BLOCKS = SIZE / BLOCK; // blocks per side

/** The whole frame in degrees. */
export function frameBounds() {
  return {
    west: CENTRE.lon - LON_SPAN_DEG / 2,
    east: CENTRE.lon + LON_SPAN_DEG / 2,
    south: CENTRE.lat - SPAN_DEG / 2,
    north: CENTRE.lat + SPAN_DEG / 2,
  };
}

/** One WMS block as [west, south, east, north]; bx counts from the west, by from the north. */
export function blockBox(bx, by) {
  const { west, north } = frameBounds();
  const dLon = LON_SPAN_DEG / BLOCKS;
  const dLat = SPAN_DEG / BLOCKS;
  return [west + bx * dLon, north - (by + 1) * dLat, west + (bx + 1) * dLon, north - by * dLat];
}
