import { channels, CREAM } from "../../../styles/tokens";

/**
 * The rock ledge the books stand on (spec 8.2): ten lines, the first straight and bright, the rest
 * wavering more and more and fading, a little warmer then deeper. Ported from the `strata` of
 * docs/redesign/round7-preview-7/shelf.js. The geometry is pure: the 3D shelf draws it onto a canvas
 * texture (shelf-ledge.ts) and the home block's small shelf draws it as SVG paths (blocks/mini-ledge.tsx),
 * so the two agree.
 */

/** The ledge's height in the preview's own units, and the most it is given on screen (CSS pixels). */
export const LEDGE_H = 74;
const LEDGE_LINES = 10;
/** The lines are 7.4 units apart, the first 1 unit under the top. */
const LINE_GAP = 7.4;
/** Points on a line are about this far apart along x. */
const STEP = 20;

export type LedgeLine = {
  /** The line's resting height from the ledge's top, in `LEDGE_H` units (the wave moves it from here). */
  y: number;
  /** An SVG path, `width` units wide, in a `width` by `LEDGE_H` box (the height argument scales it). */
  d: string;
  /** The stroke's opacity: 0.85 for the top line, 0.683 and down to 0.15 for the lowest. */
  alpha: number;
  /** 0 on the top line, then how far down the lines are, 0.11 to 1: the colour moves from orange to a deep brown. */
  warm: number;
};

/**
 * The ten lines for a ledge `width` wide. `seed` shifts the waves so two ledges need not match
 * (0 is the preview's). `height` scales the lines' heights (the ledge is squeezed on a short
 * screen); the waves keep their size in x. Points are about 20 apart along x; the first is at 0, the
 * last at `width`.
 */
export function ledgeLines(width: number, seed = 0, height = LEDGE_H): LedgeLine[] {
  const n = Math.max(1, Math.round(width / STEP));
  const k = height / LEDGE_H;
  const out: LedgeLine[] = [];
  for (let i = 0; i < LEDGE_LINES; i++) {
    const y0 = 1 + i * LINE_GAP;
    const t = i / (LEDGE_LINES - 1);
    let d = "";
    for (let s = 0; s <= n; s++) {
      const x = (width * s) / n;
      // line 0 is straight; the rest waver more the lower they are
      const wave =
        i === 0
          ? 0
          : (2.2 * Math.sin(x * 0.011 + i * 1.3 + seed) + 1.4 * Math.sin(x * 0.037 + i * 2.1 + seed * 1.7)) * (0.4 + t);
      d += `${s ? "L" : "M"}${x.toFixed(1)},${((y0 + wave) * k).toFixed(2)}`;
    }
    out.push({ y: y0 * k, d, alpha: i === 0 ? 0.85 : 0.75 - 0.6 * t, warm: i === 0 ? 0 : t });
  }
  return out;
}

/** The stroke of one line: the top one is cream and a little thicker; the rest go from orange to brown. CSS pixels. */
export function ledgeStroke(line: LedgeLine): { color: string; width: number } {
  const a = line.alpha.toFixed(2);
  if (line.warm === 0) {
    const [r, g, b] = channels(CREAM);
    return { color: `rgba(${r},${g},${b},${a})`, width: 1.3 };
  }
  const t = line.warm;
  return {
    color: `rgba(${Math.round(255 - 60 * t)},${Math.round(150 - 80 * t)},${Math.round(80 - 50 * t)},${a})`,
    width: 0.9,
  };
}

/** How high the ledge is on a stage `stageH` tall whose books stand at `baseRow`: 74 px at most, what is left under the feet on a short screen. */
export function ledgeHeight(stageH: number, baseRow: number): number {
  return Math.max(0, Math.min(LEDGE_H, Math.floor(stageH - baseRow)));
}

/** Both ends fade over this share of the width, so the ledge does not stop in a hard edge. */
const LEDGE_FADE = 0.06;

/**
 * Draws the ledge onto a canvas of `cssW` by `cssH` CSS pixels, drawn at `sx` and `sy` device pixels per
 * CSS pixel (the canvas itself is `cssW * sx` by `cssH * sy`). Transparent where there is no line.
 */
export function drawLedge(
  c: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  sx: number,
  sy: number,
  seed = 0,
): void {
  c.setTransform(sx, 0, 0, sy, 0, 0);
  c.clearRect(0, 0, cssW, cssH);
  c.lineJoin = "round";
  for (const line of ledgeLines(cssW, seed, cssH)) {
    const s = ledgeStroke(line);
    c.strokeStyle = s.color;
    c.lineWidth = s.width;
    c.stroke(new Path2D(line.d));
  }
  // the ends fade out
  const g = c.createLinearGradient(0, 0, cssW, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(LEDGE_FADE, "rgba(0,0,0,1)");
  g.addColorStop(1 - LEDGE_FADE, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.globalCompositeOperation = "destination-in";
  c.fillStyle = g;
  c.fillRect(0, 0, cssW, cssH);
  c.globalCompositeOperation = "source-over";
  c.setTransform(1, 0, 0, 1, 0, 0);
}
