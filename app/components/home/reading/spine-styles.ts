import { CREAM, GROUND, rgba } from "../../../styles/tokens";

/**
 * Colour maths for the spines (WCAG contrast, mixing) and the colours a plain spine is made from a
 * cover's: `spineColours`. Pure: no canvas, no DOM. The designs themselves are spine-series.ts and the
 * painting is spine-paint.ts.
 */

// ---- colour maths (WCAG 2 relative luminance and contrast)

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Relative luminance 0..1 of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const lin = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** The WCAG contrast ratio, 1 to 21, between two `#rrggbb` colours. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `a` moved `t` (0..1) of the way to `b`. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  return toHex([0, 1, 2].map((i) => pa[i] + (pb[i] - pa[i]) * t) as Rgb);
}

/** The two inks a spine can wear: warm cream and a warm near black (as the mini shelf's `inkOn`). */
const LIGHT_INK = "#f6f0e2";
const DARK_INK = "#17120d";
/** Ink against the ground: the lettering is small, so the AA ratio for body text. */
export const MIN_INK_CONTRAST = 4.5;
/** The accent only draws rules and ornaments, so the ratio for graphics. */
export const MIN_ACCENT_CONTRAST = 3;

export type SpineColours = { ground: string; ink: string; accent: string };

const bestInk = (ground: string): string =>
  contrast(LIGHT_INK, ground) >= contrast(DARK_INK, ground) ? LIGHT_INK : DARK_INK;

/**
 * The colours a spine is drawn in, from the cover's two main colours: the ground is the dominant
 * colour (nudged towards white or black, whichever is nearer, only as far as it takes for one of
 * the two inks to reach 4.5:1 on it), the ink is that ink and the accent is the secondary colour
 * (pulled towards the ink until it reaches 3:1 on the ground). A mid tone ground, where neither
 * ink would read, is the only one that moves.
 */
export function spineColours(cover: { dominant: string; secondary: string }): SpineColours {
  let ground = cover.dominant;
  let ink = bestInk(ground);
  for (let i = 0; i < 40 && contrast(ink, ground) < MIN_INK_CONTRAST; i++) {
    ground = mix(ground, luminance(ground) > 0.18 ? "#ffffff" : "#000000", 0.06);
    ink = bestInk(ground);
  }
  let accent = cover.secondary;
  for (let i = 0; i < 20 && contrast(accent, ground) < MIN_ACCENT_CONTRAST; i++) {
    accent = mix(accent, ink, 0.25);
  }
  return { ground, ink, accent };
}

/**
 * A spine whose ground is this close to the page ground (contrast ratio under it) would vanish
 * against it, so it gets a light edge along both long sides (spine-draw.ts). Colours stay true:
 * only the edge is added.
 */
export const EDGE_BELOW_CONTRAST = 1.5;
/** The edge: the cream of tokens.css at low strength. */
export const EDGE_COLOUR = rgba(CREAM, 0.28);

/** True when a spine of this ground colour is too close to `--ground` to read against it. */
export const needsEdge = (ground: string): boolean => contrast(ground, GROUND) < EDGE_BELOW_CONTRAST;
