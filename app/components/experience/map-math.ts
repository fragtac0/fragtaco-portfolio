// Small shared maths for the round 7 map: clamp, lerp, smoothstep, the ease of the camera move, a range.

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smoothstep: 0 up to a, 1 from b, an S between. */
export function smooth(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a));

  return t * t * (3 - 2 * t);
}

/** Ease in and out (cubic). */
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** The numbers from start up to but not including stop, in steps (the same as d3.range). */
export function range(start: number, stop: number, step = 1): number[] {
  const n = Math.max(0, Math.ceil((stop - start) / step));

  return Array.from({ length: n }, (_, i) => start + i * step);
}
