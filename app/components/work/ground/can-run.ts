/**
 * Whether the work pages' shader ground may start (spec 6.4). It needs WebGPU, and it stays off when the
 * visitor asked for less motion or less data: then the still CSS gradient (WorkBackground) is the ground
 * for good, and the `shaders` package is never fetched.
 */
export function canRunGround(env: { gpu: boolean; reduced: boolean; saveData: boolean }): boolean {
  return env.gpu && !env.reduced && !env.saveData;
}

/** Reads the three answers from the browser. Client only: on the server nothing can run. */
export function readGroundEnv(): { gpu: boolean; reduced: boolean; saveData: boolean } {
  if (typeof window === "undefined") return { gpu: false, reduced: true, saveData: true };
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return {
    gpu: Boolean((navigator as Navigator & { gpu?: unknown }).gpu),
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: connection?.saveData === true,
  };
}

/**
 * The canvas is drawn at no more than this many device pixels per CSS pixel (spec 6.4). The package
 * caps its canvas at 2 (1.5 on a phone-sized touch screen) and has no prop for a lower cap, so the
 * scene draws a smaller box and scales it up with a transform: this is the scale.
 */
export const GROUND_MAX_DPR = 1.25;

/** The package's own cap (its `maxPixelRatioForDevice`, which it does not export): 1.5 on a coarse-pointer screen up to 1366 px long, else 2. */
export function libraryDprCap(env: { coarse: boolean; longSide: number }): number {
  return env.coarse && env.longSide > 0 && env.longSide <= 1366 ? 1.5 : 2;
}

/**
 * How much to scale the drawn box up so its canvas has `GROUND_MAX_DPR` device pixels per CSS pixel
 * of the screen. 1 when the screen is already at or under the cap. The box is sized to 100% / k.
 */
export function groundScale(dpr: number, cap: number): number {
  const drawn = Math.min(Math.max(dpr, 1), cap);
  return drawn > GROUND_MAX_DPR ? drawn / GROUND_MAX_DPR : 1;
}
