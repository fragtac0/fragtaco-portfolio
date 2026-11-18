// The geometry of the Mars map for the app (spec 9.1; the same numbers as scripts/mars-frame.mjs, which cuts the
// pictures): where the toned picture and the wider height frame sit on the planet and how a longitude and latitude
// become map units and back.
//
// Map units: 25 per degree, x to the east and y to the south (down the picture). The picture is 1000 by 650 units
// with the summit at 500, 325. The heights cover 64 by 41.6 degrees, 1600 by 1040 units, with their top left
// corner at -300, -195. Longitudes at this interface are east longitudes, 0 to 360 (the summit is 226.795).

/** Units per degree of longitude and of latitude (the picture is plain equirectangular). */
export const UNITS_PER_DEG = 25;

/** Kilometres on the ground per map unit (a degree of Mars is 59.3 km, 25 units to a degree). */
export const KM_PER_UNIT = 2.372;

/** The toned colour picture: 40 by 26 degrees, the summit in the middle. West is a signed longitude. */
export const FRAME = { west: -153.205, north: 31.366, lonSpan: 40, latSpan: 26, unitsPerDeg: UNITS_PER_DEG };

/** The height map: wider than the picture so the ground runs on past its edges. */
export const HEIGHTS = { west: -165.205, north: 39.166, lonSpan: 64, latSpan: 41.6 };

/** The summit of Olympus Mons: east longitude and latitude. */
export const SUMMIT = { lon: 226.795, lat: 18.366 };

/** The picture in map units. */
export const PICTURE = { w: 1000, h: 650 };

/** The summit in map units. */
export const SUMMIT_XY: [number, number] = [500, 325];

/** The height frame in map units: the corner and the size. */
export const HEIGHT_FRAME = { x0: -300, y0: -195, w: 1600, h: 1040 };

const wrap360 = (lon: number) => ((lon % 360) + 360) % 360;
/** East longitude (0 to 360) of the picture's west edge: 206.795. */
const WEST_E = wrap360(FRAME.west);

/** Map unit x of an east longitude (0 to 360). 206.795 is 0, the summit 500. */
export function xOf(lon: number): number {
  let d = wrap360(lon) - WEST_E;

  if (d < -180) d += 360;
  if (d > 180) d -= 360;

  return d * UNITS_PER_DEG;
}

/** Map unit y of a latitude. 31.366 N is 0, the summit 325. */
export function yOf(lat: number): number {
  return (FRAME.north - lat) * UNITS_PER_DEG;
}

/** East longitude (0 to 360) at map unit x. */
export function lonOf(x: number): number {
  return wrap360(WEST_E + x / UNITS_PER_DEG);
}

/** Latitude at map unit y. */
export function latOf(y: number): number {
  return FRAME.north - y / UNITS_PER_DEG;
}
