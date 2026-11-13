/** How long a card takes to slide in or out, in ms: `--panel-ms` in app/styles/tokens.css (card-pose.test.ts keeps them equal). */
export const PANEL_MS = 700;

export type Side = "left" | "right";
export type Mode = "hidden" | "rest" | "open";

export type CardPoseInput = {
  side: Side;
  mode: Mode;
  /** Viewport width. */
  vw: number;
  /** Card width. */
  width: number;
  /** Rail element width (unscaled). */
  rail: number;
  /** Pointer is hovering the card at rest. */
  hot: boolean;
};

/** A drag settles on its target when progress is greater than this. */
export const SETTLE_AT = 0.3;

/** Whether a drag released at `progress` goes on to its target (strictly past SETTLE_AT) or springs back. */
export const settlesOnTarget = (progress: number): boolean => progress > SETTLE_AT;

const NUDGE = 14;
const OFFSCREEN = 40;

export function restScale(vw: number): number {
  return vw < 700 ? 0.5 : 0.56;
}

export function cardMargin(vw: number, width: number): number {
  return vw < 700 ? (vw - width) / 2 : Math.max(24, vw * 0.045);
}

export function cardPose(p: CardPoseInput): { x: number; s: number } {
  const { side, mode, vw, width } = p;
  const s0 = restScale(vw);
  const peek = p.rail * s0;
  const nudge = p.hot ? NUDGE : 0;
  if (side === "right") {
    if (mode === "hidden") return { x: vw + OFFSCREEN, s: s0 };
    if (mode === "rest") return { x: vw - peek - nudge, s: s0 };
    return { x: vw - width - cardMargin(vw, width), s: 1 };
  }
  if (mode === "hidden") return { x: -width - OFFSCREEN, s: s0 };
  if (mode === "rest") return { x: -width + peek + nudge, s: s0 };
  return { x: cardMargin(vw, width), s: 1 };
}

/** Drag progress 0..1: `sign * dx` over 80% of the card width. */
export function dragProgress(dx: number, width: number, sign: 1 | -1): number {
  const p = (sign * dx) / (width * 0.8);
  return Math.min(1, Math.max(0, p));
}
