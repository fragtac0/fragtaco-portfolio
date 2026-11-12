// The toning of the relief picture (spec 9.1, as in round7-preview-3): the colour mosaic goes to grey first,
// then contrast and brightness lift it, then one orange is multiplied over it. So it is orange without
// being loud. Pure functions, no I/O (tested in scripts/mars-tone.test.ts).

export const TONE = { contrast: 1.42, brightness: 1.28, orange: [0.86, 0.5, 0.27] };

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Rec. 709 grey of an 8 bit colour, 0 to 1 (the same weights as CSS grayscale(1)). */
export function grey(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Contrast about the middle, then brightness, each clamped (CSS filter order). */
export function lift(v, { contrast, brightness } = TONE) {
  return clamp01(clamp01((v - 0.5) * contrast + 0.5) * brightness);
}

/** The toned colour for a grey value 0 to 1: three 8 bit numbers. */
export function tone(v, params = TONE) {
  const t = lift(v, params);
  return params.orange.map((o) => Math.round(t * o * 255));
}

/** 256 rgb triples (flat, 768 bytes) for the grey values 0 to 255. */
export function toneLut(params = TONE) {
  const lut = new Uint8Array(256 * 3);
  for (let g = 0; g < 256; g++) lut.set(tone(g / 255, params), g * 3);
  return lut;
}
