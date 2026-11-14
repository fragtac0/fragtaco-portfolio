/**
 * The dot field behind the open book shelf (spec 5.2): very small dots on the plain ground, one every
 * 7 px, 0.8 to 1.7 px across, 2% to 10% cream, with two slow swells passing through (about one pass
 * in half a minute). Barely visible. Ported from the back canvas of docs/redesign/round7-preview-7/shelf.js.
 * `dotAt` is the pure rule; `paintDots` draws the whole field onto a 2D canvas of any size, so the
 * same code can fill a frame smaller than the window.
 */

/** The grid, in CSS pixels. */
export const DOT_STEP = 7;
export const DOT_SIZE_MIN = 0.8;
export const DOT_SIZE_MAX = 1.7;
export const DOT_ALPHA_MIN = 0.022;
export const DOT_ALPHA_MAX = 0.097;
/** The field's cream is the page's (tokens `CREAM`, #fdfce6). */
const CREAM_RGB = "253,252,230";
/** The strength 0..1 is cut into this many steps: all dots of a step are filled in one go. */
const LEVELS = 16;

/** The swell's strength 0..1 at a point (CSS pixels from the field's corner) and a time in seconds. */
function swell(x: number, y: number, t: number): number {
  const f =
    0.5 +
    0.27 * Math.sin(x * 0.011 + y * 0.004 - t * 0.2) +
    0.23 * Math.sin(y * 0.015 - x * 0.006 + t * 0.13 + 2);
  return Math.min(1, Math.max(0, f));
}

/** The dot centred at (x, y) at time `t` seconds: its width and height in pixels, and its opacity. */
export function dotAt(x: number, y: number, t: number): { size: number; alpha: number } {
  const f = swell(x, y, t);
  return {
    size: DOT_SIZE_MIN + (DOT_SIZE_MAX - DOT_SIZE_MIN) * f,
    alpha: DOT_ALPHA_MIN + (DOT_ALPHA_MAX - DOT_ALPHA_MIN) * f,
  };
}

/**
 * Draws the field onto `c` (already scaled to CSS pixels) for a `w` by `h` area at time `t` seconds.
 * Dots are gathered into 16 strengths and each strength is one filled path, so a full screen is about
 * sixteen fills instead of tens of thousands.
 */
export function paintDots(c: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  c.clearRect(0, 0, w, h);
  const cols = Math.max(0, Math.floor((w - DOT_STEP / 2) / DOT_STEP) + 1);
  const rows = Math.max(0, Math.floor((h - DOT_STEP / 2) / DOT_STEP) + 1);
  if (!cols || !rows) return;
  const level = new Uint8Array(cols * rows);
  for (let i = 0; i < cols; i++) {
    const x = DOT_STEP / 2 + i * DOT_STEP;
    for (let j = 0; j < rows; j++) {
      level[i * rows + j] = Math.round(swell(x, DOT_STEP / 2 + j * DOT_STEP, t) * (LEVELS - 1));
    }
  }
  for (let k = 0; k < LEVELS; k++) {
    const f = k / (LEVELS - 1);
    const size = DOT_SIZE_MIN + (DOT_SIZE_MAX - DOT_SIZE_MIN) * f;
    c.fillStyle = `rgba(${CREAM_RGB},${(DOT_ALPHA_MIN + (DOT_ALPHA_MAX - DOT_ALPHA_MIN) * f).toFixed(3)})`;
    c.beginPath();
    let any = false;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (level[i * rows + j] !== k) continue;
        c.rect(DOT_STEP / 2 + i * DOT_STEP - size / 2, DOT_STEP / 2 + j * DOT_STEP - size / 2, size, size);
        any = true;
      }
    }
    if (any) c.fill();
  }
}
