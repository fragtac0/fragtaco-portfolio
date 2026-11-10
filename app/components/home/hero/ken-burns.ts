/** The slow zoom on a painting: 7% closer over 12 seconds, eased (L-07; it was 21 s). */
export const KEN_BURNS_MS = 12000;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Scale for a painting `ageMs` after it appeared: `zoom` scaled up to 7%. No drift when reduced. */
export function kenBurnsZoom(zoom: number, ageMs: number, reduced: boolean): number {
  if (reduced) return zoom;
  const a = clamp01(ageMs / KEN_BURNS_MS);
  return zoom * (1 + 0.07 * a * a * (3 - 2 * a));
}
