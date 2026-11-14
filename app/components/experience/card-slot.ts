// Where a milestone's card sits (spec 9.5): of five places round the milestone, the one that covers the fewest
// other milestones (the chosen one's own head counts four times as much). Pure maths over screen positions.
import { clamp } from "./map-math";
import type { Stage } from "./view";

export type Size = { w: number; h: number };
export type XY = [number, number];

/** The card's offset from its milestone's head for each place: above right, above left, above, below right, below left. */
export const SLOTS: readonly ((w: number, h: number) => XY)[] = [
  (_w, h) => [26, -h - 12],
  (w, h) => [-w - 26, -h - 12],
  (w, h) => [-w / 2, -h - 40],
  () => [30, 22],
  (w) => [-w - 30, 22],
];

/** The nearest a card comes to the sides and the foot of the stage, and to its top (the chart's frame and the mode switch). */
export const EDGE = 16;
export const TOP = 72;
export const FOOT = 24;
/** How near a head must be to a card's edge to count as under it. */
export const NEAR = 22;
/** How much worse it is for a card to cover its own milestone, and the small preference for the earlier places. */
export const OWN_WEIGHT = 4;
export const ORDER_WEIGHT = 0.1;
/** Beads under a card step back; the card's rectangle counts this many pixels wider all round for that. */
export const FADE_PAD = 14;

/** The top left corner of a card in place k, kept inside the stage. */
export function cardRect(k: number, anchor: XY, card: Size, stage: Stage): XY {
  const [dx, dy] = SLOTS[k](card.w, card.h);

  return [clamp(anchor[0] + dx, EDGE, stage.w - card.w - EDGE), clamp(anchor[1] + dy, TOP, stage.h - card.h - FOOT)];
}

/** Whether a head is under (or within `NEAR` px of) the rectangle with its corner at x, y. */
export function covered(x: number, y: number, w: number, h: number, head: XY, near: number = NEAR): boolean {
  return head[0] > x - near && head[0] < x + w + near && head[1] > y - near && head[1] < y + h + near;
}

/** The place (0 to 4) with the fewest heads under it. `chosen` is the index in `heads` of the milestone the card is for. */
export function pickSlot(anchor: XY, card: Size, heads: readonly XY[], chosen: number, stage: Stage): number {
  let best = 0;
  let bestScore = Infinity;

  SLOTS.forEach((_, k) => {
    const [x, y] = cardRect(k, anchor, card, stage);
    const score = k * ORDER_WEIGHT + heads.reduce((n, head, i) => n + (covered(x, y, card.w, card.h, head) ? (i === chosen ? OWN_WEIGHT : 1) : 0), 0);

    if (score < bestScore) {
      bestScore = score;
      best = k;
    }
  });

  return best;
}

/** The indices of the heads a card at x, y still covers (other than its own): they step back. */
export function coveredIndices(x: number, y: number, card: Size, heads: readonly XY[], chosen: number): number[] {
  return heads.flatMap((head, i) => (i !== chosen && covered(x - FADE_PAD, y - FADE_PAD, card.w + 2 * FADE_PAD, card.h + 2 * FADE_PAD, head) ? [i] : []));
}
