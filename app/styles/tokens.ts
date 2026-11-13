/**
 * The dark grounds of tokens.css, for the places that cannot read a CSS variable: shader source and
 * canvas drawing. tokens.test.ts reads tokens.css and fails if these drift from it. Change a ground
 * in tokens.css first, then here.
 */
export const GROUND = "#0e0e0d";
export const SURFACE_1 = "#171716";
/** The accent and the cream of tokens.css (`--accent`, and `--cream` under `.home-page`), for the glass front's pictures. */
export const ACCENT = "#fc4c00";
export const CREAM = "#fdfce6";
/** The cream at the strength of `--line` (hairlines and borders), for the shelf's line in 3D. */
export const LINE_ALPHA = 0.1;

export function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `#rrggbb` as a canvas colour at the given opacity. */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** `#rrggbb` as a GLSL `vec3` literal (each channel to three decimals, no leading zero). */
export function glslVec3(hex: string): string {
  const v = channels(hex).map((c) => (c / 255).toFixed(3).replace(/^0\./, "."));
  return `vec3(${v.join(",")})`;
}
