// The colour grade for the Mars tiles (spec 9.1): a grey THEMIS value goes through a contrast curve
// (black point, white point, gamma), then through a four stop orange ramp. Pure functions, no I/O,
// so they are tested (scripts/mars-grade.test.ts). make-mars.mjs applies them through a 256 entry table.

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Deep shadow, mid, light, highlight (spec 9.1). `at` is where on 0..1 each stop sits. */
export const STOPS = [
  { at: 0, rgb: hexToRgb("#1a0a04") },
  { at: 0.34, rgb: hexToRgb("#c2410c") },
  { at: 0.68, rgb: hexToRgb("#ff8a3d") },
  { at: 1, rgb: hexToRgb("#ffd9b0") },
];

/** The contrast curve used for the shipped tiles. Chosen by looking at the histogram and the picture. */
export const GRADE = { black: 0.22, white: 0.78, gamma: 1.25 };

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Colour for a value 0..1: straight line between the two stops either side, rounded to 8 bits. */
export function ramp(v) {
  const t = clamp01(v);
  let i = 1;
  while (i < STOPS.length - 1 && t > STOPS[i].at) i++;
  const a = STOPS[i - 1];
  const b = STOPS[i];
  const k = (t - a.at) / (b.at - a.at);
  return a.rgb.map((c, n) => Math.round(c + (b.rgb[n] - c) * k));
}

/** Levels then gamma: below `black` is 0, above `white` is 1, gamma above 1 lifts the mids. */
export function curve(v, { black, white, gamma }) {
  const t = clamp01((v - black) / (white - black));
  return Math.pow(t, 1 / gamma);
}

/** 256 rgb triples (flat, 768 bytes) for the grey values 0..255. */
export function gradeLut(params = GRADE) {
  const lut = new Uint8Array(256 * 3);
  for (let g = 0; g < 256; g++) {
    const [r, gr, b] = ramp(curve(g / 255, params));
    lut[g * 3] = r;
    lut[g * 3 + 1] = gr;
    lut[g * 3 + 2] = b;
  }
  return lut;
}
